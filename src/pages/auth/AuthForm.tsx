import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { SiteLayout } from "../../components/SiteLayout/SiteLayout";
import styles from "./auth.module.css";

/** Page frame for every account page: a narrow, quiet column. */
export function AuthLayout({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <SiteLayout>
      <section className={styles.panel} aria-labelledby={headingId}>
        <h1 id={headingId} className={styles.title}>
          {title}
        </h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children}
      </section>
    </SiteLayout>
  );
}

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

/** A labelled input whose error and hint are announced with it. */
export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A form-level problem, announced immediately. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      {children}
    </div>
  );
}

/** A confirmation message. */
export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <div className={styles.notice} role="status">
      {children}
    </div>
  );
}

export function ShowPasswordToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.toggle}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>Show password</label>
    </div>
  );
}

export function AccountsUnavailable() {
  return (
    <FormAlert>
      <p>Accounts aren't available right now. Everything else in Internetrooms still works — your room is saved in this browser.</p>
    </FormAlert>
  );
}

