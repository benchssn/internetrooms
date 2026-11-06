import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { FormAlert, FormNotice } from "../auth/AuthForm";
import authStyles from "../auth/auth.module.css";
import { ShareLink } from "../../components/ShareLink/ShareLink";
import { roomPath, roomUrl } from "../../cloud/cloudClient";
import type { CloudApi, OwnRoom, Profile, Visibility } from "../../cloud/cloudTypes";
import { noteRemoteUpdate } from "../../cloud/publishing";
import { validateRoomConfig } from "../../validation/roomValidation";
import { VisibilityChoice } from "./VisibilityChoice";
import styles from "./settings.module.css";

interface Props {
  cloud: CloudApi;
  profile: Profile;
}

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; room: OwnRoom | null };

export function RoomSettings({ cloud, profile }: Props) {
  const statusId = useId();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const lifetime = new AbortController();
    void Promise.all([cloud.getOwnRoom(profile.id), cloud.getShareToken()]).then(([room, share]) => {
      if (lifetime.signal.aborted) return;
      if (!room.ok) setLoad({ status: "error", message: room.message });
      else setLoad({ status: "ready", room: room.data });
      if (share.ok) setToken(share.data);
    });
    return () => lifetime.abort();
  }, [cloud, profile.id]);

  if (load.status === "loading") {
    return (
      <p role="status" className={authStyles.lead}>
        Loading your room…
      </p>
    );
  }
  if (load.status === "error") {
    return (
      <FormAlert>
        <p>{load.message}</p>
      </FormAlert>
    );
  }

  const room = load.room;
  const hasContent = room !== null && validateRoomConfig(room.configuration).ok;
  if (!room || !hasContent) {
    return (
      <div className={styles.roomStatus}>
        <p className={styles.statusLine}>
          <span className={styles.statusMark} aria-hidden="true">
            ○
          </span>
          Not published
        </p>
        <p>You haven't published a room yet. Build it in the editor, then press Publish.</p>
        <div className={authStyles.actions}>
          <Link to="/edit" className={authStyles.submit}>
            Open the editor
          </Link>
        </div>
      </div>
    );
  }

  const apply = async (patch: { visibility?: Visibility; published?: boolean }, success: string) => {
    setBusy(true);
    setMessage(null);
    const result = await cloud.updateOwnRoom(profile.id, patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }
    noteRemoteUpdate(profile.id, result.data.updatedAt);
    setLoad({ status: "ready", room: result.data });
    setMessage({ kind: "ok", text: success });
  };

  const visibilityLabels: Record<Visibility, string> = {
    public: "Public",
    unlisted: "Unlisted",
    private: "Private",
  };
  const shareToken = room.visibility === "unlisted" ? token : null;

  return (
    <div className={styles.roomStatus} aria-describedby={statusId}>
      <p id={statusId} className={styles.statusLine}>
        <span className={styles.statusMark} aria-hidden="true">
          {room.published ? "●" : "○"}
        </span>
        {room.published ? `Published · ${visibilityLabels[room.visibility]}` : "Not published (saved, but hidden)"}
      </p>

      {message ? (
        message.kind === "ok" ? (
          <FormNotice>
            <p>{message.text}</p>
          </FormNotice>
        ) : (
          <FormAlert>
            <p>{message.text}</p>
          </FormAlert>
        )
      ) : null}

      <VisibilityChoice
        value={room.visibility}
        disabled={busy}
        onChange={(visibility) => void apply({ visibility }, `Visibility changed to ${visibilityLabels[visibility]}.`)}
      />

      {room.published && room.visibility !== "private" ? (
        <ShareLink url={roomUrl(profile.username, shareToken)} path={roomPath(profile.username, shareToken)} />
      ) : (
        <p>
          {room.published ? "Only you can see your room." : "Nobody can see your room until you publish it again."}{" "}
          <Link to={roomPath(profile.username)}>View it</Link>
        </p>
      )}

      <div className={authStyles.actions}>
        {room.published ? (
          <button
            type="button"
            className={authStyles.secondary}
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Unpublish your room? Visitors won't be able to see it. Your room and your local draft are kept, and you can publish again any time.",
                )
              ) {
                void apply({ published: false }, "Your room is unpublished. Nothing was deleted.");
              }
            }}
          >
            Unpublish room
          </button>
        ) : (
          <button
            type="button"
            className={authStyles.submit}
            disabled={busy}
            onClick={() => void apply({ published: true }, "Your room is published again.")}
          >
            Publish again
          </button>
        )}
        <Link to="/edit" className={authStyles.secondary}>
          Edit room
        </Link>
      </div>

      {room.visibility === "unlisted" ? (
        <p className={authStyles.hint}>
          Shared the link too widely?{" "}
          <button
            type="button"
            className={authStyles.linkButton}
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Make a new link? The current unlisted link will stop working.")) return;
              setBusy(true);
              const result = await cloud.rotateShareToken();
              setBusy(false);
              if (result.ok) {
                setToken(result.data);
                setMessage({ kind: "ok", text: "New link created. The old one no longer works." });
              } else {
                setMessage({ kind: "error", text: result.message });
              }
            }}
          >
            Make a new link
          </button>
        </p>
      ) : null}
    </div>
  );
}
