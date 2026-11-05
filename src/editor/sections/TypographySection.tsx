import { useId } from "react";
import { FONT_LABELS, FONT_STACKS, HEADING_SIZE_LABELS } from "../../templates/shared/typography";
import {
  FONT_IDS,
  HEADING_SIZES,
  TEXT_ALIGNS,
  type FontId,
  type RoomTypography,
  type TextAlign,
} from "../../types/room";
import { ColourField, EditorSection } from "../EditorField";
import { COLOUR_HINTS, type SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";
import { ContrastNote } from "./ThemeSection";

const ALIGN_LABELS: Record<TextAlign, string> = {
  template: "Template default",
  left: "Left",
  center: "Centred",
};

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontId;
  onChange: (value: FontId) => void;
}) {
  const id = useId();
  const previewFont = value === "template" ? undefined : FONT_STACKS[value];
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value as FontId)}
      >
        {FONT_IDS.map((font) => (
          <option key={font} value={font}>
            {FONT_LABELS[font]}
          </option>
        ))}
      </select>
      <p className={styles.fontPreview} style={{ fontFamily: previewFont }} aria-hidden="true">
        {value === "template" ? "Uses the template's own font" : "The quick brown fox — 0123"}
      </p>
    </div>
  );
}

export function TypographySection({ room, update }: SectionProps) {
  const { typography } = room.theme;
  const sizeName = useId();
  const alignName = useId();

  const set = (patch: Partial<RoomTypography>) =>
    update((r) => ({
      ...r,
      theme: { ...r.theme, typography: { ...r.theme.typography, ...patch } },
    }));

  return (
    <EditorSection
      title="Typography"
      icon="Aa"
      description="Fonts are chosen from ones already on visitors' devices — nothing is downloaded."
    >
      <FontSelect
        label="Heading font"
        value={typography.headingFont}
        onChange={(headingFont) => set({ headingFont })}
      />
      <FontSelect
        label="Body font"
        value={typography.bodyFont}
        onChange={(bodyFont) => set({ bodyFont })}
      />

      <fieldset className={styles.choiceGroup}>
        <legend className={styles.label}>Heading size</legend>
        <div className={styles.segmentRow}>
          {HEADING_SIZES.map((size) => (
            <label key={size} className={styles.segment}>
              <input
                type="radio"
                name={sizeName}
                checked={typography.headingSize === size}
                onChange={() => set({ headingSize: size })}
              />
              <span>{HEADING_SIZE_LABELS[size]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.choiceGroup}>
        <legend className={styles.label}>Text alignment</legend>
        <div className={styles.segmentRow}>
          {TEXT_ALIGNS.map((align) => (
            <label key={align} className={styles.segment}>
              <input
                type="radio"
                name={alignName}
                checked={typography.align === align}
                onChange={() => set({ align })}
              />
              <span>{ALIGN_LABELS[align]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ColourField
        label="Text colour"
        hint={COLOUR_HINTS.textColor}
        value={room.theme.textColor}
        onChange={(textColor) =>
          update((r) => ({ ...r, theme: { ...r.theme, textColor } }), {
            coalesceKey: "theme.textColor",
          })
        }
      />
      <ContrastNote room={room} />
    </EditorSection>
  );
}
