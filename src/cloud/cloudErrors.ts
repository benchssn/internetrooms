import { NETWORK_MESSAGE } from "../auth/authErrors";

interface ErrorLike {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: string | number;
}

/**
 * Maps PostgREST / Postgres / Storage errors to short, safe messages.
 * Raw database messages are never shown.
 */
export function friendlyCloudError(error: unknown, context: "profile" | "room" | "upload" | "general" = "general") {
  const e = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  const message = e.message ?? "";

  if (e.name === "TypeError" || /fetch|network/i.test(message) || e.status === 0) {
    return { message: NETWORK_MESSAGE, code: "network" };
  }
  switch (e.code) {
    case "23505":
      return context === "profile"
        ? { message: "That username is already taken. Try another.", code: "username_taken" }
        : { message: "That already exists.", code: "duplicate" };
    case "23514":
      return context === "profile"
        ? { message: "That username isn't allowed. Use 3–24 lowercase letters, numbers, _ or -, and avoid reserved names.", code: "invalid" }
        : { message: "The room couldn't be saved because it isn't valid or is too large.", code: "invalid" };
    case "42501":
    case "PGRST301":
      return { message: "You don't have permission to do that. Try logging in again.", code: "forbidden" };
    case "PGRST116":
      return { message: "That couldn't be found.", code: "not_found" };
    default:
      break;
  }
  if (context === "upload") {
    if (/size|too large|exceeded/i.test(message) || String(e.statusCode) === "413") {
      return { message: "That image is too large to upload.", code: "too_large" };
    }
    if (/mime|type/i.test(message)) {
      return { message: "That image type isn't supported. Use PNG, JPEG or WebP.", code: "bad_type" };
    }
    return { message: "An image couldn't be uploaded. Please try again.", code: "upload_failed" };
  }
  return { message: "Something went wrong. Please try again.", code: e.code };
}
