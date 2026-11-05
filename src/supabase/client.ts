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
      // No sign-in exists yet, so don't store or refresh sessions.
      // Revisit when authentication is added.
      persistSession: false,
      autoRefreshToken: false,
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
