import { useState } from "react";
import { isSafeImageUrl } from "../../validation/roomValidation";
import styles from "./ArtworkImage.module.css";

export interface ArtworkImageProps {
  src: string;
  alt: string;
}

/**
 * Renders an artwork image, falling back to a placeholder when the URL is
 * not allowed or the image fails to load. Never passes unsafe URLs to <img>.
 */
export function ArtworkImage({ src, alt }: ArtworkImageProps) {
  // Track the src that failed so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const allowed = isSafeImageUrl(src);

  if (!allowed || failedSrc === src) {
    const label = alt.trim()
      ? `Image unavailable: ${alt}`
      : "Image unavailable";
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
      className={styles.image}
      src={src}
      alt={alt}
      width={480}
      height={320}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
