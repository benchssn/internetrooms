import type { RoomConfig } from "../types/room";
import { readRoom } from "./migrations";

/**
 * Versioned storage key. ("v2" marks the storage format introduced in
 * Milestone 2; the room inside carries its own `schemaVersion`, which is
 * migrated on load.)
 */
export const STORAGE_KEY = "internetrooms:room:room-001:v2";

/**
 * Copies of previously stored data, kept before anything that isn't a
 * valid current-schema room is overwritten (after a migration, or when
 * saving over damaged data). Newest first, at most MAX_BACKUPS entries.
 */
export const BACKUP_KEY = "internetrooms:room:room-001:backups";
const MAX_BACKUPS = 3;

export interface RoomBackup {
  savedAt: string;
  raw: string;
}

export type LoadResult =
  /** Nothing has been saved yet. */
  | { status: "empty" }
  /** A valid saved room was found (possibly migrated from an older schema). */
  | { status: "ok"; room: RoomConfig; migratedFrom: number | null; backedUp: boolean }
  /** Something is stored but can't be read. It is left untouched. */
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

/* ---- Backups ---- */

export function readBackups(): RoomBackup[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(BACKUP_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is RoomBackup =>
        typeof b === "object" &&
        b !== null &&
        typeof (b as RoomBackup).raw === "string" &&
        typeof (b as RoomBackup).savedAt === "string",
    );
  } catch {
    return [];
  }
}

/** Stores a copy of `raw` unless an identical backup already exists. */
export function backupRaw(raw: string): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "Browser storage is not available." };
  const existing = readBackups();
  if (existing.some((b) => b.raw === raw)) return { ok: true };
  const next = [{ savedAt: new Date().toISOString(), raw }, ...existing].slice(0, MAX_BACKUPS);
  try {
    storage.setItem(BACKUP_KEY, JSON.stringify(next));
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
  return { ok: true };
}

/** The raw stored room, exactly as saved — used for "download a copy". */
export function readRawRoom(): string | null {
  try {
    return getStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/* ---- Load / save ---- */

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

  const result = readRoom(parsed);
  if (!result.ok) return { status: "invalid", reason: result.reason };

  // Keep a copy of the pre-migration data. The stored value itself is left
  // as-is until the user saves, so nothing is overwritten behind their back.
  const backedUp = result.migratedFrom !== null ? backupRaw(raw).ok : false;
  return { status: "ok", room: result.room, migratedFrom: result.migratedFrom, backedUp };
}

/** True when the stored value is already a valid current-schema room. */
function isCurrentRoom(raw: string): boolean {
  try {
    const result = readRoom(JSON.parse(raw));
    return result.ok && result.migratedFrom === null;
  } catch {
    return false;
  }
}

/**
 * Writes the room and reads it back to confirm. If the existing stored
 * value is older-schema or unreadable, it is backed up first; if that
 * backup fails, nothing is overwritten.
 */
export function saveRoom(room: RoomConfig): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "Browser storage is not available." };

  const serialised = JSON.stringify(room);
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing !== null && existing !== serialised && !isCurrentRoom(existing)) {
      const backup = backupRaw(existing);
      if (!backup.ok) {
        return {
          ok: false,
          reason: `Your previous saved room couldn't be backed up, so it wasn't replaced. ${backup.reason}`,
        };
      }
    }
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
    const existing = storage.getItem(STORAGE_KEY);
    if (existing !== null && !isCurrentRoom(existing)) {
      const backup = backupRaw(existing);
      if (!backup.ok) {
        return {
          ok: false,
          reason: `Your previous saved room couldn't be backed up, so it wasn't removed. ${backup.reason}`,
        };
      }
    }
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
  return { ok: true };
}
