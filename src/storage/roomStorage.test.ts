import { describe, expect, it, vi } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import { clearSavedRoom, loadRoom, saveRoom, STORAGE_KEY } from "./roomStorage";

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
    expect(loaded.status).toBe("ok");
    if (loaded.status === "ok") expect(loaded.room.title).toBe("saved title");
  });

  it("reports corrupted JSON as invalid without removing it", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadRoom().status).toBe("invalid");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{not json");
  });

  it("reports structurally invalid data as invalid", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...getDefaultRoom(), links: "nope" }),
    );
    expect(loadRoom().status).toBe("invalid");
  });

  it("reports a failed write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const result = saveRoom(getDefaultRoom());
    expect(result).toEqual({ ok: false, reason: "Browser storage is full." });
  });

  it("reports a write that can't be confirmed", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    const result = saveRoom(getDefaultRoom());
    expect(result.ok).toBe(false);
  });

  it("reports unreadable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadRoom().status).toBe("unavailable");
  });

  it("clears the saved room", () => {
    saveRoom(getDefaultRoom());
    expect(clearSavedRoom()).toEqual({ ok: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
