import { getDefaultRoom } from "../../data/defaultRoom";
import { THEME_COLOUR_KEYS } from "../../validation/roomValidation";
import { ColourField, EditorSection } from "../EditorField";
import {
  COLOUR_HINTS,
  COLOUR_LABELS,
  contrastRatio,
  type SectionProps,
} from "../editorUtils";
import styles from "../RoomEditor.module.css";

export function ThemeSection({ room, update, announce }: SectionProps) {
  const { theme } = room;
  const ratio = contrastRatio(theme.textColor, theme.primaryColor);
  const lowContrast = ratio < 4.5;

  const restoreColours = () => {
    const defaults = getDefaultRoom().theme;
    update((r) => ({
      ...r,
      theme: {
        ...r.theme,
        backgroundColor: defaults.backgroundColor,
        primaryColor: defaults.primaryColor,
        secondaryColor: defaults.secondaryColor,
        accentColor: defaults.accentColor,
        textColor: defaults.textColor,
      },
    }));
    announce("Template colours restored.");
  };

  return (
    <EditorSection
      title="Theme colours"
      icon="🎨"
      description="Pick a colour or type a hex value like #263F88."
    >
      {THEME_COLOUR_KEYS.map((key) => (
        <ColourField
          key={key}
          label={COLOUR_LABELS[key]}
          hint={COLOUR_HINTS[key]}
          value={theme[key]}
          onChange={(value) =>
            update((r) => ({ ...r, theme: { ...r.theme, [key]: value } }))
          }
        />
      ))}

      {lowContrast ? (
        <p className={styles.notice} role="note">
          <span aria-hidden="true">◐ </span>
          Heads up: your text colour on the primary colour has a contrast of{" "}
          {ratio.toFixed(1)}:1. Visitors may find it hard to read — 4.5:1 or
          higher is recommended.
        </p>
      ) : null}

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={restoreColours}
      >
        <span aria-hidden="true">↺ </span>Restore template colours
      </button>
    </EditorSection>
  );
}
