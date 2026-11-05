import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth, type CallbackResult } from "../../auth/authContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AuthLayout, FormAlert, FormNotice } from "./AuthForm";
import styles from "./auth.module.css";

/**
 * Landing page for links in Supabase emails (verification and password
 * reset). Exchanges the one-time code for a session, then removes the code
 * from the address bar and history. Tokens are never displayed or logged.
 */
export function AuthCallbackPage() {
  useDocumentTitle("Signing you in");
  const { completeCallback } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<CallbackResult | null>(null);
  // Read once: the URL is cleaned up after processing.
  const initial = useRef({ search: window.location.search, hash: window.location.hash });

  useEffect(() => {
    const lifetime = new AbortController();
    void completeCallback(initial.current.search, initial.current.hash).then((outcome) => {
      if (lifetime.signal.aborted) return;
      // The code is single-use; keep it out of the address bar and history.
      if (window.location.search || window.location.hash) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
      if (outcome.kind === "recovery") {
        navigate("/reset-password", { replace: true });
        return;
      }
      setResult(outcome);
    });
    return () => lifetime.abort();
  }, [completeCallback, navigate]);

  if (!result) {
    return (
      <AuthLayout title="one moment">
        <p role="status" className={styles.lead}>
          Checking your link…
        </p>
      </AuthLayout>
    );
  }

  if (result.kind === "verified") {
    return (
      <AuthLayout title="you're in">
        <FormNotice>
          <p>Your email address is verified and you're logged in.</p>
        </FormNotice>
        <div className={styles.actions}>
          <Link to="/edit" className={styles.submit}>
            Go to your room
          </Link>
          <Link to="/" className={styles.secondary}>
            Homepage
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const otherBrowser =
    result.kind === "error" &&
    (result.code === "pkce_code_verifier_not_found" ||
      result.code === "bad_code_verifier" ||
      result.code === "flow_state_not_found");

  return (
    <AuthLayout title="that link didn't work">
      <FormAlert>
        <p>{result.kind === "error" ? result.message : null}</p>
        {otherBrowser ? (
          <p>
            If this was a verification link, your address may already be confirmed — try logging
            in. For a password reset, request a new link and open it in this browser.
          </p>
        ) : (
          <p>You can request a new link below.</p>
        )}
      </FormAlert>
      <div className={styles.actions}>
        <Link to="/login" className={styles.submit}>
          Log in
        </Link>
        <Link to="/forgot-password" className={styles.secondary}>
          New password reset link
        </Link>
      </div>
      <div className={styles.links}>
        <p>
          Need a new verification email? <Link to="/login">Log in</Link> and we'll offer to send one.
        </p>
      </div>
    </AuthLayout>
  );
}
