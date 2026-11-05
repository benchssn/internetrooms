import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { authRedirectUrl, loadAuthClient, type AuthClient } from "./authClient";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type AuthUser,
  type CallbackResult,
} from "./authContext";
import { authErrorCode, friendlyAuthError, NETWORK_MESSAGE } from "./authErrors";
import { sharedExchange } from "./callbackExchanges";
import { normaliseEmail } from "./validation";

/** Survives a reload of /reset-password; cleared on sign-out or success. */
const RECOVERY_KEY = "internetrooms:auth:recovery";

function readRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecoveryFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Storage blocked: recovery still works until the page is reloaded.
  }
}

function toUser(session: Session | null): AuthUser | null {
  return session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
}

function failure(error: unknown): { ok: false; message: string; code?: string } {
  return { ok: false, message: friendlyAuthError(error), code: authErrorCode(error) };
}

const UNAVAILABLE: { ok: false; message: string } = {
  ok: false,
  message: "Accounts aren't available right now. Please try again later.",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(readRecoveryFlag);
  const client = useRef<AuthClient | null>(null);
  const loader = useRef<Promise<AuthClient | null> | null>(null);

  /**
   * Starts loading the client on first request. Child components (like the
   * /auth/callback page) run their effects before this provider's, so the
   * load can't wait for the provider's own effect.
   */
  const ensureClient = useCallback(() => {
    if (!loader.current) loader.current = loadAuthClient().catch(() => null);
    return loader.current;
  }, []);

  const setRecovery = useCallback((on: boolean) => {
    writeRecoveryFlag(on);
    setRecoveryMode(on);
  }, []);

  useEffect(() => {
    const lifetime = new AbortController();
    let unsubscribe: (() => void) | undefined;

    void ensureClient().then((auth) => {
      if (lifetime.signal.aborted) return;
      if (!auth) {
        setStatus("unavailable");
        return;
      }
      client.current = auth;
      // Fires INITIAL_SESSION straight away (restoring a saved session),
      // then on every sign-in, sign-out and token refresh.
      const { data } = auth.onAuthStateChange((event, session) => {
        setUser(toUser(session));
        setStatus(session ? "signed-in" : "signed-out");
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      lifetime.abort();
      unsubscribe?.();
    };
  }, [ensureClient, setRecovery]);

  /** Waits for the client to load; null means accounts are unavailable. */
  const getClient = useCallback(async () => client.current ?? (await ensureClient()), [ensureClient]);

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (email, password) => {
      const auth = await getClient();
      if (!auth) return UNAVAILABLE;
      try {
        const { data, error } = await auth.signUp({
          email: normaliseEmail(email),
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) {
          // Don't reveal whether an address is already registered.
          if (error.code === "user_already_exists" || error.code === "email_exists") {
            return { ok: true, needsVerification: true };
          }
          return failure(error);
        }
        return { ok: true, needsVerification: !data.session };
      } catch (error) {
        return failure(error);
      }
    },
    [getClient],
  );

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      const auth = await getClient();
      if (!auth) return UNAVAILABLE;
      try {
        const { error } = await auth.signInWithPassword({ email: normaliseEmail(email), password });
        return error ? failure(error) : { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    [getClient],
  );

  const signOut = useCallback<AuthContextValue["signOut"]>(async () => {
    const auth = await getClient();
    if (!auth) return UNAVAILABLE;
    try {
      // "local" signs out this browser only.
      const { error } = await auth.signOut({ scope: "local" });
      setRecovery(false);
      return error ? failure(error) : { ok: true };
    } catch (error) {
      return failure(error);
    }
  }, [getClient, setRecovery]);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      const auth = await getClient();
      if (!auth) return UNAVAILABLE;
      try {
        const { error } = await auth.resetPasswordForEmail(normaliseEmail(email), {
          redirectTo: authRedirectUrl(),
        });
        // Only surface problems the user can act on; otherwise always report
        // success so the form doesn't reveal which addresses have accounts.
        if (error) {
          const code = error.code;
          const actionable =
            code === "over_email_send_rate_limit" ||
            code === "over_request_rate_limit" ||
            code === "email_address_invalid" ||
            code === "validation_failed" ||
            friendlyAuthError(error) === NETWORK_MESSAGE;
          if (actionable) return failure(error);
        }
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    [getClient],
  );

  const updatePassword = useCallback<AuthContextValue["updatePassword"]>(
    async (password) => {
      const auth = await getClient();
      if (!auth) return UNAVAILABLE;
      try {
        const { error } = await auth.updateUser({ password });
        if (error) return failure(error);
        setRecovery(false);
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    [getClient, setRecovery],
  );

  const resendVerification = useCallback<AuthContextValue["resendVerification"]>(
    async (email) => {
      const auth = await getClient();
      if (!auth) return UNAVAILABLE;
      try {
        const { error } = await auth.resend({
          type: "signup",
          email: normaliseEmail(email),
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
          return failure(error);
        }
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    [getClient],
  );

  const completeCallback = useCallback<AuthContextValue["completeCallback"]>(
    async (search, hash) => {
      const query = new URLSearchParams(search);
      const fragment = new URLSearchParams(hash.replace(/^#/, ""));
      const param = (name: string) => query.get(name) ?? fragment.get(name);

      // Supabase reports expired or invalid links with error parameters.
      const errorCode = param("error_code") ?? param("error");
      if (errorCode) {
        return {
          kind: "error",
          code: errorCode,
          message:
            errorCode === "otp_expired"
              ? friendlyAuthError({ code: "otp_expired" })
              : "This link is invalid or has already been used.",
        };
      }

      const code = query.get("code");
      if (!code) {
        return { kind: "error", code: "missing_code", message: "This link is incomplete or has already been used." };
      }

      return sharedExchange(code, async (): Promise<CallbackResult> => {
          const auth = await getClient();
          if (!auth) return { kind: "error", message: UNAVAILABLE.message };
          try {
            const { data, error } = await auth.exchangeCodeForSession(code);
            if (error) return { kind: "error", message: friendlyAuthError(error), code: authErrorCode(error) };
            // supabase-js reports which kind of link this was; the field
            // isn't in its published types yet.
            const { redirectType } = data as { redirectType?: string | null };
            if (redirectType === "recovery") {
              setRecovery(true);
              return { kind: "recovery" };
            }
            return { kind: "verified" };
          } catch (error) {
            return { kind: "error", message: friendlyAuthError(error), code: authErrorCode(error) };
          }
      });
    },
    [getClient, setRecovery],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      recoveryMode: recoveryMode && status === "signed-in",
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendVerification,
      completeCallback,
    }),
    [status, user, recoveryMode, signUp, signIn, signOut, requestPasswordReset, updatePassword, resendVerification, completeCallback],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
