import { useId, useState } from "react";
import { Link } from "react-router";
import styles from "./ShareLink.module.css";

export interface ShareLinkProps {
  /** The full https://internetrooms.net link. */
  url: string;
  /** The same link as an in-app path, for "View room". */
  path: string;
}

/** Shows a room link with Copy Link and View Room actions. */
export function ShareLink({ url, path }: ShareLinkProps) {
  const id = useId();
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand.
      (document.getElementById(id) as HTMLInputElement | null)?.select();
      setCopied("failed");
    }
  };

  return (
    <div className={styles.share}>
      <label htmlFor={id} className={styles.label}>
        Room link
      </label>
      <input id={id} className={styles.url} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => void copy()}>
          Copy link
        </button>
        <Link to={path} className={styles.button}>
          View room
        </Link>
      </div>
      <p className={styles.status} role="status">
        {copied === "copied" ? "Link copied." : copied === "failed" ? "Press Ctrl/⌘+C to copy the selected link." : ""}
      </p>
    </div>
  );
}
