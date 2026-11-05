import { useId } from "react";
import {
  BACKGROUND_MODES,
  BACKGROUND_PATTERNS,
  GRADIENT_DIRECTIONS,
  IMAGE_FITS,
  type BackgroundMode,
  type BackgroundPattern,
  type GradientDirection,
  type RoomBackground,
} from "../../types/room";
import { ColourField, EditorSection } from "../EditorField";
import { PATTERN_LABELS, type SectionProps } from "../editorUtils";
import { ImageSourceField } from "../ImageSourceField";
import styles from "../RoomEditor.module.css";

const MODE_LABELS: Record<BackgroundMode, string> = {
  pattern: "Colour & pattern",
  gradient: "Gradient",
  image: "Image",
};

const DIRECTION_LABELS: Record<GradientDirection, string> = {
  "to bottom": "Top to bottom",
  "to right": "Left to right",
  "to bottom right": "Diagonal ↘",
  "to top right": "Diagonal ↗",
  radial: "Radial glow",
};

const GRADIENT_PRESETS: { name: string; from: string; to: string }[] = [
  { name: "Dusk", from: "#263F88", to: "#F4B6D2" },
  { name: "Ocean", from: "#0B3D5C", to: "#5FD3C6" },
  { name: "Lavender", from: "#E7DDFB", to: "#C9E9DF" },
  { name: "Night drive", from: "#07081A", to: "#5B3FD9" },
  { name: "Peach", from: "#FFE3C2", to: "#FF8FA3" },
];

export function BackgroundSection({ room, update, errorFor, announce }: SectionProps) {
  const modeName = useId();
  const patternName = useId();
  const fitName = useId();
  const directionId = useId();
  const background = room.theme.background;

  const setBackground = (patch: Partial<RoomBackground>, coalesceKey?: string) =>
    update(
      (r) => ({
        ...r,
        theme: { ...r.theme, background: { ...r.theme.background, ...patch } },
      }),
      coalesceKey ? { coalesceKey } : undefined,
    );

  const choosePattern = (pattern: BackgroundPattern) =>
    update((r) => ({
      ...r,
      theme: {
        ...r.theme,
        backgroundPattern: pattern,
        background: { ...r.theme.background, mode: "pattern" },
      },
    }));

  return (
    <EditorSection
      title="Background"
      icon="▦"
      description="Behind your whole room. Your settings for each type are remembered when you switch."
    >
      <fieldset className={styles.choiceGroup}>
        <legend className={styles.label}>Background type</legend>
        <div className={styles.segmentRow}>
          {BACKGROUND_MODES.map((mode) => (
            <label key={mode} className={styles.segment}>
              <input
                type="radio"
                name={modeName}
                checked={background.mode === mode}
                onChange={() => setBackground({ mode })}
              />
              <span>{MODE_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {background.mode === "pattern" ? (
        <fieldset className={styles.patternGroup}>
          <legend className={styles.label}>Pattern</legend>
          <p className={styles.hint}>Drawn over the background colour from Theme colours.</p>
          <div className={styles.patternGrid}>
            {BACKGROUND_PATTERNS.map((pattern) => (
              <label key={pattern} className={styles.patternOption}>
                <input
                  type="radio"
                  name={patternName}
                  value={pattern}
                  checked={room.theme.backgroundPattern === pattern}
                  onChange={() => choosePattern(pattern)}
                  className={styles.patternRadio}
                />
                <span
                  className={styles.patternSwatch}
                  data-pattern={pattern}
                  style={{ backgroundColor: room.theme.backgroundColor }}
                  aria-hidden="true"
                />
                <span className={styles.patternName}>{PATTERN_LABELS[pattern]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {background.mode === "gradient" ? (
        <>
          <div className={styles.presetRow} role="group" aria-label="Gradient presets">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={styles.presetButton}
                onClick={() =>
                  setBackground({ gradient: { ...background.gradient, from: preset.from, to: preset.to } })
                }
              >
                <span
                  className={styles.presetSwatch}
                  style={{ background: `linear-gradient(90deg, ${preset.from}, ${preset.to})` }}
                  aria-hidden="true"
                />
                {preset.name}
              </button>
            ))}
          </div>
          <ColourField
            label="Gradient start"
            value={background.gradient.from}
            onChange={(from) =>
              setBackground({ gradient: { ...background.gradient, from } }, "theme.gradient.from")
            }
          />
          <ColourField
            label="Gradient end"
            value={background.gradient.to}
            onChange={(to) =>
              setBackground({ gradient: { ...background.gradient, to } }, "theme.gradient.to")
            }
          />
          <div className={styles.field}>
            <label htmlFor={directionId} className={styles.label}>
              Direction
            </label>
            <select
              id={directionId}
              className={styles.select}
              value={background.gradient.direction}
              onChange={(e) =>
                setBackground({
                  gradient: { ...background.gradient, direction: e.target.value as GradientDirection },
                })
              }
            >
              {GRADIENT_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {background.mode === "image" ? (
        <>
          <ImageSourceField
            idBase="ed-bg-image"
            label="Background image"
            value={background.image.source}
            error={errorFor("theme.background.image")}
            announce={announce}
            onChange={(source, options) =>
              setBackground({ image: { ...background.image, source } }, options?.coalesceKey)
            }
          />
          <fieldset className={styles.choiceGroup}>
            <legend className={styles.label}>Image fit</legend>
            <div className={styles.segmentRow}>
              {IMAGE_FITS.map((fit) => (
                <label key={fit} className={styles.segment}>
                  <input
                    type="radio"
                    name={fitName}
                    checked={background.image.fit === fit}
                    onChange={() => setBackground({ image: { ...background.image, fit } })}
                  />
                  <span>{fit === "cover" ? "Fill the page" : "Repeat as tiles"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
    </EditorSection>
  );
}
