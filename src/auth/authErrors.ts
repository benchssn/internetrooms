/**
 * Turns Supabase Auth errors into short, safe messages. Raw server messages
 * are never shown, and messages avoid revealing whether an account exists.
 */

export interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

export const NETWORK_MESSAGE =
  "We couldn't reach the server. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code } = error as AuthErrorLike;
  return typeof code === "string" ? code : undefined;
}

function isNetworkError(error: AuthErrorLike): boolean {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    (error.name === "TypeError" && /fetch/i.test(error.message ?? ""))
  );
}

export function friendlyAuthError(error: unknown): string {
  if (typeof error !== "object" || error === null) return GENERIC_MESSAGE;
  const e = error as AuthErrorLike;
  if (isNetworkError(e)) return NETWORK_MESSAGE;

  switch (e.code) {
    case "invalid_credentials":
      return "That email and password don't match. Check them and try again.";
    case "email_not_confirmed":
      return "Please verify your email address first. Use the link we sent you when you registered.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one, mixing words, numbers and symbols.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "New accounts can't be created right now.";
    case "email_address_invalid":
    case "validation_failed":
      return "Please enter a valid email address.";
    case "email_address_not_authorized":
      return "We can't send email to that address at the moment. Please try again later.";
    case "otp_expired":
    case "flow_state_expired":
      return "This link has expired. Links can only be used once and for a limited time.";
    case "pkce_code_verifier_not_found":
    case "bad_code_verifier":
    case "flow_state_not_found":
      return "This link was opened in a different browser or device from the one where it was requested, or it has already been used.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Your session has ended. Please log in again.";
    case "user_banned":
      return "This account can't be used right now.";
    default:
      return GENERIC_MESSAGE;
  }
}
