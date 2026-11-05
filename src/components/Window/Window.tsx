import { useId, type ReactNode } from "react";
import styles from "./Window.module.css";

export interface WindowProps {
  /** Visible title-bar text. When null, the bar shows only decorations. */
  title: string | null;
  /** Accessible name used when there is no visible title. */
  label?: string;
  children: ReactNode;
  className?: string;
}

export function Window({ title, label, children, className }: WindowProps) {
  const titleId = useId();
  const rootClassName = className
    ? `${styles.window} ${className}`
    : styles.window;

  return (
    <section
      className={rootClassName}
      aria-labelledby={title !== null ? titleId : undefined}
      aria-label={title === null ? label : undefined}
    >
      <div className={styles.titleBar}>
        {title !== null ? (
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        ) : (
          <span />
        )}
        <div className={styles.decorations} aria-hidden="true">
          <span className={styles.decorBtn} />
          <span className={styles.decorBtn} />
          <span className={styles.decorBtn} />
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
