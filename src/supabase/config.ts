/**
 * Reads and checks the Supabase connection settings.
 *
 * Values come from Vite environment variables, which are inlined into the
 * bundle at build time:
 *   - locally from `.env.local` (ignored by Git; see `.env.example`)
 *   - in production from the Render service's environment settings
 *
 * Only the *publishable* key belongs here — it is designed to be public and
 * is safe in browser code. A secret / service-role key must never be used
 * in the browser, so it is rejected outright.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; problems: string[] };

export class SupabaseConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(formatConfigProblems(problems));
    this.name = "SupabaseConfigError";
    this.problems = problems;
  }
}

/** Placeholder values from `.env.example` that mean "not filled in yet". */
const PLACEHOLDER_URL = /your-project-ref/i;
const PLACEHOLDER_KEY = /your-publishable-key/i;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Decodes a JWT's payload without verifying it (to spot service-role keys). */
function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload: unknown = JSON.parse(json);
    return typeof payload === "object" && payload !== null && "role" in payload
      ? String((payload as { role: unknown }).role)
      : null;
  } catch {
    return null;
  }
}

function checkUrl(raw: string | undefined, problems: string[]): string | null {
  const value = raw?.trim();
  if (!value) {
    problems.push("VITE_SUPABASE_URL is not set.");
    return null;
  }
  if (PLACEHOLDER_URL.test(value)) {
    problems.push("VITE_SUPABASE_URL still has the placeholder value from .env.example.");
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    problems.push(`VITE_SUPABASE_URL is not a valid URL ("${value}").`);
    return null;
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    problems.push("VITE_SUPABASE_URL must start with https:// (http:// is only allowed for localhost).");
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    problems.push(
      "VITE_SUPABASE_URL should be just the project URL, e.g. https://abcd1234.supabase.co (no path).",
    );
    return null;
  }
  return url.origin;
}

function checkKey(raw: string | undefined, problems: string[]): string | null {
  const value = raw?.trim();
  if (!value) {
    problems.push("VITE_SUPABASE_PUBLISHABLE_KEY is not set.");
    return null;
  }
  if (PLACEHOLDER_KEY.test(value)) {
    problems.push("VITE_SUPABASE_PUBLISHABLE_KEY still has the placeholder value from .env.example.");
    return null;
  }
  if (value.startsWith("sb_secret_") || jwtRole(value) === "service_role") {
    problems.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY looks like a SECRET key. Secret keys must never be used in the browser — use the publishable key (sb_publishable_…) instead, and rotate the secret key if it was exposed.",
    );
    return null;
  }
  return value;
}

/** Checks the environment without throwing. */
export function readSupabaseConfig(env: SupabaseEnv = import.meta.env): SupabaseConfigResult {
  const problems: string[] = [];
  const url = checkUrl(env.VITE_SUPABASE_URL, problems);
  const publishableKey = checkKey(env.VITE_SUPABASE_PUBLISHABLE_KEY, problems);
  if (!url || !publishableKey) return { ok: false, problems };
  return { ok: true, config: { url, publishableKey } };
}

export function formatConfigProblems(problems: string[]): string {
  return [
    "Supabase is not configured correctly:",
    ...problems.map((p) => `  • ${p}`),
    "",
    "Locally: copy .env.example to .env.local, fill in the values from your Supabase dashboard",
    "(Project Settings → API), then restart `npm run dev`.",
    "In production: set both variables in the Render service's Environment settings and redeploy",
    "(Vite reads them at build time).",
  ].join("\n");
}
