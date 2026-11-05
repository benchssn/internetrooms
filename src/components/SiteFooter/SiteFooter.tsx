import { Link } from "react-router";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.motto}>internetrooms</p>
        <nav aria-label="Footer" className={styles.links}>
          <Link to="/">Home</Link>
          <Link to="/templates">Templates</Link>
          <Link to="/edit">Edit room</Link>
          <Link to="/room">My room</Link>
        </nav>
        <p className={styles.note}>
          Rooms are saved in your own browser. Accounts are optional. No tracking, no feeds.
        </p>
      </div>
    </footer>
  );
}
