import type { ReactNode } from "react";
import { RoomDraftContext } from "./roomDraftContext";
import { useRoomDraft } from "./useRoomDraft";

export function RoomDraftProvider({ children }: { children: ReactNode }) {
  const draft = useRoomDraft();
  return (
    <RoomDraftContext.Provider value={draft}>{children}</RoomDraftContext.Provider>
  );
}
