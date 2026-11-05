import type { ReactNode } from "react";
import styles from "./RoomHeader.module.css";

export interface RoomHeaderProps {
  title: string;
  tagline: string;
  /** Decorations shown beside the title. */
  start?: ReactNode;
  end?: ReactNode;
}

export function RoomHeader({ title, tagline, start, end }: RoomHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <p className={styles.brand}>Internetrooms</p>
        <span className={styles.status} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          online
        </span>
      </div>
      <div className={styles.titleRow}>
        {start}
        <h1 className={styles.title}>{title}</h1>
        {end}
      </div>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
      <div className={styles.stars} aria-hidden="true">
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
      </div>
    </header>
  );
}
