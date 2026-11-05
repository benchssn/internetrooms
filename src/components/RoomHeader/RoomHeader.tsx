import styles from "./RoomHeader.module.css";

export interface RoomHeaderProps {
  title: string;
  tagline: string;
}

export function RoomHeader({ title, tagline }: RoomHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <p className={styles.brand}>Internetrooms</p>
        <span className={styles.status} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          online
        </span>
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.tagline}>{tagline}</p>
      <div className={styles.stars} aria-hidden="true">
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
        <img src="/assets/icons/star.svg" alt="" width={16} height={16} />
      </div>
    </header>
  );
}
