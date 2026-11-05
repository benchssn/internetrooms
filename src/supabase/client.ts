import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig, SupabaseConfigError } from "./config";

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, creating it on first use.
 *
 * Throws a SupabaseConfigError (with instructions) if the environment
 * variables are missing or invalid, rather than failing silently later.
 * Creation is lazy so that the rest of Internetrooms — which still works
 * entirely in the browser — is unaffected when Supabase isn't configured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const result = readSupabaseConfig();
  if (!result.ok) throw new SupabaseConfigError(result.problems);
  client = createClient(result.config.url, result.config.publishableKey, {
    auth: {
      // Supabase Auth manages the session: it is stored in the browser
      // (localStorage) and refreshed automatically, so users stay signed in
      // across reloads. Internetrooms never reads or stores tokens itself.
      persistSession: true,
      autoRefreshToken: true,
      // Email links use the PKCE flow: Supabase redirects to /auth/callback
      // with a one-time `code`, which that page exchanges explicitly. The
      // client must not also try to read sessions from URLs on its own.
      flowType: "pkce",
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** True when both environment variables are present and valid. */
export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig().ok;
}

/** For tests: forget the cached client. */
export function resetSupabaseClientForTests() {
  client = null;
}
