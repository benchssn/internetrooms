import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/authContext";
import { roomPath, roomUrl } from "../../cloud/cloudClient";
import type { OwnRoom, Visibility } from "../../cloud/cloudTypes";
import { useProfile } from "../../cloud/profileContext";
import {
  publishDraft,
  publishStatus,
  readPublishState,
  roomFingerprint,
  writePublishState,
  type PublishStatus,
} from "../../cloud/publishing";
import { ShareLink } from "../../components/ShareLink/ShareLink";
import { VisibilityChoice } from "../../pages/settings/VisibilityChoice";
import { validateRoomConfig } from "../../validation/roomValidation";
import { EditorSection } from "../EditorField";
import type { SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

export const PUBLISH_SECTION_ID = "ed-publish";

type Remote =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; room: OwnRoom | null; token: string | null };

type Operation = { kind: "idle" } | { kind: "publishing" } | { kind: "failed"; message: string } | { kind: "succeeded" };

const STATUS_TEXT: Record<PublishStatus, { mark: string; label: string; detail: string }> = {
  "not-published": { mark: "○", label: "Not published", detail: "Your room only exists in this browser." },
  published: { mark: "●", label: "Published", detail: "Your published room matches this editor." },
  "unpublished-changes": {
    mark: "◐",
    label: "Unpublished changes",
    detail: "You've changed your room since publishing. Visitors still see the previous version.",
  },
  "changed-elsewhere": {
    mark: "⚠",
    label: "Published from somewhere else",
    detail:
      "Your published room was published or changed from another browser or device. The room in this editor hasn't been synced — choose what to keep.",
  },
};

/**
 * Explicit publishing from the editor. The local draft is never published
 * automatically and is never changed by publishing.
 */
export function PublishSection({ room, update, announce }: SectionProps) {
  const { status: authStatus, user } = useAuth();
  const { status: profileStatus, profile, cloud } = useProfile();
  const [remote, setRemote] = useState<Remote>({ status: "loading" });
  const [operation, setOperation] = useState<Operation>({ kind: "idle" });
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [stateVersion, setStateVersion] = useState(0);
  const userId = user?.id ?? null;

  const fetchRemote = useCallback(async (): Promise<Remote> => {
    if (!cloud || !userId) return { status: "loading" };
    const [own, token] = await Promise.all([cloud.getOwnRoom(userId), cloud.getShareToken()]);
    return own.ok
      ? { status: "ready", room: own.data, token: token.ok ? token.data : null }
      : { status: "error", message: own.message };
  }, [cloud, userId]);

  const refresh = useCallback(async () => setRemote(await fetchRemote()), [fetchRemote]);

  useEffect(() => {
    if (profileStatus !== "ready") return;
    const lifetime = new AbortController();
    void fetchRemote().then((next) => {
      if (!lifetime.signal.aborted) setRemote(next);
    });
    return () => lifetime.abort();
  }, [profileStatus, fetchRemote]);

  if (authStatus === "unavailable") return null;

  const body = (() => {
    if (authStatus !== "signed-in" || !userId) {
      return (
        <p>
          <Link to="/login?next=%2Fedit">Log in</Link> or <Link to="/register">create an account</Link> to publish
          your room to the internet. Your room is safe in this browser either way.
        </p>
      );
    }
    if (profileStatus === "missing") {
      return (
        <p>
          <Link to="/settings">Choose a username</Link> first — it becomes your room's address.
        </p>
      );
    }
    if (profileStatus === "error") return <p role="alert">Your profile couldn't be loaded. Try reloading the page.</p>;
    if (profileStatus !== "ready" || !profile || !cloud || remote.status === "loading") {
      return <p role="status">Checking your published room…</p>;
    }
    if (remote.status === "error") return <p role="alert">{remote.message}</p>;

    const own = remote.room;
    void stateVersion; // re-read publish state after local changes
    const status = publishStatus(own, readPublishState(userId), room);
    const chosen: Visibility = visibility ?? (own?.published ? own.visibility : "public");
    const info = STATUS_TEXT[status];
    const busy = operation.kind === "publishing";

    const publish = async (confirmMessage?: string) => {
      if (confirmMessage && !window.confirm(confirmMessage)) return;
      setOperation({ kind: "publishing" });
      announce("Publishing your room…");
      const result = await publishDraft({ cloud, userId, draft: room, visibility: chosen });
      if (!result.ok) {
        setOperation({ kind: "failed", message: result.message });
        announce("Publishing failed.");
        return;
      }
      setOperation({ kind: "succeeded" });
      announce("Your room is published.");
      await refresh();
      setStateVersion((v) => v + 1);
    };

    const loadPublished = () => {
      if (!own) return;
      const checked = validateRoomConfig(own.configuration);
      if (!checked.ok) {
        setOperation({ kind: "failed", message: "Your published room couldn't be loaded into the editor." });
        return;
      }
      if (
        !window.confirm(
          "Replace the room in this editor with your published room? You can undo this, and nothing is saved in this browser until you press Save.",
        )
      ) {
        return;
      }
      update(() => checked.room);
      writePublishState(userId, { fingerprint: roomFingerprint(checked.room), updatedAt: own.updatedAt });
      setStateVersion((v) => v + 1);
      setOperation({ kind: "idle" });
      announce("Published room loaded into the editor. Press Save to keep it in this browser.");
    };

    const label =
      operation.kind === "publishing"
        ? { mark: "…", label: "Publishing" }
        : operation.kind === "failed"
          ? { mark: "✕", label: "Publish failed" }
          : operation.kind === "succeeded" && status === "published"
            ? { mark: "✓", label: "Published successfully" }
            : info;
    const shareToken = own?.visibility === "unlisted" ? remote.token : null;

    return (
      <>
        <p className={styles.publishState} data-testid="publish-state" role="status">
          <span aria-hidden="true">{label.mark} </span>
          {label.label}
        </p>
        <p className={styles.hint}>{info.detail}</p>

        {operation.kind === "failed" ? (
          <p className={styles.error} role="alert">
            <span aria-hidden="true">⚠ </span>
            {operation.message}
          </p>
        ) : null}

        <VisibilityChoice value={chosen} onChange={setVisibility} disabled={busy} legend="Who can see it once published" />

        {status === "changed-elsewhere" ? (
          <div className={styles.addRow}>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={loadPublished}>
              Load published room into editor
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() =>
                void publish(
                  "Replace your published room with the room in this editor? Visitors will see this version instead.",
                )
              }
            >
              Publish this editor's room instead
            </button>
          </div>
        ) : (
          <div className={styles.addRow}>
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void publish()}>
              {busy ? "Publishing…" : own?.published ? "Update published room" : "Publish room"}
            </button>
          </div>
        )}

        {own?.published && own.visibility !== "private" && profile ? (
          <ShareLink url={roomUrl(profile.username, shareToken)} path={roomPath(profile.username, shareToken)} />
        ) : own?.published && profile ? (
          <p className={styles.hint}>
            Your room is private — only you can see it. <Link to={roomPath(profile.username)}>View room</Link>
          </p>
        ) : null}
        <p className={styles.hint}>
          Publishing copies this room (and its uploaded images) to Internetrooms. Your draft in this browser stays as
          it is. Manage visibility or unpublish in <Link to="/settings">Settings</Link>.
        </p>
      </>
    );
  })();

  return (
    <div id={PUBLISH_SECTION_ID} tabIndex={-1} className={styles.publishAnchor}>
      <EditorSection title="Publish" icon="⇪">
        {body}
      </EditorSection>
    </div>
  );
}
