import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { RoomDraft } from "../hooks/useRoomDraft";
import { RoomRenderer } from "../templates/RoomRenderer";
import type { FieldError } from "../validation/roomValidation";
import type { SectionProps } from "./editorUtils";
import styles from "./RoomEditor.module.css";
import { AboutSection } from "./sections/AboutSection";
import { BackgroundSection } from "./sections/BackgroundSection";
import { GallerySection } from "./sections/GallerySection";
import { IdentitySection } from "./sections/IdentitySection";
import { LinksSection } from "./sections/LinksSection";
import { MusicSection } from "./sections/MusicSection";
import { TemplateSection } from "./sections/TemplateSection";
import { ThemeSection } from "./sections/ThemeSection";
import { WidgetsSection } from "./sections/WidgetsSection";

export const PREVIEW_BUTTON_ID = "ed-preview-button";
const SUCCESS_TIMEOUT_MS = 4000;

type Flash =
  | { kind: "success"; text: string; key: number }
  | { kind: "error"; text: string; key: number };

export interface RoomEditorProps {
  draft: RoomDraft;
  onPreview: () => void;
  /** Optional message to show once on arrival (e.g. after a template switch). */
  initialMessage?: string | null;
}

export function RoomEditor({ draft, onPreview, initialMessage }: RoomEditorProps) {
  const {
    draftRoom,
    isDirty,
    fieldErrors,
    showAllErrors,
    loadNotice,
    updateDraft,
    save,
    resetToDefault,
    dismissLoadNotice,
  } = draft;

  const [flash, setFlash] = useState<Flash | null>(() =>
    initialMessage
      ? { kind: "success", text: initialMessage, key: Date.now() }
      : null,
  );
  const [announcement, setAnnouncement] = useState("");

  // Success messages fade away on their own; errors stay until replaced.
  useEffect(() => {
    if (flash?.kind !== "success") return;
    const timer = window.setTimeout(() => setFlash(null), SUCCESS_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

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
        } attention. Look for the ⚠ messages below.`,
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
      "Reset your room to the original Classic Web template?\n\nThis replaces your saved room and can't be undone.",
    );
    if (!confirmed) return;
    const result = resetToDefault();
    const key = Date.now();
    if (result.ok) {
      setFlash({ kind: "success", text: "Room reset to the original template.", key });
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
    announce,
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

        <p
          className={`${styles.saveState} ${
            isDirty ? styles.saveStateDirty : styles.saveStateClean
          }`}
          data-testid="save-state"
        >
          <span aria-hidden="true">{isDirty ? "● " : "✓ "}</span>
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
          >
            Save
          </button>
          <button
            id={PREVIEW_BUTTON_ID}
            type="button"
            className={styles.toolbarButton}
            onClick={onPreview}
          >
            Preview
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {loadNotice ? (
          <div className={styles.warningBanner} role="alert">
            <p>
              <span aria-hidden="true">⚠ </span>
              {loadNotice.message}
            </p>
            <button
              type="button"
              className={styles.smallButton}
              onClick={dismissLoadNotice}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Persistent live regions so screen readers reliably announce. */}
        <div role="status" className={styles.statusRegion}>
          {flash?.kind === "success" ? (
            <p key={flash.key} className={styles.successToast}>
              <span aria-hidden="true">✓ </span>
              {flash.text}
            </p>
          ) : null}
        </div>
        {flash?.kind === "error" ? (
          <div key={flash.key} role="alert" className={styles.errorBanner}>
            <p>{flash.text}</p>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => setFlash(null)}
            >
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
            <span aria-hidden="true">↓ </span>Jump to live preview
          </a>

          <TemplateSection {...sectionProps} />
          <IdentitySection {...sectionProps} />
          <ThemeSection {...sectionProps} />
          <BackgroundSection {...sectionProps} />
          <AboutSection {...sectionProps} />
          <GallerySection {...sectionProps} />
          <MusicSection {...sectionProps} />
          <LinksSection {...sectionProps} />
          <WidgetsSection {...sectionProps} />
        </section>

        <section
          id="live-preview"
          className={styles.preview}
          aria-labelledby="ed-preview-title"
          tabIndex={-1}
        >
          <h2 id="ed-preview-title" className={styles.previewLabel}>
            <span aria-hidden="true">◉ </span>Live preview
          </h2>
          <div className={styles.previewFrame}>
            <RoomRenderer room={draftRoom} />
          </div>
        </section>
      </div>

      <div className={styles.visuallyHidden} aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
