import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import {
  PASSWORD_MIN,
  validateConfirmation,
  validateNewPassword,
  type FieldErrors,
} from "../../auth/validation";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AccountsUnavailable, AuthLayout, Field, FormAlert, FormNotice, ShowPasswordToggle } from "./AuthForm";
import styles from "./auth.module.css";

type Fields = "password" | "confirmation";

/**
 * Choose a new password. Only works after arriving from a password-reset
 * email (which signs the user in for recovery) — it isn't a general
 * "change password" form.
 */
export function ResetPasswordPage() {
  useDocumentTitle("Choose a new password");
  const { status, recoveryMode, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (status === "unavailable") {
    return (
      <AuthLayout title="choose a new password">
        <AccountsUnavailable />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="password updated">
        <FormNotice>
          <p>Your password has been changed and you're logged in.</p>
        </FormNotice>
        <div className={styles.actions}>
          <Link to="/edit" className={styles.submit}>
            Go to your room
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (status === "loading") {
    return (
      <AuthLayout title="choose a new password">
        <p role="status" className={styles.lead}>
          Checking your reset link…
        </p>
      </AuthLayout>
    );
  }

  if (!recoveryMode) {
    return (
      <AuthLayout title="choose a new password">
        <FormAlert>
          <p>
            This page only works from a password-reset email, and that link has expired or has
            already been used.
          </p>
        </FormAlert>
        <div className={styles.actions}>
          <Link to="/forgot-password" className={styles.submit}>
            Send a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<Fields> = {
      password: validateNewPassword(password),
      confirmation: validateConfirmation(password, confirmation),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;
    setPending(true);
    const result = await updatePassword(password);
    setPending(false);
    if (result.ok) setDone(true);
    else setFormError(result.message);
  };

  return (
    <AuthLayout title="choose a new password">
      {formError ? (
        <FormAlert>
          <p>{formError}</p>
        </FormAlert>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
        <Field
          label="New password"
          type={showPassword ? "text" : "password"}
          name="new-password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <Field
          label="Confirm new password"
          type={showPassword ? "text" : "password"}
          name="confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          error={errors.confirmation}
          required
        />
        <ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? "Saving…" : "Save new password"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
