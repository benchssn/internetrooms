import { useId, useState, type ReactNode } from "react";
import type { FieldError } from "../validation/roomValidation";
import { parseHexColour } from "../validation/roomValidation";
import styles from "./RoomEditor.module.css";

/* ------------------------------------------------------------------ */
/* Section wrapper                                                     */
/* ------------------------------------------------------------------ */

export interface EditorSectionProps {
  title: string;
  icon: string;
  description?: string;
  children: ReactNode;
}

export function EditorSection({
  title,
  icon,
  description,
  children,
}: EditorSectionProps) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        <span aria-hidden="true" className={styles.sectionIcon}>
          {icon}
        </span>
        {title}
      </h2>
      {description ? (
        <p className={styles.sectionDescription}>{description}</p>
      ) : null}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Text inputs                                                         */
/* ------------------------------------------------------------------ */

interface BaseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: FieldError;
  hint?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  /** Show the "12 / 80" counter. On by default. */
  showCount?: boolean;
}

function FieldFrame({
  id,
  label,
  required,
  hint,
  hintId,
  error,
  errorId,
  count,
  countId,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  hintId: string;
  error?: FieldError;
  errorId: string;
  count?: ReactNode;
  countId: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? (
            <span className={styles.requiredMark}> (required)</span>
          ) : null}
        </label>
        {count ? (
          <span id={countId} className={styles.count}>
            {count}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function useFieldIds(explicitId?: string) {
  const generated = useId();
  const id = explicitId ?? generated;
  return {
    id,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
    countId: `${id}-count`,
  };
}

function describedBy(
  ids: { hintId: string; errorId: string; countId: string },
  hasHint: boolean,
  hasError: boolean,
  hasCount: boolean,
) {
  const parts = [
    hasError ? ids.errorId : null,
    hasHint ? ids.hintId : null,
    hasCount ? ids.countId : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Format errors (e.g. a half-typed URL) appear once the user leaves the
 * field, so they don't flicker while typing. "Required" errors are only
 * passed in after a save attempt, so they show straight away.
 */
function visibleError(error: FieldError | undefined, touched: boolean) {
  if (!error) return undefined;
  return touched || error.kind === "required" ? error : undefined;
}

function Counter({ length, max }: { length: number; max: number }) {
  const near = length >= max * 0.9;
  return (
    <span className={near ? styles.countNear : undefined}>
      {`${length} / ${max} `}
      <span className={styles.visuallyHidden}>characters</span>
    </span>
  );
}

export function TextField(props: BaseFieldProps & { type?: "text" | "url" }) {
  const {
    label,
    value,
    onChange,
    maxLength,
    error,
    hint,
    required,
    placeholder,
    showCount = true,
    type = "text",
  } = props;
  const ids = useFieldIds(props.id);
  const [touched, setTouched] = useState(false);
  const shownError = visibleError(error, touched);

  return (
    <FieldFrame
      {...ids}
      label={label}
      required={required}
      hint={hint}
      error={shownError}
      count={showCount ? <Counter length={value.length} max={maxLength} /> : null}
    >
      <input
        id={ids.id}
        className={styles.input}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={describedBy(ids, !!hint, !!shownError, showCount)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        autoComplete="off"
        spellCheck={type === "url" ? false : undefined}
        inputMode={type === "url" ? "url" : undefined}
      />
    </FieldFrame>
  );
}

export function TextAreaField(props: BaseFieldProps & { rows?: number }) {
  const {
    label,
    value,
    onChange,
    maxLength,
    error,
    hint,
    required,
    placeholder,
    showCount = true,
    rows = 4,
  } = props;
  const ids = useFieldIds(props.id);
  const [touched, setTouched] = useState(false);
  const shownError = visibleError(error, touched);

  return (
    <FieldFrame
      {...ids}
      label={label}
      required={required}
      hint={hint}
      error={shownError}
      count={showCount ? <Counter length={value.length} max={maxLength} /> : null}
    >
      <textarea
        id={ids.id}
        className={styles.textarea}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={describedBy(ids, !!hint, !!shownError, showCount)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
      />
    </FieldFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Colour input: native picker + editable hex value                    */
/* ------------------------------------------------------------------ */

export interface ColourFieldProps {
  label: string;
  hint?: string;
  /** Always a valid "#RRGGBB" value. */
  value: string;
  onChange: (value: string) => void;
}

export function ColourField({ label, hint, value, onChange }: ColourFieldProps) {
  const baseId = useId();
  const pickerId = `${baseId}-picker`;
  const labelId = `${baseId}-label`;
  const hexId = `${baseId}-hex`;
  const hexLabelId = `${baseId}-hex-label`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  // The hex text box keeps its own text so users can type freely; it is
  // only committed to the room when it parses as a valid colour.
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // Follow external changes (picker, "restore colours", reset).
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
    setInvalid(false);
  }

  const handleText = (next: string) => {
    setText(next);
    const parsed = parseHexColour(next);
    if (parsed) {
      setInvalid(false);
      // Mark as synced so the user's in-progress text isn't overwritten.
      setSyncedValue(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      setInvalid(true);
    }
  };

  const handleBlur = () => {
    // Snap back to the last good colour if the text was left invalid,
    // and tidy up valid shorthand like "#abc" to "#AABBCC".
    setText(value);
    setInvalid(false);
  };

  return (
    <div className={styles.colourField}>
      <div className={styles.colourText}>
        <label id={labelId} htmlFor={pickerId} className={styles.label}>
          {label}
        </label>
        {hint ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
      <div className={styles.colourControls}>
        <input
          id={pickerId}
          className={styles.colourPicker}
          type="color"
          value={value.toLowerCase()}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => {
            const parsed = parseHexColour(e.target.value);
            if (parsed) onChange(parsed);
          }}
        />
        <label id={hexLabelId} htmlFor={hexId} className={styles.hexLabel}>
          hex
        </label>
        <input
          id={hexId}
          className={styles.hexInput}
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-labelledby={`${labelId} ${hexLabelId}`}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => handleText(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
      {invalid ? (
        <p id={errorId} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          Not a valid colour yet — use a hex value such as #263F88. The last
          valid colour is still applied.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle switch                                                       */
/* ------------------------------------------------------------------ */

export interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function ToggleField({ label, checked, onChange, hint }: ToggleFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.toggleRow}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.toggleInput}
        checked={checked}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className={styles.toggleLabel}>
        <span className={styles.toggleTrack} aria-hidden="true">
          <span className={styles.toggleThumb} />
        </span>
        <span className={styles.toggleText}>{label}</span>
        <span className={styles.toggleState} aria-hidden="true">
          {checked ? "Shown" : "Hidden"}
        </span>
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
