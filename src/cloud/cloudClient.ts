import type { CloudApi } from "./cloudTypes";

let cached: Promise<CloudApi | null> | null = null;

/**
 * Loads the Supabase-backed API on demand (keeping supabase-js out of the
 * main bundle), or null when Supabase isn't configured. Shares the single
 * Supabase client — and therefore the signed-in session — with auth.
 */
export function loadCloudApi(): Promise<CloudApi | null> {
  if (!cached) {
    cached = (async () => {
      const [{ getSupabaseClient, isSupabaseConfigured }, { createSupabaseCloud }] = await Promise.all([
        import("../supabase/client"),
        import("./supabaseCloud"),
      ]);
      if (!isSupabaseConfigured()) return null;
      return createSupabaseCloud(getSupabaseClient());
    })().catch(() => null);
  }
  return cached;
}

/** Production domain used for every shareable room link. */
export const SITE_ORIGIN = "https://internetrooms.net";

export function roomUrl(username: string, shareToken?: string | null): string {
  const base = `${SITE_ORIGIN}/u/${encodeURIComponent(username)}`;
  return shareToken ? `${base}?key=${encodeURIComponent(shareToken)}` : base;
}

/** Same link as a path within this site (for in-app navigation). */
export function roomPath(username: string, shareToken?: string | null): string {
  const base = `/u/${encodeURIComponent(username)}`;
  return shareToken ? `${base}?key=${encodeURIComponent(shareToken)}` : base;
}
