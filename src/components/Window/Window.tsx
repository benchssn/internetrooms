import { useId, type ReactNode } from "react";
import styles from "./Window.module.css";

export interface WindowProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Window({ title, children, className }: WindowProps) {
  const titleId = useId();
  const rootClassName = className
    ? `${styles.window} ${className}`
    : styles.window;

  return (
    <section className={rootClassName} aria-labelledby={titleId}>
      <div className={styles.titleBar}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
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
