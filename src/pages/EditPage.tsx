import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PreviewMode } from "../editor/PreviewMode";
import { PREVIEW_BUTTON_ID, RoomEditor } from "../editor/RoomEditor";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useRoomDraftContext } from "../hooks/roomDraftContext";
import type { EditNavigationState } from "./TemplatesPage";

type Mode = "edit" | "preview";

export function EditPage() {
  useDocumentTitle("Edit your room");
  const draft = useRoomDraftContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("edit");
  const previousMode = useRef<Mode>(mode);

  // A one-off message handed over from another page (e.g. a template
  // switch). Read once, then cleared so a refresh doesn't repeat it.
  const [initialMessage, setInitialMessage] = useState(
    () => (location.state as EditNavigationState | null)?.message ?? null,
  );
  useEffect(() => {
    if (initialMessage) navigate(".", { replace: true, state: null });
  }, [initialMessage, navigate]);

  const enterPreview = useCallback(() => {
    setInitialMessage(null); // don't repeat it when the editor remounts
    setMode("preview");
  }, []);
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

  return (
    <RoomEditor
      draft={draft}
      onPreview={enterPreview}
      initialMessage={initialMessage}
    />
  );
}
