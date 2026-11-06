/**
 * Username rules — mirrored exactly by the database
 * (supabase/migrations/…_profiles.sql), which has the final say.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "about", "account", "accounts", "admin", "administrator", "api", "app",
  "assets", "auth", "blog", "callback", "dashboard", "edit", "editor",
  "explore", "forgot-password", "help", "home", "internetrooms", "login",
  "logout", "me", "mod", "moderator", "new", "null", "official", "owner",
  "privacy", "profile", "profiles", "register", "reset-password", "room",
  "rooms", "root", "security", "settings", "signin", "signout", "signup",
  "staff", "static", "support", "supabase-test", "system", "templates",
  "terms", "u", "undefined", "user", "users", "www",
]);

/** Lowercases and trims what the user typed. */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): string | undefined {
  const value = normaliseUsername(input);
  if (!value) return "Choose a username.";
  if (/\s/.test(value)) return "Usernames can't contain spaces.";
  if (value.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!USERNAME_PATTERN.test(value)) return "Use only letters, numbers, underscores (_) and hyphens (-).";
  if (RESERVED_USERNAMES.has(value)) return "That name is reserved. Please choose another.";
  return undefined;
}

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 500;
