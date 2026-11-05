import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewMode } from "./editor/PreviewMode";
import { PREVIEW_BUTTON_ID, RoomEditor } from "./editor/RoomEditor";
import { useRoomDraft } from "./hooks/useRoomDraft";

type Mode = "edit" | "preview";

export default function App() {
  const draft = useRoomDraft();
  const [mode, setMode] = useState<Mode>("edit");
  const previousMode = useRef<Mode>(mode);

  const enterPreview = useCallback(() => setMode("preview"), []);
  const exitPreview = useCallback(() => setMode("edit"), []);

  // Start each mode at the top, and return focus to the Preview button
  // when coming back to the editor.
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    window.scrollTo(0, 0);
    if (mode === "edit") {
      document.getElementById(PREVIEW_BUTTON_ID)?.focus();
    }
  }, [mode]);

  if (mode === "preview") {
    return (
      <PreviewMode
        room={draft.draftRoom}
        isDirty={draft.isDirty}
        onExit={exitPreview}
      />
    );
  }

  return <RoomEditor draft={draft} onPreview={enterPreview} />;
}
