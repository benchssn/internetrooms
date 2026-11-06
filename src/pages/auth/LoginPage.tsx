import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../auth/authContext";
import { useProfile } from "../../cloud/profileContext";
import { safeNextPath, validateEmail, validateLoginPassword, type FieldErrors } from "../../auth/validation";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AccountsUnavailable, AuthLayout, Field, FormAlert, ShowPasswordToggle } from "./AuthForm";
import { SignedInNotice } from "./SignedInNotice";
import styles from "./auth.module.css";

type Fields = "email" | "password";

export function LoginPage() {
  useDocumentTitle("Log in");
  const { status, signIn, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [formError, setFormError] = useState<{ message: string; unverified: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const { status: profileStatus } = useProfile();

  // After logging in, people without a username go to profile setup first.
  useEffect(() => {
    if (!signedIn) return;
    if (profileStatus === "missing") navigate("/settings", { replace: true });
    else if (profileStatus === "ready" || profileStatus === "error") navigate(next, { replace: true });
  }, [signedIn, profileStatus, navigate, next]);

  if (status === "unavailable") {
    return (
      <AuthLayout title="log in">
        <AccountsUnavailable />
      </AuthLayout>
    );
  }
  if (status === "signed-in" && !pending) return <SignedInNotice title="log in" />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const fieldErrors: FieldErrors<Fields> = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setErrors(fieldErrors);
    setFormError(null);
    setResent(null);
    if (Object.values(fieldErrors).some(Boolean)) return;

    setPending(true);
    const result = await signIn(email, password);
    if (!result.ok) {
      setPending(false);
      setFormError({ message: result.message, unverified: result.code === "email_not_confirmed" });
      return;
    }
    // Navigation happens once the profile has loaded (see the effect above).
    setSignedIn(true);
  };

  return (
    <AuthLayout title="log in" lead="Welcome back.">
      {formError ? (
        <FormAlert>
          <p>{formError.message}</p>
          {formError.unverified ? (
            <p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={async () => {
                  const result = await resendVerification(email);
                  setResent(result.ok ? "A new verification link is on its way." : result.message);
                }}
              >
                Send a new verification link
              </button>
            </p>
          ) : null}
          {resent ? <p role="status">{resent}</p> : null}
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
          name="current-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={pending || status === "loading"}>
            {pending ? "Logging in…" : "Log in"}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <p>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
