import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import { AuthLayout, FormAlert, FormNotice } from "./AuthForm";
import styles from "./auth.module.css";

/** Shown on /login and /register when someone is already signed in. */
export function SignedInNotice({ title }: { title: string }) {
  const { user, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthLayout title={title}>
      <FormNotice>
        <p>
          You're logged in as <span className={styles.email}>{user?.email ?? "your account"}</span>.
        </p>
      </FormNotice>
      {error ? (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      ) : null}
      <div className={styles.actions}>
        <Link to="/edit" className={styles.submit}>
          Go to your room
        </Link>
        <button
          type="button"
          className={styles.secondary}
          onClick={async () => {
            const result = await signOut();
            if (!result.ok) setError(result.message);
          }}
        >
          Log out
        </button>
      </div>
    </AuthLayout>
  );
}
