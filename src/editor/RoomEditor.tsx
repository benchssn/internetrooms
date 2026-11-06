import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AccountNav } from "../components/AccountNav/AccountNav";
import type { RoomDraft } from "../hooks/useRoomDraft";
import { readRawRoom } from "../storage/roomStorage";
import { RoomRenderer } from "../templates/RoomRenderer";
import type { FieldError } from "../validation/roomValidation";
import type { SectionProps } from "./editorUtils";
import styles from "./RoomEditor.module.css";
import { BackgroundSection } from "./sections/BackgroundSection";
import { DecorationsSection } from "./sections/DecorationsSection";
import { IdentitySection } from "./sections/IdentitySection";
import { ImageLibrarySection } from "./sections/ImageLibrarySection";
import { LayoutSection } from "./sections/LayoutSection";
import { PUBLISH_SECTION_ID, PublishSection } from "./sections/PublishSection";
import { TemplateSection } from "./sections/TemplateSection";
import { ThemeSection } from "./sections/ThemeSection";
import { TypographySection } from "./sections/TypographySection";

export const PREVIEW_BUTTON_ID = "ed-preview-button";
const SUCCESS_TIMEOUT_MS = 4000;
const UNDO_TOAST_TIMEOUT_MS = 8000;

type Flash =
  | { kind: "success"; text: string; key: number; undo?: boolean }
  | { kind: "error"; text: string; key: number };

type Device = "desktop" | "mobile";

export interface RoomEditorProps {
  draft: RoomDraft;
  onPreview: () => void;
  /** Optional message to show once on arrival (e.g. after a template switch). */
  initialMessage?: string | null;
}

