import { useCallback, useEffect, useMemo, useState } from "react";
import { getDefaultRoom } from "../data/defaultRoom";
import {
  clearSavedRoom,
  loadRoom,
  saveRoom,
  type SaveResult,
} from "../storage/roomStorage";
import type { RoomConfig } from "../types/room";
import {
  getFieldErrors,
  roomsEqual,
  type FieldErrors,
} from "../validation/roomValidation";

export interface LoadNotice {
  kind: "invalid" | "unavailable";
  message: string;
}

export type SaveOutcome =
  | { ok: true }
  | { ok: false; reason: "validation"; errorCount: number }
  | { ok: false; reason: "storage"; message: string };

interface InitialState {
  room: RoomConfig;
  notice: LoadNotice | null;
}

function readInitialState(): InitialState {
  const result = loadRoom();
  switch (result.status) {
    case "ok":
      return { room: result.room, notice: null };
    case "empty":
      return { room: getDefaultRoom(), notice: null };
    case "invalid":
      return {
        room: getDefaultRoom(),
        notice: {
          kind: "invalid",
          message: `Your saved room couldn't be loaded, so the default room is shown instead. ${result.reason} The saved data has been left untouched — saving or resetting will replace it.`,
        },
      };
    case "unavailable":
      return {
        room: getDefaultRoom(),
        notice: {
          kind: "unavailable",
          message: `${result.reason} You can still edit your room, but changes may not be saved.`,
        },
      };
  }
}

export function useRoomDraft() {
  const [initial] = useState(readInitialState);
  const [savedRoom, setSavedRoom] = useState<RoomConfig>(initial.room);
  const [draftRoom, setDraftRoom] = useState<RoomConfig>(initial.room);
  const [loadNotice, setLoadNotice] = useState<LoadNotice | null>(
    initial.notice,
  );
  /** After a failed save, "required" errors are shown everywhere. */
  const [showAllErrors, setShowAllErrors] = useState(false);

  const isDirty = useMemo(
    () => !roomsEqual(savedRoom, draftRoom),
    [savedRoom, draftRoom],
  );

  const fieldErrors: FieldErrors = useMemo(
    () => getFieldErrors(draftRoom),
    [draftRoom],
  );

  const updateDraft = useCallback(
    (updater: (room: RoomConfig) => RoomConfig) => {
      setDraftRoom((current) => updater(current));
    },
    [],
  );

  const save = useCallback((): SaveOutcome => {
    const errors = getFieldErrors(draftRoom);
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      setShowAllErrors(true);
      return { ok: false, reason: "validation", errorCount };
    }

    const result: SaveResult = saveRoom(draftRoom);
    if (!result.ok) {
      return { ok: false, reason: "storage", message: result.reason };
    }

    setSavedRoom(draftRoom);
    setShowAllErrors(false);
    setLoadNotice(null);
    return { ok: true };
  }, [draftRoom]);

  /**
   * Restores the bundled example room and removes the saved copy.
   * If storage can't be cleared, the draft still resets but stays
   * marked as unsaved so the user isn't misled.
   */
  const resetToDefault = useCallback((): SaveResult => {
    const fresh = getDefaultRoom();
    const result = clearSavedRoom();
    setDraftRoom(fresh);
    setShowAllErrors(false);
    if (result.ok) {
      setSavedRoom(fresh);
      setLoadNotice(null);
    }
    return result;
  }, []);

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  // Warn before leaving with unsaved changes (where the browser allows it).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need returnValue set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return {
    draftRoom,
    savedRoom,
    isDirty,
    fieldErrors,
    showAllErrors,
    loadNotice,
    updateDraft,
    save,
    resetToDefault,
    dismissLoadNotice,
  };
}

export type RoomDraft = ReturnType<typeof useRoomDraft>;
