import { LIMITS } from "../../validation/roomValidation";
import { EditorSection, TextAreaField, TextField } from "../EditorField";
import type { SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

export function MusicSection({ room, update, errorFor, announce }: SectionProps) {
  const music = room.music;

  if (music === null) {
    return (
      <EditorSection
        title="Music"
        icon="♫"
        description="Share what you're listening to. This is text only — no audio plays."
      >
        <p className={styles.hint}>No track details yet.</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            update((r) => ({
              ...r,
              music: { title: "", artist: "", description: "" },
            }));
            announce("Track details added.");
          }}
        >
          <span aria-hidden="true">+ </span>Add track details
        </button>
      </EditorSection>
    );
  }

  return (
    <EditorSection
      title="Music"
      icon="♫"
      description="Share what you're listening to. This is text only — no audio plays."
    >
      <TextField
        label="Track title"
        required
        value={music.title}
        maxLength={LIMITS.musicTitle}
        error={errorFor("music.title")}
        onChange={(title) =>
          update((r) => ({ ...r, music: r.music && { ...r.music, title } }))
        }
      />
      <TextField
        label="Artist"
        required
        value={music.artist}
        maxLength={LIMITS.musicArtist}
        error={errorFor("music.artist")}
        onChange={(artist) =>
          update((r) => ({ ...r, music: r.music && { ...r.music, artist } }))
        }
      />
      <TextAreaField
        label="Description"
        rows={3}
        value={music.description ?? ""}
        maxLength={LIMITS.musicDescription}
        error={errorFor("music.description")}
        onChange={(description) =>
          update((r) => ({ ...r, music: r.music && { ...r.music, description } }))
        }
      />
      <button
        type="button"
        className={`${styles.secondaryButton} ${styles.dangerButton}`}
        onClick={() => {
          update((r) => ({ ...r, music: null }));
          announce("Track details removed.");
        }}
      >
        <span aria-hidden="true">✕ </span>Remove track details
      </button>
    </EditorSection>
  );
}
