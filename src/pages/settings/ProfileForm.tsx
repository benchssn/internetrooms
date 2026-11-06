import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { Field, FormAlert, FormNotice } from "../auth/AuthForm";
import authStyles from "../auth/auth.module.css";
import { roomUrl } from "../../cloud/cloudClient";
import type { CloudApi, Profile } from "../../cloud/cloudTypes";
import { BIO_MAX, DISPLAY_NAME_MAX, normaliseUsername, validateUsername } from "../../cloud/usernames";
import { imageProcessor, validateImageFile } from "../../storage/imageUpload";
import styles from "./settings.module.css";

const AVATAR_SIZE = 512;

interface Props {
  cloud: CloudApi;
  userId: string;
  /** Null when setting up a profile for the first time. */
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
}

/**
 * Creates (first login) or edits the public profile. Username uniqueness
 * and format are enforced by the database; these checks just give quicker
 * feedback.
 */
export function ProfileForm({ cloud, userId, profile, onSaved }: Props) {
  const bioId = useId();
  const avatarInputId = useId();
  const creating = profile === null;
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatarPath ?? null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const normalised = normaliseUsername(username);
  const renaming = !creating && normalised !== profile.username && !validateUsername(username);

  const onAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    const check = await validateImageFile(file);
    if (!check.ok) {
      setAvatarBusy(false);
      setAvatarError(check.reason);
      return;
    }
    try {
      // Re-encoded from pixels: strips metadata and anything that isn't an image.
      const processed = await imageProcessor.process(file, AVATAR_SIZE);
      const uploaded = await cloud.uploadAvatar(userId, processed.blob);
      if (uploaded.ok) setAvatarPath(uploaded.data);
      else setAvatarError(uploaded.message);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "That image couldn't be used.");
    }
    setAvatarBusy(false);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setFormError(null);
    const problem = validateUsername(username);
    setUsernameError(problem);
    if (problem) return;
    if (displayName.length > DISPLAY_NAME_MAX || bio.length > BIO_MAX) return;

    setPending(true);
    const input = {
      username: normalised,
      displayName: displayName.trim() || null,
      bio: bio.trim() || null,
      avatarPath,
    };
    const result = creating ? await cloud.createProfile(userId, input) : await cloud.updateProfile(userId, input);
    setPending(false);
    if (!result.ok) {
      if (result.code === "username_taken" || result.code === "invalid") setUsernameError(result.message);
      else setFormError(result.message);
      return;
    }
    setUsername(result.data.username);
    setNotice(creating ? `Welcome, @${result.data.username}! Your profile is ready.` : "Profile saved.");
    onSaved(result.data);
  };

  return (
    <form className={authStyles.form} onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
      {formError ? (
        <FormAlert>
          <p>{formError}</p>
        </FormAlert>
      ) : null}
      {notice ? (
        <FormNotice>
          <p>{notice}</p>
        </FormNotice>
      ) : null}

      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        hint="3–24 characters: lowercase letters, numbers, _ and -. It's your room's address."
        value={username}
        maxLength={24}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        error={usernameError}
        required
      />
      <p className={styles.preview}>
        Your room: <span className={styles.mono}>{roomUrl(normalised || "your-name")}</span>
      </p>
      {renaming ? (
        <FormAlert>
          <p>
            Changing your username changes your room's address to{" "}
            <span className={styles.mono}>{roomUrl(normalised)}</span>. Links you've already shared
            with the old address will stop working.
          </p>
        </FormAlert>
      ) : null}

      <Field
        label="Display name"
        name="display-name"
        autoComplete="nickname"
        hint="Optional. Shown on your room."
        value={displayName}
        maxLength={DISPLAY_NAME_MAX}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      {!creating ? (
        <>
          <div className={authStyles.field}>
            <label htmlFor={bioId} className={authStyles.label}>
              Bio
            </label>
            <p id={`${bioId}-hint`} className={authStyles.hint}>
              Optional. A line or two about you, shown on your room. {bio.length}/{BIO_MAX}
            </p>
            <textarea
              id={bioId}
              className={styles.textarea}
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              aria-describedby={`${bioId}-hint`}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className={authStyles.field}>
            <span className={authStyles.label}>Profile picture</span>
            <div className={styles.avatarRow}>
              {avatarPath ? (
                <img className={styles.avatar} src={cloud.avatarUrl(avatarPath)} alt="Your profile picture" width={72} height={72} />
              ) : (
                <span className={styles.avatarEmpty} aria-hidden="true">
                  {normalised.slice(0, 1) || "?"}
                </span>
              )}
              <div className={styles.avatarActions}>
                <label htmlFor={avatarInputId} className={authStyles.secondary}>
                  {avatarBusy ? "Uploading…" : avatarPath ? "Change picture" : "Upload picture"}
                </label>
                <input
                  id={avatarInputId}
                  className={styles.fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={avatarBusy}
                  onChange={(e) => void onAvatar(e)}
                />
                {avatarPath ? (
                  <button type="button" className={authStyles.linkButton} onClick={() => setAvatarPath(null)}>
                    Remove picture
                  </button>
                ) : null}
              </div>
            </div>
            <p className={authStyles.hint}>PNG, JPEG or WebP. Saved when you press Save profile. Your picture is public.</p>
            {avatarError ? (
              <p className={authStyles.fieldError} role="alert">
                {avatarError}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className={authStyles.actions}>
        <button type="submit" className={authStyles.submit} disabled={pending || avatarBusy}>
          {pending ? "Saving…" : creating ? "Create profile" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
