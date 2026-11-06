import { useEffect, useState } from "react";
import { loadCloudApi } from "../cloud/cloudClient";
import { getAssetUrl } from "../storage/assetStore";
import type { ImageSource } from "../types/room";
import { isSafeImageUrl, isStoredImagePath } from "../validation/roomValidation";

export type ImageUrlState =
  | { status: "none"; url: null }
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  /** Unsafe URL, missing upload, or an image the viewer may not see. */
  | { status: "unavailable"; url: null };

/** Short-lived signed URL for an image stored with a published room. */
async function storedUrl(path: string): Promise<string | null> {
  if (!isStoredImagePath(path)) return null;
  const api = await loadCloudApi();
  return api ? api.storedImageUrl(path) : null;
}

/**
 * Turns an ImageSource into something an <img> or CSS background can use.
 * - url:    checked synchronously
 * - asset:  read from this browser's IndexedDB (blob: URL)
 * - stored: a short-lived signed URL from Supabase Storage (the bucket is
 *           private, so access follows the room's visibility)
 */
export function useImageSourceUrl(source: ImageSource | null): ImageUrlState {
  const asyncKey =
    source?.kind === "asset" ? `asset:${source.assetId}` : source?.kind === "stored" ? `stored:${source.path}` : null;
  const urlValue = source?.kind === "url" ? source.url : null;
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!asyncKey) return;
    const lifetime = new AbortController();
    const [kind, ...rest] = asyncKey.split(":");
    const id = rest.join(":");
    const loading = kind === "asset" ? getAssetUrl(id) : storedUrl(id);
    void loading
      .catch(() => null)
      .then((url) => {
        if (!lifetime.signal.aborted) setResolved({ key: asyncKey, url });
      });
    return () => lifetime.abort();
  }, [asyncKey]);

  if (asyncKey) {
    if (resolved?.key !== asyncKey) return { status: "loading", url: null };
    return resolved.url ? { status: "ready", url: resolved.url } : { status: "unavailable", url: null };
  }
  if (urlValue === null) return { status: "none", url: null };
  return isSafeImageUrl(urlValue) ? { status: "ready", url: urlValue } : { status: "unavailable", url: null };
}
