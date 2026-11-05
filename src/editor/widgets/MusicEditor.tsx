import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextAreaField, TextField } from "../EditorField";
import { patchWidgetContent, type WidgetEditorProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

export function MusicEditor({ widget, update, errorFor, announce }: WidgetEditorProps<"music">) {
  const id = widget.id;
  const music = widget.content.music;

  if (music === null) {
    return (
      <>
        <p className={styles.hint}>
          Share what you're listening to. This is text only — no audio plays.
        </p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            update((r) =>
              patchWidgetContent(r, id, "music", () => ({
                music: { title: "", artist: "", description: "" },
              })),
            );
            announce("Track details added.");
          }}
        >
          <span aria-hidden="true">+ </span>Add track details
        </button>
      </>
    );
  }

  const set = (field: "title" | "artist" | "description", value: string) =>
    update(
      (r) =>
        patchWidgetContent(r, id, "music", (c) => ({
          music: c.music && { ...c.music, [field]: value },
        })),
      { coalesceKey: fieldPath.widget(id, field) },
    );

  return (
    <>
      <TextField
        id={`ed-${id}-title`}
        label="Track title"
        required
        value={music.title}
        maxLength={LIMITS.musicTitle}
        error={errorFor(fieldPath.widget(id, "title"))}
        onChange={(v) => set("title", v)}
      />
      <TextField
        id={`ed-${id}-artist`}
        label="Artist"
        required
        value={music.artist}
        maxLength={LIMITS.musicArtist}
        error={errorFor(fieldPath.widget(id, "artist"))}
        onChange={(v) => set("artist", v)}
      />
      <TextAreaField
        id={`ed-${id}-description`}
        label="Description"
        rows={3}
        value={music.description ?? ""}
        maxLength={LIMITS.musicDescription}
        error={errorFor(fieldPath.widget(id, "description"))}
        onChange={(v) => set("description", v)}
      />
      <button
        type="button"
        className={`${styles.secondaryButton} ${styles.dangerButton}`}
        onClick={() => {
          update((r) => patchWidgetContent(r, id, "music", () => ({ music: null })));
          announce("Track details removed.");
        }}
      >
        <span aria-hidden="true">✕ </span>Remove track details
      </button>
    </>
  );
}
