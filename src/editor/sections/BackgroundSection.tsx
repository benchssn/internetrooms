import { useId } from "react";
import type { BackgroundPattern } from "../../types/room";
import {
  BACKGROUND_PATTERNS,
  DEFAULT_PATTERN,
} from "../../validation/roomValidation";
import { EditorSection } from "../EditorField";
import { PATTERN_LABELS, type SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

export function BackgroundSection({ room, update }: SectionProps) {
  const name = useId();
  const current = room.theme.backgroundPattern ?? DEFAULT_PATTERN;

  const choose = (pattern: BackgroundPattern) =>
    update((r) => ({
      ...r,
      theme: { ...r.theme, backgroundPattern: pattern },
    }));

  return (
    <EditorSection
      title="Background"
      icon="▦"
      description="A pattern drawn over your background colour."
    >
      <fieldset className={styles.patternGroup}>
        <legend className={styles.label}>Background pattern</legend>
        <div className={styles.patternGrid}>
          {BACKGROUND_PATTERNS.map((pattern) => (
            <label key={pattern} className={styles.patternOption}>
              <input
                type="radio"
                name={name}
                value={pattern}
                checked={current === pattern}
                onChange={() => choose(pattern)}
                className={styles.patternRadio}
              />
              <span
                className={styles.patternSwatch}
                data-pattern={pattern}
                style={{ backgroundColor: room.theme.backgroundColor }}
                aria-hidden="true"
              />
              <span className={styles.patternName}>
                {PATTERN_LABELS[pattern]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </EditorSection>
  );
}
