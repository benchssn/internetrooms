import { useState } from "react";
import { useImageSourceUrl } from "../../hooks/useImageSourceUrl";
import type { ImageSource } from "../../types/room";
import styles from "./ArtworkImage.module.css";

export interface ArtworkImageProps {
  source: ImageSource | null;
  alt: string;
  /** "fixed" crops to the classic 3:2 frame; "natural" keeps the image's shape. */
  ratio?: "fixed" | "natural";
}

/**
 * Renders a room image from a URL or an uploaded asset, falling back to a
 * placeholder when the source is not allowed, missing, or fails to load.
 * Never passes unsafe URLs to <img>.
 */
export function ArtworkImage({ source, alt, ratio = "fixed" }: ArtworkImageProps) {
  const resolved = useImageSourceUrl(source);
  // Track the URL that failed so a new URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (resolved.status === "loading") {
    return <div className={styles.fallback} role="img" aria-label={`Loading image: ${alt}`} />;
  }

  if (resolved.status !== "ready" || failedUrl === resolved.url) {
    const label = alt.trim() ? `Image unavailable: ${alt}` : "Image unavailable";
    return (
      <div className={styles.fallback} role="img" aria-label={label}>
        <span aria-hidden="true" className={styles.icon}>
          ✦
        </span>
        <span aria-hidden="true" className={styles.text}>
          image unavailable
        </span>
      </div>
    );
  }

  return (
    <img
      className={ratio === "fixed" ? styles.image : styles.natural}
      src={resolved.url}
      alt={alt}
      width={480}
      height={320}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(resolved.url)}
    />
  );
}
