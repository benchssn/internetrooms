import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const URL_OK = "https://imtbvgslopyfxddysyon.supabase.co";
const KEY = "sb_publishable_TOP_SECRET_LOOKING_VALUE_123";

function configure(url = URL_OK, key = KEY) {
  vi.stubEnv("VITE_SUPABASE_URL", url);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
}

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn<typeof fetch>(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderPage() {
  window.history.replaceState(null, "", "/supabase-test");
  return { user: userEvent.setup(), ...render(<App />) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function resultRegion() {
  return screen.getByRole("region", { name: "Result" });
}

describe("/supabase-test", () => {
  it("shows Connected with the project URL when the health check succeeds", async () => {
    configure();
    const fetchFn = mockFetch(async () =>
      new Response(JSON.stringify({ name: "GoTrue", version: "v2.170.0" }), { status: 200 }),
    );
    renderPage();

    expect(await within(await screen.findByRole("region", { name: "Result" })).findByText("Connected")).toBeInTheDocument();
    expect(within(resultRegion()).getByText(URL_OK)).toBeInTheDocument();
    expect(within(resultRegion()).getByText(/HTTP 200/)).toBeInTheDocument();
    // Only the public health endpoint is called: no tables, no session.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(`${URL_OK}/auth/v1/health`);
  });

  it("never displays the publishable key", async () => {
    configure();
    mockFetch(async () => new Response("{}", { status: 200 }));
    renderPage();
    await within(await screen.findByRole("region", { name: "Result" })).findByText("Connected");
    expect(document.body.innerHTML).not.toContain(KEY);
    expect(document.body.innerHTML).not.toContain("TOP_SECRET");
  });

  it("shows Checking while the request is in flight", async () => {
    configure();
    mockFetch(() => new Promise<Response>(() => {}));
    renderPage();
    const region = await screen.findByRole("region", { name: "Result" });
    expect(within(region).getByText("Checking")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /check again/i })).toBeDisabled();
  });

  it("shows Configuration Error with an explanation when variables are missing", async () => {
    configure("", "");
    const fetchFn = mockFetch(async () => new Response("{}", { status: 200 }));
    renderPage();
    const region = await screen.findByRole("region", { name: "Result" });
    expect(within(region).getByText("Configuration Error")).toBeInTheDocument();
    expect(within(region).getByText("VITE_SUPABASE_URL is not set.")).toBeInTheDocument();
    expect(within(region).getByText("Not set or invalid")).toBeInTheDocument();
    expect(within(region).getByText(/Environment/)).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a secret key without showing it", async () => {
    configure(URL_OK, "sb_secret_DO_NOT_SHOW_ME");
    mockFetch(async () => new Response("{}", { status: 200 }));
    renderPage();
    const region = await screen.findByRole("region", { name: "Result" });
    expect(within(region).getByText("Configuration Error")).toBeInTheDocument();
    expect(within(region).getByText(/looks like a SECRET key/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("DO_NOT_SHOW_ME");
  });

  it("shows Connection Failed when the key is rejected", async () => {
    configure();
    mockFetch(async () => new Response("{}", { status: 401 }));
    renderPage();
    const region = await screen.findByRole("region", { name: "Result" });
    expect(await within(region).findByText("Connection Failed")).toBeInTheDocument();
    expect(within(region).getByText(/publishable key was rejected/)).toBeInTheDocument();
    expect(within(region).getByText(URL_OK)).toBeInTheDocument();
  });

  it("shows Connection Failed when the project can't be reached, and can retry", async () => {
    configure();
    const fetchFn = mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { user } = renderPage();
    const region = await screen.findByRole("region", { name: "Result" });
    expect(await within(region).findByText("Connection Failed")).toBeInTheDocument();
    expect(within(region).getByText(/Couldn't reach/)).toBeInTheDocument();

    fetchFn.mockImplementation(async () => new Response("{}", { status: 200 }));
    await user.click(within(region).getByRole("button", { name: /check again/i }));
    expect(await within(region).findByText("Connected")).toBeInTheDocument();
  });

  it("asks search engines not to index the page, and isn't linked from the site", async () => {
    configure();
    mockFetch(async () => new Response("{}", { status: 200 }));
    const { unmount } = renderPage();
    await screen.findByRole("region", { name: "Result" });
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(document.querySelector('a[href="/supabase-test"]')).toBeNull();
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});

