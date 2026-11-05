import { createContext, useContext } from "react";

export type AuthStatus =
  /** Restoring any saved session. */
  | "loading"
  | "signed-in"
  | "signed-out"
  /** Supabase isn't configured: accounts are off, everything else works. */
  | "unavailable";

/** Only what the UI needs. Tokens are never exposed to components. */
export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string; code?: string };

export type CallbackResult =
  /** Email verified and signed in. */
  | { kind: "verified" }
  /** Password-reset link: the user may now choose a new password. */
  | { kind: "recovery" }
  | { kind: "error"; message: string; code?: string };

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** True after arriving from a password-reset email, until the password is changed. */
  recoveryMode: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult<{ needsVerification: boolean }>>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  /** Processes the query/hash of an /auth/callback URL. */
  completeCallback: (search: string, hash: string) => Promise<CallbackResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
