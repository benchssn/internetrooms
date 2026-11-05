import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClientForTests } from "./client";
import { readSupabaseConfig, SupabaseConfigError } from "./config";
import { checkSupabaseConnection } from "./connectionCheck";
import { runDevConnectionCheck } from "./devConnectionCheck";

const URL_OK = "https://imtbvgslopyfxddysyon.supabase.co";
const KEY_OK = "sb_publishable_testkey123";
const config = { url: URL_OK, publishableKey: KEY_OK };

function fakeJwt(payload: object) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.signature`;
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetSupabaseClientForTests();
});

describe("readSupabaseConfig", () => {
  it("accepts a project URL and publishable key", () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: `${URL_OK}/`, VITE_SUPABASE_PUBLISHABLE_KEY: ` ${KEY_OK} ` }),
    ).toEqual({ ok: true, config });
  });

  it("reports both missing variables", () => {
    const result = readSupabaseConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        "VITE_SUPABASE_URL is not set.",
        "VITE_SUPABASE_PUBLISHABLE_KEY is not set.",
      ]);
    }
  });

  it("rejects the .env.example placeholders", () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: "https://your-project-ref.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_your-publishable-key",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toMatch(/placeholder/);
  });

  it.each([
    ["not a URL", "supabase"],
    ["plain http", "http://imtbvgslopyfxddysyon.supabase.co"],
    ["a path", `${URL_OK}/rest/v1`],
  ])("rejects a URL that is %s", (_name, url) => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).ok).toBe(false);
  });

  it("allows http for a local Supabase instance", () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).ok,
    ).toBe(true);
  });

  it.each([
    ["an sb_secret_ key", "sb_secret_abc123"],
    ["a service_role JWT", fakeJwt({ role: "service_role" })],
  ])("refuses %s in the browser", (_name, key) => {
    const result = readSupabaseConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: key });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatch(/SECRET key/);
  });

  it("accepts a legacy anon JWT", () => {
    const key = fakeJwt({ role: "anon" });
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: key }).ok).toBe(true);
  });
});

describe("getSupabaseClient", () => {
  it("throws a clear, actionable error when not configured", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseClient()).toThrow(SupabaseConfigError);
    expect(() => getSupabaseClient()).toThrow(/copy \.env\.example to \.env\.local/);
  });

  it("creates one shared client from the environment", () => {
    vi.stubEnv("VITE_SUPABASE_URL", URL_OK);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", KEY_OK);
    expect(isSupabaseConfigured()).toBe(true);
    const client = getSupabaseClient();
    expect(client).toBe(getSupabaseClient());
    expect(typeof client.from).toBe("function");
  });
});

describe("checkSupabaseConnection", () => {
  it("reports success when the auth health endpoint answers", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ name: "GoTrue", version: "v2.170.0" }), { status: 200 }),
    );
    const result = await checkSupabaseConnection({ config, fetchImpl });
    expect(result).toMatchObject({ ok: true, status: 200, service: "GoTrue v2.170.0" });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${URL_OK}/auth/v1/health`,
      expect.objectContaining({ method: "GET", headers: { apikey: KEY_OK } }),
    );
  });

  it("explains a rejected key", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const result = await checkSupabaseConnection({ config, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "key-rejected" });
  });

  it("explains unexpected responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    expect(await checkSupabaseConnection({ config, fetchImpl })).toMatchObject({
      ok: false,
      reason: "unexpected-response",
    });
  });

  it("explains network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await checkSupabaseConnection({ config, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "unreachable" });
    if (!result.ok) expect(result.message).toMatch(/Failed to fetch/);
  });

  it("times out instead of hanging", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    expect(await checkSupabaseConnection({ config, fetchImpl, timeoutMs: 10 })).toMatchObject({
      ok: false,
      reason: "timeout",
    });
  });

  it("reports missing configuration without making a request", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const fetchImpl = vi.fn();
    expect(await checkSupabaseConnection({ fetchImpl })).toMatchObject({ ok: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("runDevConnectionCheck", () => {
  it("logs a clear error when the environment variables are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runDevConnectionCheck();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/VITE_SUPABASE_URL is not set/));
  });
});
