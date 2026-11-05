import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import {
  validateConfirmation,
  validateEmail,
  validateNewPassword,
  PASSWORD_MIN,
  type FieldErrors,
} from "../../auth/validation";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AccountsUnavailable, AuthLayout, Field, FormAlert, FormNotice, ShowPasswordToggle } from "./AuthForm";
import { SignedInNotice } from "./SignedInNotice";
import styles from "./auth.module.css";

type Fields = "email" | "password" | "confirmation";

export function RegisterPage() {
  useDocumentTitle("Register");
  const { status, signUp, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | string>("idle");

  if (status === "unavailable") {
    return (
      <AuthLayout title="create an account">
        <AccountsUnavailable />
      </AuthLayout>
    );
  }
  if (status === "signed-in" && !sentTo) return <SignedInNotice title="create an account" />;

  if (sentTo) {
    return (
      <AuthLayout title="check your email">
        <FormNotice>
          <p>
            We've sent a verification link to <span className={styles.email}>{sentTo}</span>.
            Open it to confirm your address — then you can log in.
          </p>
          <p>You're not signed in yet. The link expires after a while, so use it soon.</p>
        </FormNotice>
        <div className={styles.links}>
          <p>
            Nothing arrived? Check your spam folder, or{" "}
            <button
              type="button"
              className={styles.linkButton}
              disabled={resendState === "sending"}
              onClick={async () => {
                setResendState("sending");
                const result = await resendVerification(sentTo);
                setResendState(result.ok ? "sent" : result.message);
              }}
            >
              send it again
            </button>
            .
          </p>
          {resendState === "sent" ? <p role="status">If that address needs verifying, a new link is on its way.</p> : null}
          {resendState !== "idle" && resendState !== "sending" && resendState !== "sent" ? (
            <p role="alert">{resendState}</p>
          ) : null}
          <p>
            <Link to="/login">Go to log in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<Fields> = {
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirmation: validateConfirmation(password, confirmation),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;

    setPending(true);
    const result = await signUp(email, password);
    setPending(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    // Email verification is required: the user is not signed in yet.
    if (result.needsVerification) setSentTo(email.trim());
  };

  return (
    <AuthLayout
      title="create an account"
      lead="An account will let you keep your room safe and, soon, share it. Your room still lives in this browser for now."
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
          error={errors.email}
          required
        />
        <Field
          label="Password"
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
          label="Confirm password"
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
          <button type="submit" className={styles.submit} disabled={pending || status === "loading"}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
