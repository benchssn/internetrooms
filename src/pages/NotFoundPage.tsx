import { Link, useLocation } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { Window } from "../components/Window/Window";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import styles from "./pages.module.css";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  const { pathname } = useLocation();

  return (
    <SiteLayout>
      <Window title="error.exe">
        <div className={styles.notFound}>
          <p className={styles.notFoundCode} aria-hidden="true">
            404
          </p>
          <h1 className={styles.pageTitle}>this room doesn't exist (yet)</h1>
          <p>
            We looked everywhere for <code className={styles.path}>{pathname}</code>{" "}
            but this corner of the internet is empty. Maybe it was never built,
            or maybe it wandered off.
          </p>
          <div className={styles.heroActions}>
            <Link to="/" className={styles.primaryAction}>
              Go to the homepage
            </Link>
            <Link to="/templates" className={styles.secondaryAction}>
              Browse templates
            </Link>
            <Link to="/edit" className={styles.secondaryAction}>
              Edit your room
            </Link>
          </div>
        </div>
      </Window>
    </SiteLayout>
  );
}
