/** Client-side checks before anything is sent to Supabase. */

export const PASSWORD_MIN = 8;
/** Supabase (bcrypt) ignores bytes beyond 72, so longer passwords are refused. */
export const PASSWORD_MAX_BYTES = 72;
const EMAIL_MAX = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function normaliseEmail(email: string): string {
  return email.trim();
}

export function validateEmail(email: string): string | undefined {
  const value = normaliseEmail(email);
  if (!value) return "Enter your email address.";
  if (value.length > EMAIL_MAX || !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address, like name@example.com.";
  }
  return undefined;
}

export function validateNewPassword(password: string): string | undefined {
  if (!password) return "Choose a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "That password is too long. Use 72 characters or fewer.";
  }
  if (password.trim() !== password) return "Passwords can't start or end with a space.";
  return undefined;
}

export function validateConfirmation(password: string, confirmation: string): string | undefined {
  if (!confirmation) return "Type your password again.";
  if (confirmation !== password) return "The passwords don't match.";
  return undefined;
}

export function validateLoginPassword(password: string): string | undefined {
  return password ? undefined : "Enter your password.";
}

/**
 * Only allows redirects to paths on this site (e.g. "/edit"), never to
 * another origin, to prevent open redirects after login.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  if (/^\/(login|register|forgot-password|reset-password|auth\/)/.test(next)) return fallback;
  return next;
}