/** True when keyboard focus is somewhere the browser's own undo applies. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "color", "file", "range"].includes(target.type);
  }
  return false;
}

/** Offers the raw saved data as a file, so damaged rooms can be recovered. */
function downloadSavedData() {
  const raw = readRawRoom();
  if (raw === null) return;
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "internetrooms-room-backup.json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RoomEditor({ draft, onPreview, initialMessage }: RoomEditorProps) {
  const {
    draftRoom,
    savedRoom,
    isDirty,
    fieldErrors,
    showAllErrors,
    loadNotice,
    updateDraft,
    undo,
    redo,
    canUndo,
    canRedo,
    save,
    resetToDefault,
    dismissLoadNotice,
  } = draft;

  const [flash, setFlash] = useState<Flash | null>(() =>
    initialMessage ? { kind: "success", text: initialMessage, key: Date.now() } : null,
  );
  const [announcement, setAnnouncement] = useState("");
  const [device, setDevice] = useState<Device>("desktop");

  // Success messages fade away on their own; errors stay until replaced.
  useEffect(() => {
    if (flash?.kind !== "success") return;
    const timer = window.setTimeout(
      () => setFlash(null),
      flash.undo ? UNDO_TOAST_TIMEOUT_MS : SUCCESS_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [flash]);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const notifyUndoable = useCallback((message: string) => {
    setFlash({ kind: "success", text: message, key: Date.now(), undo: true });
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
    announce("Undone.");
  }, [canUndo, undo, announce]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
    announce("Redone.");
  }, [canRedo, redo, announce]);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl+Y to redo. Inside text
  // fields the browser's own undo is left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  const errorFor = useCallback(
    (path: string): FieldError | undefined => {
      const error = fieldErrors[path];
      if (!error) return undefined;
      // "Required" errors only appear after the user tries to save, so
      // freshly added empty entries don't shout at them.
      if (error.kind === "required" && !showAllErrors) return undefined;
      return error;
    },
    [fieldErrors, showAllErrors],
  );

  const hasErrorsUnder = useCallback(
    (prefix: string) => Object.keys(fieldErrors).some((path) => path.startsWith(prefix)),
    [fieldErrors],
  );

  const handleSave = () => {
    const outcome = save();
    const key = Date.now();
    if (outcome.ok) {
      setFlash({ kind: "success", text: "Room saved! ★", key });
    } else if (outcome.reason === "validation") {
      setFlash({
        kind: "error",
        key,
        text: `Not saved yet: ${outcome.errorCount} ${
          outcome.errorCount === 1 ? "field needs" : "fields need"
        } attention. Widgets with problems are opened below — look for the ⚠ messages.`,
      });
    } else {
      setFlash({
        kind: "error",
        key,
        text: `Couldn't save your room. ${outcome.message} Your changes are still here — try again.`,
      });
    }
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset your room to the original Classic Web example?\n\nThis replaces your saved room. You can undo the change in the editor until you leave the page, but the saved copy will be removed.",
    );
    if (!confirmed) return;
    const result = resetToDefault();
    const key = Date.now();
    if (result.ok) {
      setFlash({ kind: "success", text: "Room reset to the original template.", key, undo: true });
    } else {
      setFlash({
        kind: "error",
        key,
        text: `The editor was reset, but your saved room couldn't be cleared. ${result.reason}`,
      });
    }
  };

  const sectionProps: SectionProps = {
    room: draftRoom,
    update: updateDraft,
    errorFor,
    hasErrorsUnder,
    showAllErrors,
    announce,
    notifyUndoable,
  };

  return (
    <div className={styles.app}>
      <header className={styles.toolbar}>
        <div className={styles.brand}>
          <Link to="/" className={styles.brandLink}>
            <span aria-hidden="true" className={styles.brandStar}>
              ★
            </span>
            <span className={styles.brandName}>internetrooms</span>
          </Link>
          <span className={styles.brandSub}>room editor</span>
        </div>

        <nav aria-label="Site" className={styles.siteNav}>
          <Link to="/templates">Templates</Link>
          <Link to="/room">My room</Link>
        </nav>
        <AccountNav tone="toolbar" />

        <p
          className={`${styles.saveState} ${isDirty ? styles.saveStateDirty : styles.saveStateClean}`}
          data-testid="save-state"
        >
          <span aria-hidden="true">{isDirty ? "● " : "✓ "}</span>
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </p>

        <div className={styles.actions}>
          <div className={styles.historyButtons} role="group" aria-label="History">
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={handleUndo}
              disabled={!canUndo}
              aria-keyshortcuts="Control+Z Meta+Z"
              title="Undo (Ctrl/⌘ + Z)"
            >
              <span aria-hidden="true">↶ </span>Undo
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={handleRedo}
              disabled={!canRedo}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
              title="Redo (Ctrl/⌘ + Shift + Z)"
            >
              <span aria-hidden="true">↷ </span>Redo
            </button>
          </div>
          <button type="button" className={styles.primaryButton} onClick={handleSave}>
            Save
          </button>
          <a
            href={`#${PUBLISH_SECTION_ID}`}
            className={styles.toolbarButton}
            onClick={(event) => {
              event.preventDefault();
              const target = document.getElementById(PUBLISH_SECTION_ID);
              target?.scrollIntoView({ block: "start" });
              target?.focus({ preventScroll: true });
            }}
          >
            Publish
          </a>
          <button
            id={PREVIEW_BUTTON_ID}
            type="button"
            className={styles.toolbarButton}
            onClick={onPreview}
          >
            Preview
          </button>
          <button type="button" className={styles.toolbarButton} onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {loadNotice ? (
          <div
            className={loadNotice.kind === "migrated" ? styles.infoBanner : styles.warningBanner}
            role={loadNotice.kind === "migrated" ? "status" : "alert"}
          >
            <p>
              <span aria-hidden="true">{loadNotice.kind === "migrated" ? "ℹ " : "⚠ "}</span>
              {loadNotice.message}
            </p>
            <div className={styles.bannerActions}>
              {loadNotice.kind === "invalid" ? (
                <button type="button" className={styles.smallButton} onClick={downloadSavedData}>
                  Download saved data
                </button>
              ) : null}
              <button type="button" className={styles.smallButton} onClick={dismissLoadNotice}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {/* Persistent live regions so screen readers reliably announce. */}
        <div role="status" className={styles.statusRegion}>
          {flash?.kind === "success" ? (
            <div key={flash.key} className={styles.successToast}>
              <p>
                <span aria-hidden="true">✓ </span>
                {flash.text}
              </p>
              {flash.undo && canUndo ? (
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => {
                    handleUndo();
                    setFlash(null);
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {flash?.kind === "error" ? (
          <div key={flash.key} role="alert" className={styles.errorBanner}>
            <p>{flash.text}</p>
            <button type="button" className={styles.smallButton} onClick={() => setFlash(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.layout}>
        <section className={styles.controls} aria-labelledby="ed-controls-title">
          <h1 id="ed-controls-title" className={styles.visuallyHidden}>
            Customise your room
          </h1>
          <a href="#live-preview" className={styles.jumpLink}>
            <span aria-hidden="true">↓</span>Jump to live preview
          </a>

          <PublishSection {...sectionProps} />
          <TemplateSection {...sectionProps} />
          <IdentitySection {...sectionProps} />
          <LayoutSection {...sectionProps} />
          <ThemeSection {...sectionProps} />
          <TypographySection {...sectionProps} />
          <BackgroundSection {...sectionProps} />
          <DecorationsSection {...sectionProps} />
          <ImageLibrarySection {...sectionProps} savedRoom={savedRoom} />
        </section>

        <section
          id="live-preview"
          className={styles.preview}
          aria-labelledby="ed-preview-title"
          tabIndex={-1}
        >
          <div className={styles.previewHeader}>
            <h2 id="ed-preview-title" className={styles.previewLabel}>
              <span aria-hidden="true">◉ </span>Live preview
            </h2>
            <div className={styles.deviceToggle} role="group" aria-label="Preview size">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={styles.deviceButton}
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                >
                  <span aria-hidden="true">{d === "desktop" ? "▭ " : "▯ "}</span>
                  {d === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.previewFrame} data-device={device}>
            <div className={styles.previewViewport} data-testid="preview-viewport">
              <RoomRenderer room={draftRoom} />
            </div>
          </div>
        </section>
      </div>

      <div className={styles.visuallyHidden} aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
