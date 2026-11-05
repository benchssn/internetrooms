import { createContext, useContext } from "react";
import type { RoomDraft } from "./useRoomDraft";

/**
 * Shares one room draft across every page, so unsaved edits survive
 * moving between /templates, /edit and /room.
 */
export const RoomDraftContext = createContext<RoomDraft | null>(null);

export function useRoomDraftContext(): RoomDraft {
  const draft = useContext(RoomDraftContext);
  if (!draft) {
    throw new Error("useRoomDraftContext must be used inside <RoomDraftProvider>");
  }
  return draft;
}
