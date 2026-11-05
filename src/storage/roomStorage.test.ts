import { describe, expect, it, vi } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import { legacyRoomV1 } from "../test/rooms";
import {
  BACKUP_KEY,
  clearSavedRoom,
  loadRoom,
  readBackups,
  readRawRoom,
  saveRoom,
  STORAGE_KEY,
} from "./roomStorage";

describe("roomStorage", () => {
  it("uses the versioned storage key", () => {
    expect(STORAGE_KEY).toBe("internetrooms:room:room-001:v2");
  });

  it("reports empty storage", () => {
    expect(loadRoom()).toEqual({ status: "empty" });
  });

  it("round-trips a saved room", () => {
    const room = getDefaultRoom();
    room.title = "saved title";
    expect(saveRoom(room)).toEqual({ ok: true });
    const loaded = loadRoom();
    expect(loaded).toMatchObject({ status: "ok", migratedFrom: null });
    if (loaded.status === "ok") expect(loaded.room.title).toBe("saved title");
  });

  it("migrates a saved v1 room on load, backing it up first and leaving it in place", () => {
    const raw = JSON.stringify(legacyRoomV1());
    localStorage.setItem(STORAGE_KEY, raw);

    const loaded = loadRoom();
    expect(loaded).toMatchObject({ status: "ok", migratedFrom: 1, backedUp: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(readBackups().map((b) => b.raw)).toEqual([raw]);
  });

  it("reports corrupted JSON as invalid without removing it", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadRoom().status).toBe("invalid");
    expect(readRawRoom()).toBe("{not json");
  });

  it("backs up unreadable data before saving over it", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(saveRoom(getDefaultRoom())).toEqual({ ok: true });
    expect(readBackups()[0].raw).toBe("{not json");
  });

  it("refuses to overwrite legacy data if the backup can't be written", () => {
    const raw = JSON.stringify(legacyRoomV1());
    localStorage.setItem(STORAGE_KEY, raw);
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === BACKUP_KEY) throw new DOMException("full", "QuotaExceededError");
      realSetItem.call(this, key, value);
    });
    const result = saveRoom(getDefaultRoom());
    expect(result.ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("does not create backups when overwriting a current-format room", () => {
    saveRoom(getDefaultRoom());
    const changed = getDefaultRoom();
    changed.title = "v2 again";
    saveRoom(changed);
    expect(readBackups()).toEqual([]);
  });

  it("keeps at most three distinct backups, newest first", () => {
    for (const n of [1, 2, 3, 4]) {
      localStorage.setItem(STORAGE_KEY, `{broken ${n}`);
      saveRoom(getDefaultRoom());
    }
    expect(readBackups().map((b) => b.raw)).toEqual(["{broken 4", "{broken 3", "{broken 2"]);
  });

  it("reports a failed write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(saveRoom(getDefaultRoom())).toEqual({ ok: false, reason: "Browser storage is full." });
  });

  it("reports a write that can't be confirmed", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    expect(saveRoom(getDefaultRoom()).ok).toBe(false);
  });

  it("reports unreadable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadRoom().status).toBe("unavailable");
  });

  it("clears the saved room, backing up legacy data first", () => {
    const raw = JSON.stringify(legacyRoomV1());
    localStorage.setItem(STORAGE_KEY, raw);
    expect(clearSavedRoom()).toEqual({ ok: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(readBackups()[0].raw).toBe(raw);
  });
});
