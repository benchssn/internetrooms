import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../auth/authContext";
import { safeNextPath } from "../../auth/validation";
import { useProfile } from "../../cloud/profileContext";
import styles from "./AccountNav.module.css";

export interface AccountNavProps {
  /** "site" for the white site header, "toolbar" for the editor's blue bar. */
  tone?: "site" | "toolbar";
}

/**
 * Shows who is signed in, with log in / register / log out actions.
 * Renders nothing when accounts are unavailable, and a fixed-size
 * placeholder while the session is being restored (no layout jump).
 */
export function AccountNav({ tone = "site" }: AccountNavProps) {
  const { status, user, signOut } = useAuth();
  const { status: profileStatus, profile } = useProfile();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const className = `${styles.account} ${tone === "toolbar" ? styles.toolbar : styles.site}`;

  if (status === "unavailable") return null;
  if (status === "loading") {
    return <div className={className} aria-hidden="true" data-testid="account-loading" />;
  }

  if (status === "signed-out") {
    const next = safeNextPath(location.pathname, "");
    return (
      <div className={className} role="group" aria-label="Account">
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className={styles.link}>
          Log in
        </Link>
        <Link to="/register" className={styles.link}>
          Register
        </Link>
      </div>
    );
  }

  return (
    <div className={className} role="group" aria-label="Account">
      {profileStatus === "ready" && profile ? (
        <Link to="/settings" className={styles.link} title="Your profile and room settings">
          <span className={styles.visuallyHidden}>Signed in as </span>@{profile.username}
        </Link>
      ) : profileStatus === "missing" ? (
        <Link to="/settings" className={styles.link}>
          Choose a username
        </Link>
      ) : (
        <span className={styles.who} title={user?.email ?? undefined}>
          <span className={styles.visuallyHidden}>Signed in as </span>
          {user?.email ?? "Signed in"}
        </span>
      )}
      <button
        type="button"
        className={styles.logout}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await signOut();
          setBusy(false);
          if (!result.ok) setError(result.message);
        }}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
