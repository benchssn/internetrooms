import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { loadCloudApi } from "../cloud/cloudClient";
import type { CloudApi, Profile, VisibleRoom } from "../cloud/cloudTypes";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { RoomRenderer } from "../templates/RoomRenderer";
import type { RoomConfig } from "../types/room";
import { validateRoomConfig } from "../validation/roomValidation";
import styles from "./pages.module.css";

type State =
  | { kind: "loading" }
  | { kind: "unavailable-service" }
  | { kind: "error" }
  | { kind: "no-profile" }
  | { kind: "no-room"; profile: Profile; cloud: CloudApi }
  | { kind: "invalid"; profile: Profile; cloud: CloudApi }
  | { kind: "room"; profile: Profile; cloud: CloudApi; room: RoomConfig; meta: VisibleRoom };

/** Adds/removes <meta name="robots" content="noindex"> for this page. */
function useNoIndex(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(meta);
    return () => meta.remove();
  }, [active]);
}

/**
 * A person's published room at /u/:username. Loaded only from Supabase
 * (never from this browser's draft) and rendered with the shared
 * RoomRenderer. Visitors see no editing controls.
 */
export function PublicRoomPage() {
  const { username = "" } = useParams();
  const [params] = useSearchParams();
  const key = params.get("key");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const lifetime = new AbortController();
    void (async () => {
      const cloud = await loadCloudApi();
      if (lifetime.signal.aborted) return;
      if (!cloud) {
        setState({ kind: "unavailable-service" });
        return;
      }
      const [profile, room] = await Promise.all([
        cloud.getProfileByUsername(username),
        cloud.getVisibleRoom(username, key),
      ]);
      if (lifetime.signal.aborted) return;
      if (!profile.ok || !room.ok) return setState({ kind: "error" });
      if (!profile.data) return setState({ kind: "no-profile" });
      if (!room.data) return setState({ kind: "no-room", profile: profile.data, cloud });
      // Never trust stored data: validate before rendering.
      const checked = validateRoomConfig(room.data.configuration);
      if (!checked.ok) return setState({ kind: "invalid", profile: profile.data, cloud });
      setState({ kind: "room", profile: profile.data, cloud, room: checked.room, meta: room.data });
    })();
    return () => lifetime.abort();
  }, [username, key]);

  const title =
    state.kind === "room" ? `${state.room.title} · @${state.profile.username}` : `@${username}`;
  useDocumentTitle(title);
  useNoIndex(state.kind === "room" && state.meta.visibility !== "public");

  if (state.kind === "loading") {
    return (
      <SiteLayout>
        <p role="status" className={styles.pageLead}>
          Opening the room…
        </p>
      </SiteLayout>
    );
  }

  if (state.kind !== "room") {
    const heading =
      state.kind === "no-profile"
        ? "nobody lives here (yet)"
        : state.kind === "error" || state.kind === "unavailable-service"
          ? "the room couldn't be loaded"
          : "this room isn't available";
    const text =
      state.kind === "no-profile"
        ? `There's no one called @${username} on Internetrooms.`
        : state.kind === "unavailable-service"
          ? "Published rooms can't be loaded right now. Please try again later."
          : state.kind === "error"
            ? "The room couldn't be loaded. Check your connection and try again."
            : state.kind === "invalid"
              ? "This room couldn't be displayed."
              : "It may be private, unpublished, or need a special link.";
    return (
      <SiteLayout>
        {"profile" in state ? <ProfileStrip profile={state.profile} cloud={state.cloud} /> : null}
        <section className={styles.pageIntro} aria-labelledby="public-room-title">
          <h1 id="public-room-title" className={styles.pageTitle}>
            {heading}
          </h1>
          <p className={styles.pageLead}>{text}</p>
          <div className={styles.actions}>
            <Link to="/" className={styles.secondaryAction}>
              Go to the homepage
            </Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const { profile, cloud, room, meta } = state;
  const ownerNote = meta.isOwner
    ? !meta.isPublished
      ? "Only you can see this — your room isn't published."
      : meta.visibility === "private"
        ? "Only you can see this — your room is private."
        : meta.visibility === "unlisted"
          ? "Unlisted — only people with your link can see this."
          : null
    : null;

  return (
    <>
      <nav className={styles.roomBar} aria-label="Internetrooms">
        <Link to="/" className={styles.roomBarBrand}>
          internetrooms
        </Link>
        <p className={styles.roomBarNote}>{ownerNote ?? `@${profile.username}'s room`}</p>
        <div className={styles.roomBarLinks}>
          {meta.isOwner ? (
            <>
              <Link to="/edit">Edit room</Link>
              <Link to="/settings">Settings</Link>
            </>
          ) : (
            <Link to="/">Make your own room</Link>
          )}
        </div>
      </nav>
      <ProfileStrip profile={profile} cloud={cloud} compact />
      <RoomRenderer room={room} />
    </>
  );
}

function ProfileStrip({ profile, cloud, compact }: { profile: Profile; cloud: CloudApi; compact?: boolean }) {
  return (
    <aside className={compact ? `${styles.profileStrip} ${styles.profileStripCompact}` : styles.profileStrip} aria-label="About the owner">
      {profile.avatarPath ? (
        <img className={styles.profileAvatar} src={cloud.avatarUrl(profile.avatarPath)} alt="" width={48} height={48} />
      ) : null}
      <div className={styles.profileText}>
        <p className={styles.profileName}>
          {profile.displayName ?? profile.username} <span className={styles.profileHandle}>@{profile.username}</span>
        </p>
        {profile.bio ? <p className={styles.profileBio}>{profile.bio}</p> : null}
      </div>
    </aside>
  );
}
