import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import { useProfile } from "../../cloud/profileContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { AccountsUnavailable, AuthLayout, FormAlert, FormNotice } from "../auth/AuthForm";
import authStyles from "../auth/auth.module.css";
import { ProfileForm } from "./ProfileForm";
import { RoomSettings } from "./RoomSettings";
import styles from "./settings.module.css";

export function SettingsPage() {
  useDocumentTitle("Settings");
  const { status: authStatus, user } = useAuth();
  const { status, profile, cloud, setProfile, reload } = useProfile();
  // Survives the switch from the setup form to the full settings page.
  const [welcome, setWelcome] = useState<string | null>(null);

  if (authStatus === "unavailable") {
    return (
      <AuthLayout title="settings">
        <AccountsUnavailable />
      </AuthLayout>
    );
  }
  if (authStatus === "signed-out") {
    return (
      <AuthLayout title="settings" lead="Log in to set up your profile and publish your room.">
        <div className={authStyles.actions}>
          <Link to="/login?next=%2Fsettings" className={authStyles.submit}>
            Log in
          </Link>
          <Link to="/register" className={authStyles.secondary}>
            Create an account
          </Link>
        </div>
      </AuthLayout>
    );
  }
  if (authStatus === "loading" || status === "loading" || status === "none" || !user) {
    return (
      <AuthLayout title="settings">
        <p role="status" className={authStyles.lead}>
          Loading your settings…
        </p>
      </AuthLayout>
    );
  }
  if (status === "error" || !cloud) {
    return (
      <AuthLayout title="settings">
        <FormAlert>
          <p>Your profile couldn't be loaded. Check your connection and try again.</p>
        </FormAlert>
        <div className={authStyles.actions}>
          <button type="button" className={authStyles.secondary} onClick={reload}>
            Try again
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (status === "missing" || !profile) {
    return (
      <AuthLayout
        title="choose your username"
        lead="Your username is your room's address on Internetrooms. You can change it later."
      >
        <ProfileForm
          cloud={cloud}
          userId={user.id}
          profile={null}
          onSaved={(created) => {
            setWelcome(`Welcome, @${created.username}! Your profile is ready. Next: build your room and publish it from the editor.`);
            setProfile(created);
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="settings">
      {welcome ? (
        <FormNotice>
          <p>{welcome}</p>
        </FormNotice>
      ) : null}
      <section className={styles.section} aria-labelledby="settings-profile">
        <h2 id="settings-profile" className={styles.sectionTitle}>
          Profile
        </h2>
        <p className={authStyles.hint}>
          Shown on your room. Your email address is never shown publicly.
        </p>
        <ProfileForm cloud={cloud} userId={user.id} profile={profile} onSaved={setProfile} />
      </section>
      <hr className={styles.rule} />
      <section className={styles.section} aria-labelledby="settings-room">
        <h2 id="settings-room" className={styles.sectionTitle}>
          Room
        </h2>
        <RoomSettings cloud={cloud} profile={profile} />
      </section>
    </AuthLayout>
  );
}
