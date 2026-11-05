import { readSupabaseConfig, type SupabaseConfig } from "./config";

export type ConnectionCheckResult =
  | { ok: true; status: number; latencyMs: number; service: string | null }
  | {
      ok: false;
      reason: "not-configured" | "unreachable" | "timeout" | "key-rejected" | "unexpected-response";
      message: string;
    };

export interface ConnectionCheckOptions {
  config?: SupabaseConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Checks that the Supabase project can be reached with the configured
 * publishable key, without needing any database tables or a signed-in user.
 *
 * It calls the Auth service's public health endpoint (`/auth/v1/health`),
 * sending the same `apikey` header the Supabase client uses. A 200 response
 * means the URL is right, the project is up, and the key was accepted.
 */
export async function checkSupabaseConnection(
  options: ConnectionCheckOptions = {},
): Promise<ConnectionCheckResult> {
  let config = options.config;
  if (!config) {
    const result = readSupabaseConfig();
    if (!result.ok) {
      return { ok: false, reason: "not-configured", message: result.problems.join(" ") };
    }
    config = result.config;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const started = performance.now();

  try {
    const response = await fetchImpl(`${config.url}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: config.publishableKey },
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "key-rejected",
        message: `The project was reached, but the publishable key was rejected (HTTP ${response.status}). Check that VITE_SUPABASE_PUBLISHABLE_KEY belongs to this project.`,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: "unexpected-response",
        message: `The project responded with HTTP ${response.status}. Check VITE_SUPABASE_URL and that the project isn't paused.`,
      };
    }

    let service: string | null = null;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "name" in body) {
        const { name, version } = body as { name?: unknown; version?: unknown };
        service = [name, version].filter((v) => typeof v === "string").join(" ") || null;
      }
    } catch {
      // A 200 with an unexpected body still proves the project is reachable.
    }
    return { ok: true, status: response.status, latencyMs, service };
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, reason: "timeout", message: "The Supabase project didn't respond in time." };
    }
    return {
      ok: false,
      reason: "unreachable",
      message: `Couldn't reach ${config.url} (${error instanceof Error ? error.message : "network error"}). Check the URL, your connection, and that the project isn't paused.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
