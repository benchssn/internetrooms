import type { RoomWidgets } from "../../types/room";
import { EditorSection, ToggleField } from "../EditorField";
import type { SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

const WIDGETS: { key: Exclude<keyof RoomWidgets, "guestbook">; label: string }[] =
  [
    { key: "about", label: "About Me" },
    { key: "gallery", label: "Art Gallery" },
    { key: "music", label: "Music" },
    { key: "links", label: "Favourite Links" },
  ];

export function WidgetsSection({ room, update }: SectionProps) {
  return (
    <EditorSection
      title="Widget visibility"
      icon="◧"
      description="Hidden widgets keep their content — switch them back on any time."
    >
      <div className={styles.toggleList}>
        {WIDGETS.map(({ key, label }) => (
          <ToggleField
            key={key}
            label={`Show ${label}`}
            checked={room.widgets[key]}
            onChange={(checked) =>
              update((r) => ({ ...r, widgets: { ...r.widgets, [key]: checked } }))
            }
          />
        ))}
      </div>
      <p className={styles.hint}>
        <span aria-hidden="true">✉ </span>
        Guestbook — coming in a later version.
      </p>
    </EditorSection>
  );
}
