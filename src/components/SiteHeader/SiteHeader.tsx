import { Link, NavLink } from "react-router";
import styles from "./SiteHeader.module.css";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/templates", label: "Templates", end: false },
  { to: "/edit", label: "Edit room", end: false },
  { to: "/room", label: "My room", end: false },
] as const;

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          internetrooms
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
