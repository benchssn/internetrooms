import { Link } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { Window } from "../components/Window/Window";
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
        <Window title="my room">
          <div className={styles.emptyRoom}>
            <h1 className={styles.pageTitle}>
              {loadNotice?.kind === "invalid"
                ? "your saved room couldn't be opened"
                : "no saved room yet"}
            </h1>
            <p>
              {loadNotice?.kind === "invalid"
                ? "The room saved in this browser looks damaged, so it can't be shown. Open the editor to start again — saving there will replace it."
                : loadNotice?.kind === "unavailable"
                  ? "This browser isn't letting Internetrooms read saved data (private browsing or blocked storage can cause this)."
                  : "Once you save a room in the editor, it will appear here exactly as visitors would see it."}
            </p>
            <div className={styles.heroActions}>
              <Link to="/templates" className={styles.primaryAction}>
                Create your room
              </Link>
              <Link to="/edit" className={styles.secondaryAction}>
                Open the editor
              </Link>
            </div>
          </div>
        </Window>
      </SiteLayout>
    );
  }

  return (
    <>
      <nav className={styles.roomBar} aria-label="Internetrooms">
        <Link to="/" className={styles.roomBarBrand}>
          <span aria-hidden="true">★ </span>internetrooms
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
