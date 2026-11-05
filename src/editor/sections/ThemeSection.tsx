import {
  FALLBACK_TEMPLATE_ID,
  getTemplate,
  TEMPLATE_REGISTRY,
} from "../../templates/templateRegistry";
import { THEME_COLOUR_KEYS } from "../../validation/roomValidation";
import { ColourField, EditorSection } from "../EditorField";
import {
  COLOUR_HINTS,
  COLOUR_LABELS,
  contrastRatio,
  type SectionProps,
} from "../editorUtils";
import styles from "../RoomEditor.module.css";

/** Warns (gently) when text on the panel colour may be hard to read. */
export function ContrastNote({ room }: { room: SectionProps["room"] }) {
  const ratio = contrastRatio(room.theme.textColor, room.theme.primaryColor);
  if (ratio >= 4.5) return null;
  return (
    <p className={styles.notice} role="note">
      <span aria-hidden="true">◐ </span>
      Heads up: your text colour on the primary colour has a contrast of{" "}
      {ratio.toFixed(1)}:1. Visitors may find it hard to read — 4.5:1 or higher
      is recommended.
    </p>
  );
}

export function ThemeSection({ room, update, announce }: SectionProps) {
  const { theme } = room;

  const template =
    getTemplate(room.template) ?? TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID];

  const restoreColours = () => {
    const defaults = template.defaultTheme;
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
    announce(`${template.name} colours restored.`);
  };

  return (
    <EditorSection
      title="Theme colours"
      icon="🎨"
      description="Pick a colour or type a hex value like #263F88. Text colour lives under Typography."
    >
      {THEME_COLOUR_KEYS.filter((key) => key !== "textColor").map((key) => (
        <ColourField
          key={key}
          label={COLOUR_LABELS[key]}
          hint={COLOUR_HINTS[key]}
          value={theme[key]}
          onChange={(value) =>
            update((r) => ({ ...r, theme: { ...r.theme, [key]: value } }), {
              coalesceKey: `theme.${key}`,
            })
          }
        />
      ))}

      <ContrastNote room={room} />

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={restoreColours}
      >
        <span aria-hidden="true">↺ </span>Restore {template.name} colours
      </button>
    </EditorSection>
  );
}
