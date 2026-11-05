import type { SupabaseClient } from "@supabase/supabase-js";

/** The parts of Supabase Auth that Internetrooms uses. */
export type AuthClient = Pick<
  SupabaseClient["auth"],
  | "onAuthStateChange"
  | "signUp"
  | "signInWithPassword"
  | "signOut"
  | "resetPasswordForEmail"
  | "updateUser"
  | "resend"
  | "exchangeCodeForSession"
>;

/**
 * Loads the shared Supabase client on demand (keeping supabase-js out of
 * the main bundle) and returns its Auth API, or null when Supabase isn't
 * configured — in which case accounts are simply unavailable and the rest
 * of Internetrooms keeps working.
 */
export async function loadAuthClient(): Promise<AuthClient | null> {
  const { getSupabaseClient, isSupabaseConfigured } = await import("../supabase/client");
  if (!isSupabaseConfigured()) return null;
  return getSupabaseClient().auth;
}

/**
 * Where every Supabase email link (verification and password reset) sends
 * the user back to. Uses the current origin, so production links return to
 * https://internetrooms.net. The URL must be allowed in Supabase:
 * Authentication → URL Configuration → Redirect URLs.
 */
export function authRedirectUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
