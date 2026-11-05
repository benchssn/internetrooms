import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { authApiError, createFakeAuth, FAKE_ACCESS_TOKEN, FAKE_REFRESH_TOKEN, type FakeAuth } from "../test/fakeAuth";
import { friendlyAuthError } from "./authErrors";
import { resetAuthExchangesForTests } from "./callbackExchanges";
import { safeNextPath, validateConfirmation, validateEmail, validateNewPassword } from "./validation";

const fake = vi.hoisted(() => ({ current: null as null | { auth: unknown } }));

vi.mock("./authClient", () => ({
  loadAuthClient: async () => fake.current?.auth ?? null,
  authRedirectUrl: () => "https://internetrooms.net/auth/callback",
}));

let auth: FakeAuth;

function useFake(options?: Parameters<typeof createFakeAuth>[0]) {
  auth = createFakeAuth(options);
  fake.current = auth;
  return auth;
}

function renderAt(path: string, { strict = false } = {}) {
  window.history.replaceState(null, "", path);
  const user = userEvent.setup();
  const app = strict ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  );
  return { user, ...render(app) };
}

const accountNav = () => screen.getByRole("group", { name: "Account" });

function expectNoTokensOnPage() {
  const html = document.documentElement.innerHTML;
  expect(html).not.toContain(FAKE_ACCESS_TOKEN);
  expect(html).not.toContain(FAKE_REFRESH_TOKEN);
  expect(html).not.toContain("RAW SERVER MESSAGE");
}

beforeEach(() => {
  resetAuthExchangesForTests();
  sessionStorage.clear();
  useFake();
});

/* ------------------------------------------------------------------ */

