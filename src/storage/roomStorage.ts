import { validateRoomConfig } from "../validation/roomValidation";
import type { RoomConfig } from "../types/room";

/**
 * Versioned key: "v2" marks the Milestone 2 storage format. The room id is
 * part of the key so several rooms could coexist in future.
 */
export const STORAGE_KEY = "internetrooms:room:room-001:v2";

export type LoadResult =
  /** Nothing has been saved yet. */
  | { status: "empty" }
  /** A valid saved room was found. */
  | { status: "ok"; room: RoomConfig }
  /** Something is stored but it is not a valid room. It is left untouched. */
  | { status: "invalid"; reason: string }
  /** localStorage cannot be read (private mode, blocked, etc.). */
  | { status: "unavailable"; reason: string };

export type SaveResult = { ok: true } | { ok: false; reason: string };

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Browser storage is full.";
  }
  return "Browser storage is not available.";
}

export function loadRoom(): LoadResult {
  const storage = getStorage();
  if (!storage) {
    return { status: "unavailable", reason: "Browser storage is not available." };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: "unavailable", reason: describeError(error) };
  }

  if (raw === null) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "Saved data is not valid JSON." };
  }

  const result = validateRoomConfig(parsed);
  if (!result.ok) {
    return {
      status: "invalid",
      reason: `Saved data failed validation (${result.errors[0]}${
        result.errors.length > 1 ? `, and ${result.errors.length - 1} more` : ""
      }).`,
    };
  }
  return { status: "ok", room: result.room };
}

/**
 * Writes the room and reads it back to confirm. Only reports success once
 * the stored value is known to match what was written.
 */
export function saveRoom(room: RoomConfig): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "Browser storage is not available." };

  const serialised = JSON.stringify(room);
  try {
    storage.setItem(STORAGE_KEY, serialised);
    if (storage.getItem(STORAGE_KEY) !== serialised) {
      return { ok: false, reason: "The saved data could not be confirmed." };
    }
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
  return { ok: true };
}

export function clearSavedRoom(): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "Browser storage is not available." };
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
  return { ok: true };
}
