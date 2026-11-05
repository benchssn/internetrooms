import { Link } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useRoomDraftContext } from "../hooks/roomDraftContext";
import { RoomRenderer } from "../templates/RoomRenderer";
import styles from "./pages.module.css";

/**
 * Visitor view of the room most recently saved in this browser.
 * This is not a public page: it only exists in the owner's localStorage.
 */
export function RoomPage() {
  const { savedRoom, hasSavedRoom, isDirty, loadNotice } = useRoomDraftContext();
  useDocumentTitle(hasSavedRoom ? savedRoom.title : "My room");

  if (!hasSavedRoom) {
    return (
      <SiteLayout>
        <section className={styles.pageIntro} aria-labelledby="room-empty-title">
          <h1 id="room-empty-title" className={styles.pageTitle}>
            {loadNotice?.kind === "invalid"
              ? "your saved room couldn't be opened"
              : "no saved room yet"}
          </h1>
          <p className={styles.pageLead}>
            {loadNotice?.kind === "invalid"
              ? "The room saved in this browser couldn't be read, so it can't be shown. Your data hasn't been deleted — open the editor to download a copy or start again."
              : loadNotice?.kind === "unavailable"
                ? "This browser isn't letting Internetrooms read saved data (private browsing or blocked storage can cause this)."
                : "Once you save a room in the editor, it will appear here exactly as visitors would see it."}
          </p>
          <div className={styles.actions}>
            <Link to="/templates" className={styles.primaryAction}>
              Create a room
            </Link>
            <Link to="/edit" className={styles.secondaryAction}>
              Open the editor
            </Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <>
      <nav className={styles.roomBar} aria-label="Internetrooms">
        <Link to="/" className={styles.roomBarBrand}>
          internetrooms
        </Link>
        <p className={styles.roomBarNote}>
          {isDirty
            ? "Showing your last save — you have unsaved edits in the editor."
            : "Saved in this browser only — not a public page."}
        </p>
        <div className={styles.roomBarLinks}>
          <Link to="/">Back to site</Link>
          <Link to="/edit">Edit room</Link>
        </div>
      </nav>
      <RoomRenderer room={savedRoom} />
    </>
  );
}
