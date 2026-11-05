import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { getDefaultRoom } from "../data/defaultRoom";
import {
  clearSavedRoom,
  loadRoom,
  saveRoom,
  type SaveResult,
} from "../storage/roomStorage";
import { applyTemplate } from "../templates/applyTemplate";
import type { RoomConfig, TemplateId } from "../types/room";
import {
  getFieldErrors,
  roomsEqual,
  type FieldErrors,
} from "../validation/roomValidation";

/** How many undo steps are kept. */
export const HISTORY_LIMIT = 30;
/** Typing in the same field within this window is grouped into one step. */
export const COALESCE_WINDOW_MS = 1500;

export interface LoadNotice {
  kind: "invalid" | "unavailable" | "migrated";
  message: string;
}

export type SaveOutcome =
  | { ok: true }
  | { ok: false; reason: "validation"; errorCount: number }
  | { ok: false; reason: "storage"; message: string };

export interface UpdateOptions {
  /**
   * Edits sharing a key (e.g. a field path) that arrive close together
   * become a single undo step, so undo doesn't go one keystroke at a time.
   */
  coalesceKey?: string;
}

export type RoomUpdater = (room: RoomConfig) => RoomConfig;

/* ------------------------------------------------------------------ */
/* Initial load                                                        */
/* ------------------------------------------------------------------ */

interface InitialState {
  room: RoomConfig;
  notice: LoadNotice | null;
  /** True when `room` came from a valid saved copy in localStorage. */
  fromStorage: boolean;
}

function readInitialState(): InitialState {
  const result = loadRoom();
  switch (result.status) {
    case "ok":
      return {
        room: result.room,
        fromStorage: true,
        notice:
          result.migratedFrom === null
            ? null
            : {
                kind: "migrated",
                message: result.backedUp
                  ? "Your room was upgraded to the new room format. A backup of the previous version is kept in this browser, and nothing changes in storage until you save."
                  : "Your room was upgraded to the new room format. Nothing changes in storage until you save.",
              },
      };
    case "empty":
      return { room: getDefaultRoom(), notice: null, fromStorage: false };
    case "invalid":
      return {
        room: getDefaultRoom(),
        fromStorage: false,
        notice: {
          kind: "invalid",
          message: `Your saved room couldn't be loaded, so the default room is shown instead. ${result.reason} The saved data has been left untouched — you can download a copy below. Saving or resetting will back it up and then replace it.`,
        },
      };
    case "unavailable":
      return {
        room: getDefaultRoom(),
        fromStorage: false,
        notice: {
          kind: "unavailable",
          message: `${result.reason} You can still edit your room, but changes may not be saved.`,
        },
      };
  }
}

/* ------------------------------------------------------------------ */
/* History reducer                                                     */
/* ------------------------------------------------------------------ */

interface HistoryState {
  draft: RoomConfig;
  past: RoomConfig[];
  future: RoomConfig[];
  lastKey: string | null;
  lastTime: number;
}

type HistoryAction =
  | { type: "edit"; updater: RoomUpdater; key: string | null; now: number }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "edit": {
      const next = action.updater(state.draft);
      if (next === state.draft) return state;
      const coalesce =
        action.key !== null &&
        action.key === state.lastKey &&
        action.now - state.lastTime < COALESCE_WINDOW_MS;
      return {
        draft: next,
        past: coalesce ? state.past : [...state.past, state.draft].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.key,
        lastTime: action.now,
      };
    }
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        lastKey: null,
        lastTime: 0,
      };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        draft: next,
        past: [...state.past, state.draft].slice(-HISTORY_LIMIT),
        future: rest,
        lastKey: null,
        lastTime: 0,
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useRoomDraft() {
  const [initial] = useState(readInitialState);
  const [savedRoom, setSavedRoom] = useState<RoomConfig>(initial.room);
  const [history, dispatch] = useReducer(historyReducer, {
    draft: initial.room,
    past: [],
    future: [],
    lastKey: null,
    lastTime: 0,
  });
  const draftRoom = history.draft;
  const [loadNotice, setLoadNotice] = useState<LoadNotice | null>(initial.notice);
  const [hasSavedRoom, setHasSavedRoom] = useState(initial.fromStorage);
  /** After a failed save, "required" errors are shown everywhere. */
  const [showAllErrors, setShowAllErrors] = useState(false);

  const isDirty = useMemo(() => !roomsEqual(savedRoom, draftRoom), [savedRoom, draftRoom]);
  const fieldErrors: FieldErrors = useMemo(() => getFieldErrors(draftRoom), [draftRoom]);

  const updateDraft = useCallback((updater: RoomUpdater, options: UpdateOptions = {}) => {
    dispatch({ type: "edit", updater, key: options.coalesceKey ?? null, now: Date.now() });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const save = useCallback((): SaveOutcome => {
    const errors = getFieldErrors(draftRoom);
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      setShowAllErrors(true);
      return { ok: false, reason: "validation", errorCount };
    }

    const result: SaveResult = saveRoom(draftRoom);
    if (!result.ok) return { ok: false, reason: "storage", message: result.reason };

    setSavedRoom(draftRoom);
    setHasSavedRoom(true);
    setShowAllErrors(false);
    setLoadNotice(null);
    return { ok: true };
  }, [draftRoom]);

  /**
   * Restores the bundled example room and removes the saved copy (after
   * backing up anything that isn't a current-format room). The draft reset
   * itself can be undone. If storage can't be cleared, the draft still
   * resets but stays marked as unsaved so the user isn't misled.
   */
  const resetToDefault = useCallback((): SaveResult => {
    const fresh = getDefaultRoom();
    const result = clearSavedRoom();
    updateDraft(() => fresh);
    setShowAllErrors(false);
    if (result.ok) {
      setSavedRoom(fresh);
      setHasSavedRoom(false);
      setLoadNotice(null);
    }
    return result;
  }, [updateDraft]);

  /**
   * Switches the draft to another template (applying its default colours
   * and background) while keeping all content. Undoable; nothing is saved
   * until the user saves.
   */
  const selectTemplate = useCallback(
    (id: TemplateId) => updateDraft((current) => applyTemplate(current, id)),
    [updateDraft],
  );

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
    hasSavedRoom,
    isDirty,
    fieldErrors,
    showAllErrors,
    loadNotice,
    updateDraft,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    save,
    resetToDefault,
    selectTemplate,
    dismissLoadNotice,
  };
}

export type RoomDraft = ReturnType<typeof useRoomDraft>;