describe("validation", () => {
  it("checks emails", () => {
    expect(validateEmail("")).toMatch(/enter your email/i);
    expect(validateEmail("not-an-email")).toMatch(/valid email/i);
    expect(validateEmail("  person@example.com ")).toBeUndefined();
  });

  it("checks new passwords and confirmation", () => {
    expect(validateNewPassword("")).toMatch(/choose a password/i);
    expect(validateNewPassword("short")).toMatch(/at least 8/i);
    expect(validateNewPassword("x".repeat(73))).toMatch(/too long/i);
    expect(validateNewPassword(" padded password ")).toMatch(/space/i);
    expect(validateNewPassword("a fine password")).toBeUndefined();
    expect(validateConfirmation("abcdefgh", "abcdefgx")).toMatch(/don't match/i);
    expect(validateConfirmation("abcdefgh", "abcdefgh")).toBeUndefined();
  });

  it("only allows same-site redirects after login", () => {
    expect(safeNextPath("/edit")).toBe("/edit");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("maps errors to safe messages without raw server text", () => {
    expect(friendlyAuthError(authApiError("invalid_credentials"))).toMatch(/don't match/);
    expect(friendlyAuthError({ name: "AuthRetryableFetchError", status: 0 })).toMatch(/couldn't reach/i);
    expect(friendlyAuthError(authApiError("something_new"))).toBe("Something went wrong. Please try again.");
    expect(friendlyAuthError(authApiError("something_new"))).not.toContain("RAW");
  });
});

describe("registration", () => {
  it("validates input before contacting Supabase", async () => {
    const { user } = renderAt("/register");
    await screen.findByRole("group", { name: "Account" });
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(/enter your email/i);
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText("Email address"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "a fine password");
    await user.type(screen.getByLabelText("Confirm password"), "a different one");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription(/don't match/i);
    expect(auth.auth.signUp).not.toHaveBeenCalled();
  });

  it("asks the user to verify their email, without signing them in", async () => {
    const { user } = renderAt("/register");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), " new@example.com ");
    await user.type(screen.getByLabelText("Password"), "a fine password");
    await user.type(screen.getByLabelText("Confirm password"), "a fine password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { level: 1, name: "check your email" })).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByText(/you're not signed in yet/i)).toBeInTheDocument();
    expect(auth.auth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "a fine password",
      options: { emailRedirectTo: "https://internetrooms.net/auth/callback" },
    });
    expect(within(accountNav()).getByRole("link", { name: "Log in" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /send it again/i }));
    expect(await screen.findByText(/new link is on its way/i)).toBeInTheDocument();
    expect(auth.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "new@example.com" }),
    );
  });

  it("doesn't reveal whether an email is already registered", async () => {
    auth.auth.signUp.mockResolvedValueOnce({
      data: { user: null as never, session: null },
      error: authApiError("user_already_exists"),
    });
    const { user } = renderAt("/register");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), "taken@example.com");
    await user.type(screen.getByLabelText("Password"), "a fine password");
    await user.type(screen.getByLabelText("Confirm password"), "a fine password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { level: 1, name: "check your email" })).toBeInTheDocument();
  });

  it("shows a helpful error for rate limits", async () => {
    auth.auth.signUp.mockResolvedValueOnce({
      data: { user: null as never, session: null },
      error: authApiError("over_email_send_rate_limit", 429),
    });
    const { user } = renderAt("/register");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "a fine password");
    await user.type(screen.getByLabelText("Confirm password"), "a fine password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many attempts/i);
    expectNoTokensOnPage();
  });
});

describe("login and logout", () => {
  async function logIn(user: ReturnType<typeof userEvent.setup>, password: string) {
    await user.type(screen.getByLabelText("Email address"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Log in" }));
  }

  it("validates the form", async () => {
    const { user } = renderAt("/login");
    await screen.findByRole("group", { name: "Account" });
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(/enter your email/i);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(/enter your password/i);
    expect(auth.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("links to registration and password recovery", async () => {
    renderAt("/login");
    expect(await screen.findByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /forgot your password/i })).toHaveAttribute("href", "/forgot-password");
  });

  it("explains a failed login without revealing account details", async () => {
    const { user } = renderAt("/login");
    await screen.findByRole("group", { name: "Account" });
    await logIn(user, "wrong password");
    expect(await screen.findByRole("alert")).toHaveTextContent(/email and password don't match/i);
    expect(within(accountNav()).getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expectNoTokensOnPage();
  });

  it("offers a new verification email when the address isn't verified", async () => {
    useFake({ verified: false });
    const { user } = renderAt("/login");
    await screen.findByRole("group", { name: "Account" });
    await logIn(user, "correct horse battery");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/verify your email/i);
    await user.click(within(alert).getByRole("button", { name: /send a new verification link/i }));
    expect(await screen.findByText(/new verification link is on its way/i)).toBeInTheDocument();
  });

  it("logs in, returns to the requested page and shows the account in the navigation", async () => {
    const { user } = renderAt("/login?next=/templates");
    await screen.findByRole("group", { name: "Account" });
    await logIn(user, "correct horse battery");

    await waitFor(() => expect(window.location.pathname).toBe("/templates"));
    expect(within(accountNav()).getByText("me@example.com")).toBeInTheDocument();
    expect(within(accountNav()).getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expectNoTokensOnPage();
  });

  it("ignores off-site redirect targets after login", async () => {
    const { user } = renderAt("/login?next=https://evil.example");
    await screen.findByRole("group", { name: "Account" });
    await logIn(user, "correct horse battery");
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("logs out from the navigation", async () => {
    useFake({ sessionEmail: "me@example.com" });
    const { user } = renderAt("/");
    await user.click(await within(await screen.findByRole("group", { name: "Account" })).findByRole("button", { name: "Log out" }));
    expect(auth.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await within(accountNav()).findByRole("link", { name: "Log in" })).toBeInTheDocument();
  });
});

describe("sessions and navigation", () => {
  it("restores a saved session on load", async () => {
    useFake({ sessionEmail: "back@example.com" });
    renderAt("/");
    expect(await within(await screen.findByRole("group", { name: "Account" })).findByText("back@example.com")).toBeInTheDocument();
    expectNoTokensOnPage();
  });

  it("shows log in and register links when signed out", async () => {
    renderAt("/templates");
    const nav = await screen.findByRole("group", { name: "Account" });
    expect(within(nav).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Ftemplates");
    expect(within(nav).getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
  });

  it("shows the account in the editor toolbar too", async () => {
    useFake({ sessionEmail: "me@example.com" });
    renderAt("/edit");
    expect(await within(await screen.findByRole("group", { name: "Account" })).findByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("tells signed-in users they're already logged in on /login and /register", async () => {
    useFake({ sessionEmail: "me@example.com" });
    renderAt("/login");
    expect(await screen.findByText(/you're logged in as/i)).toBeInTheDocument();
  });

  it("hides account links and explains when Supabase isn't configured", async () => {
    fake.current = null;
    renderAt("/login");
    expect(await screen.findByText(/accounts aren't available right now/i)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Account" })).not.toBeInTheDocument();
  });
});

describe("email verification callback", () => {
  it("exchanges the code once, signs the user in and removes the code from the URL", async () => {
    renderAt("/auth/callback?code=verify-ok&sb_flow_id=abc", { strict: true });
    expect(await screen.findByRole("heading", { level: 1, name: "you're in" })).toBeInTheDocument();
    expect(auth.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.auth.exchangeCodeForSession).toHaveBeenCalledWith("verify-ok");
    expect(window.location.search).toBe("");
    expect(await within(accountNav()).findByText("new@example.com")).toBeInTheDocument();
    expectNoTokensOnPage();
  });

  it("explains expired links", async () => {
    renderAt("/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByRole("heading", { level: 1, name: /didn't work/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/expired/i);
    expect(auth.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("explains errors reported in the URL fragment", async () => {
    renderAt("/auth/callback#error=access_denied&error_code=otp_expired");
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
    expect(window.location.hash).toBe("");
  });

  it("explains links opened in a different browser", async () => {
    renderAt("/auth/callback?code=other-browser");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/different browser or device/i);
    expect(alert).toHaveTextContent(/try logging in/i);
    expectNoTokensOnPage();
  });

  it("handles invalid or used codes and missing codes", async () => {
    const { unmount } = renderAt("/auth/callback?code=used-already");
    expect(await screen.findByRole("alert")).toHaveTextContent(/already been used/i);
    unmount();
    renderAt("/auth/callback");
    expect(await screen.findByRole("alert")).toHaveTextContent(/incomplete or has already been used/i);
  });
});

describe("password recovery", () => {
  it("requests a reset link without revealing whether the account exists", async () => {
    const { user } = renderAt("/forgot-password");
    await screen.findByRole("group", { name: "Account" });
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText("Email address"), "someone@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/if there's an account for/i)).toBeInTheDocument();
    expect(auth.auth.resetPasswordForEmail).toHaveBeenCalledWith("someone@example.com", {
      redirectTo: "https://internetrooms.net/auth/callback",
    });
  });

  it("still reports success when Supabase says the user doesn't exist", async () => {
    auth.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: authApiError("user_not_found", 404) });
    const { user } = renderAt("/forgot-password");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/if there's an account for/i)).toBeInTheDocument();
  });

  it("follows a recovery link to choose a new password", async () => {
    const { user } = renderAt("/auth/callback?code=recovery-ok");
    expect(await screen.findByRole("heading", { level: 1, name: "choose a new password" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/reset-password"));

    await user.type(screen.getByLabelText("New password"), "brand new password");
    await user.type(screen.getByLabelText("Confirm new password"), "brand new passwrod");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByLabelText("Confirm new password")).toHaveAccessibleDescription(/don't match/i);
    expect(auth.auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "brand new password");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("heading", { level: 1, name: "password updated" })).toBeInTheDocument();
    expect(auth.auth.updateUser).toHaveBeenCalledWith({ password: "brand new password" });
    expectNoTokensOnPage();
  });

  it("keeps recovery mode across a reload of the reset page", async () => {
    const { unmount } = renderAt("/auth/callback?code=recovery-ok");
    await screen.findByRole("heading", { level: 1, name: "choose a new password" });
    unmount();
    useFake({ sessionEmail: "reset@example.com" });
    renderAt("/reset-password");
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });

  it("refuses to change the password without a recovery link", async () => {
    useFake({ sessionEmail: "me@example.com" });
    renderAt("/reset-password");
    expect(await screen.findByRole("alert")).toHaveTextContent(/only works from a password-reset email/i);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("explains when Supabase rejects the new password", async () => {
    auth.auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: authApiError("same_password", 422) });
    const { user } = renderAt("/auth/callback?code=recovery-ok");
    await screen.findByLabelText("New password");
    await user.type(screen.getByLabelText("New password"), "brand new password");
    await user.type(screen.getByLabelText("Confirm new password"), "brand new password");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/must be different/i);
  });

  it("clears recovery mode on logout", async () => {
    const { user } = renderAt("/auth/callback?code=recovery-ok");
    await screen.findByLabelText("New password");
    await user.click(within(accountNav()).getByRole("button", { name: "Log out" }));
    await act(async () => {});
    expect(sessionStorage.getItem("internetrooms:auth:recovery")).toBeNull();
  });
});

describe("existing functionality", () => {
  it("keeps the homepage, editor and local room storage working while signed in", async () => {
    useFake({ sessionEmail: "me@example.com" });
    const { user } = renderAt("/edit");
    await within(await screen.findByRole("group", { name: "Account" })).findByText("me@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(localStorage.getItem("internetrooms:room:room-001:v2")).not.toBeNull();
  });
});
