import { useEffect, useRef } from "react";
import { RoomRenderer } from "../templates/RoomRenderer";
import type { RoomConfig } from "../types/room";
import styles from "./RoomEditor.module.css";

export interface PreviewModeProps {
  room: RoomConfig;
  isDirty: boolean;
  onExit: () => void;
}

/**
 * Shows the draft room exactly as visitors would see it, using the same
 * RoomRenderer as the editor's live preview.
 */
export function PreviewMode({ room, isDirty, onExit }: PreviewModeProps) {
  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <>
      <aside className={styles.previewBar} aria-label="Preview controls">
        <p className={styles.previewBarText}>
          <span aria-hidden="true">◉ </span>Previewing your room
          {isDirty ? (
            <span className={styles.previewBarDirty}> · unsaved changes</span>
          ) : null}
        </p>
        <button
          ref={backButton}
          type="button"
          className={styles.primaryButton}
          onClick={onExit}
        >
          <span aria-hidden="true">← </span>Back to editing
        </button>
      </aside>
      <RoomRenderer room={room} />
    </>
  );
}
