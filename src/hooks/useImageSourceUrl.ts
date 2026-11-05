import { useEffect, useState } from "react";
import { getAssetUrl } from "../storage/assetStore";
import type { ImageSource } from "../types/room";
import { isSafeImageUrl } from "../validation/roomValidation";

export type ImageUrlState =
  | { status: "none"; url: null }
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  /** Unsafe URL, or an uploaded image that no longer exists. */
  | { status: "unavailable"; url: null };

function syncState(source: ImageSource | null): ImageUrlState {
  if (!source) return { status: "none", url: null };
  if (source.kind === "url") {
    return isSafeImageUrl(source.url)
      ? { status: "ready", url: source.url }
      : { status: "unavailable", url: null };
  }
  return { status: "loading", url: null };
}

/**
 * Turns an ImageSource into something an <img> or CSS background can use.
 * URL sources are checked synchronously; uploaded assets are read from
 * IndexedDB and exposed as blob: URLs.
 */
export function useImageSourceUrl(source: ImageSource | null): ImageUrlState {
  const assetId = source?.kind === "asset" ? source.assetId : null;
  const urlValue = source?.kind === "url" ? source.url : null;
  const [asset, setAsset] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    void getAssetUrl(assetId).then((url) => {
      if (!cancelled) setAsset({ id: assetId, url });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (assetId) {
    if (asset?.id !== assetId) return { status: "loading", url: null };
    return asset.url
      ? { status: "ready", url: asset.url }
      : { status: "unavailable", url: null };
  }
  return syncState(urlValue === null ? null : { kind: "url", url: urlValue });
}
