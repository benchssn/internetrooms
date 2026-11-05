import { vi } from "vitest";

/**
 * An in-memory stand-in for Supabase Auth, implementing just the calls
 * Internetrooms makes. Sessions carry recognisable fake tokens so tests can
 * assert they never reach the page.
 */

export const FAKE_ACCESS_TOKEN = "FAKE-ACCESS-TOKEN-should-never-be-shown";
export const FAKE_REFRESH_TOKEN = "FAKE-REFRESH-TOKEN-should-never-be-shown";

interface FakeSession {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

type Listener = (event: string, session: FakeSession | null) => void;

export interface FakeAuthOptions {
  /** A session restored from storage on load. */
  sessionEmail?: string;
  password?: string;
  /** Whether the account's email has been verified. */
  verified?: boolean;
}

function session(email: string): FakeSession {
  return {
    access_token: FAKE_ACCESS_TOKEN,
    refresh_token: FAKE_REFRESH_TOKEN,
    user: { id: `user-${email}`, email },
  };
}

export function authApiError(code: string, status = 400) {
  // Mirrors supabase-js AuthApiError; the raw message must never be shown.
  return { name: "AuthApiError", code, status, message: `RAW SERVER MESSAGE (${code})` };
}

export function createFakeAuth(options: FakeAuthOptions = {}) {
  const password = options.password ?? "correct horse battery";
  let current: FakeSession | null = options.sessionEmail ? session(options.sessionEmail) : null;
  const listeners = new Set<Listener>();
  const emit = (event: string) => listeners.forEach((l) => l(event, current));
  const empty = { user: null, session: null };

  const auth = {
    onAuthStateChange: vi.fn((callback: Listener) => {
      listeners.add(callback);
      queueMicrotask(() => callback("INITIAL_SESSION", current));
      return { data: { subscription: { id: "sub", callback, unsubscribe: () => listeners.delete(callback) } } };
    }),
    signUp: vi.fn(async ({ email }: { email: string; password: string; options?: unknown }) => ({
      data: { user: { id: `user-${email}`, email, identities: [] }, session: null },
      error: null as ReturnType<typeof authApiError> | null,
    })),
    signInWithPassword: vi.fn(async (creds: { email: string; password: string }) => {
      if (creds.password !== password) return { data: empty, error: authApiError("invalid_credentials") };
      if (options.verified === false) return { data: empty, error: authApiError("email_not_confirmed") };
      current = session(creds.email);
      emit("SIGNED_IN");
      return { data: { user: current.user, session: current }, error: null };
    }),
    signOut: vi.fn(async (_opts?: { scope?: string }) => {
      current = null;
      emit("SIGNED_OUT");
      return { error: null };
    }),
    resetPasswordForEmail: vi.fn(async (_email: string, _opts?: { redirectTo?: string }) => ({
      data: {},
      error: null as ReturnType<typeof authApiError> | null,
    })),
    updateUser: vi.fn(async (_attrs: { password?: string }) => ({
      data: { user: current?.user ?? null },
      error: null as ReturnType<typeof authApiError> | null,
    })),
    resend: vi.fn(async (_params: unknown) => ({ data: {}, error: null })),
    exchangeCodeForSession: vi.fn(async (code: string) => {
      switch (code) {
        case "verify-ok":
          current = session("new@example.com");
          emit("SIGNED_IN");
          return { data: { ...current, session: current, redirectType: null }, error: null };
        case "recovery-ok":
          current = session("reset@example.com");
          emit("PASSWORD_RECOVERY");
          return { data: { ...current, session: current, redirectType: "recovery" }, error: null };
        case "other-browser":
          return {
            data: { ...empty, redirectType: null },
            error: { name: "AuthPKCECodeVerifierMissingError", code: "pkce_code_verifier_not_found", status: 400, message: "raw" },
          };
        default:
          return { data: { ...empty, redirectType: null }, error: authApiError("flow_state_not_found", 404) };
      }
    }),
  };

  return {
    auth,
    get signedIn() {
      return current !== null;
    },
  };
}

export type FakeAuth = ReturnType<typeof createFakeAuth>;
