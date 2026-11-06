import { useId } from "react";
import { VISIBILITIES, type Visibility } from "../../cloud/cloudTypes";
import styles from "./settings.module.css";

const VISIBILITY_TEXT: Record<Visibility, { label: string; description: string }> = {
  public: { label: "Public", description: "Anyone can visit. It may appear in future Internetrooms discovery." },
  unlisted: { label: "Unlisted", description: "Only people with your private link can visit." },
  private: { label: "Private", description: "Only you can see it." },
};

export function VisibilityChoice({
  value,
  onChange,
  disabled,
  legend = "Who can see your room",
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset className={styles.visibility} disabled={disabled}>
      <legend className={styles.legend}>{legend}</legend>
      {VISIBILITIES.map((option) => (
        <label key={option} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span>
            <strong>{VISIBILITY_TEXT[option].label}</strong>
            <span className={styles.optionHint}>{VISIBILITY_TEXT[option].description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
