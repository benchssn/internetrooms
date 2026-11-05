import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import { validateEmail } from "../../auth/validation";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AccountsUnavailable, AuthLayout, Field, FormAlert, FormNotice } from "./AuthForm";
import styles from "./auth.module.css";

export function ForgotPasswordPage() {
  useDocumentTitle("Reset your password");
  const { status, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (status === "unavailable") {
    return (
      <AuthLayout title="reset your password">
        <AccountsUnavailable />
      </AuthLayout>
    );
  }

  if (sent) {
    return (
      <AuthLayout title="check your email">
        <FormNotice>
          <p>
            If there's an account for <span className={styles.email}>{email.trim()}</span>, we've
            sent it a link to choose a new password.
          </p>
          <p>Open the link in this browser. It can only be used once and expires after a while.</p>
        </FormNotice>
        <div className={styles.links}>
          <p>
            <Link to="/login">Back to log in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateEmail(email);
    setError(problem);
    setFormError(null);
    if (problem) return;
    setPending(true);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (result.ok) setSent(true);
    else setFormError(result.message);
  };

  return (
    <AuthLayout
      title="reset your password"
      lead="Enter the email address you registered with and we'll send you a link to choose a new password."
    >
      {formError ? (
        <FormAlert>
          <p>{formError}</p>
        </FormAlert>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
        <Field
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          required
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={pending || status === "loading"}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <p>
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
