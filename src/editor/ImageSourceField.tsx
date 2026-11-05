import { useId, useState, type ChangeEvent } from "react";
import { useAssetList } from "../hooks/useAssetList";
import { useImageSourceUrl } from "../hooks/useImageSourceUrl";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, uploadImage } from "../storage/imageUpload";
import type { ImageSource } from "../types/room";
import { LIMITS, type FieldError } from "../validation/roomValidation";
import { TextField } from "./EditorField";
import styles from "./RoomEditor.module.css";

export interface ImageSourceFieldProps {
  /** Group label, e.g. "Image" or "Background image". */
  label: string;
  value: ImageSource | null;
  onChange: (value: ImageSource | null, options?: { coalesceKey?: string }) => void;
  error?: FieldError;
  /** Stable id prefix (used for the URL input id). */
  idBase: string;
  announce: (message: string) => void;
}

export function AssetThumb({ assetId, alt = "" }: { assetId: string; alt?: string }) {
  const resolved = useImageSourceUrl({ kind: "asset", assetId });
  if (resolved.status !== "ready") {
    return <span className={styles.thumbMissing}>{resolved.status === "loading" ? "…" : "missing"}</span>;
  }
  return <img className={styles.thumb} src={resolved.url} alt={alt} width={64} height={64} />;
}

/**
 * Picks an image from a web link or from the user's uploaded images.
 * Uploads are validated, converted and stored in IndexedDB; only the
 * asset id is kept in the room.
 */
export function ImageSourceField({
  label,
  value,
  onChange,
  error,
  idBase,
  announce,
}: ImageSourceFieldProps) {
  const groupName = useId();
  const fileId = useId();
  const statusId = useId();
  const [mode, setMode] = useState<"url" | "asset">(value?.kind ?? "url");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { available, assets } = useAssetList();

  const selectedAsset = value?.kind === "asset" ? value.assetId : null;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // allow choosing the same file again
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    const result = await uploadImage(file);
    setBusy(false);
    if (!result.ok) {
      setUploadError(result.reason);
      return;
    }
    onChange({ kind: "asset", assetId: result.asset.id });
    announce("Image uploaded and selected.");
  };

  return (
    <fieldset className={styles.imageField}>
      <legend className={styles.label}>{label}</legend>

      <div className={styles.segmented} role="radiogroup" aria-label={`${label} source`}>
        <label className={styles.segment}>
          <input
            type="radio"
            name={groupName}
            checked={mode === "url"}
            onChange={() => {
              setMode("url");
              if (value?.kind !== "url") onChange({ kind: "url", url: "" });
            }}
          />
          <span>Web link</span>
        </label>
        <label className={styles.segment}>
          <input
            type="radio"
            name={groupName}
            checked={mode === "asset"}
            disabled={!available}
            onChange={() => setMode("asset")}
          />
          <span>Upload / my images</span>
        </label>
      </div>

      {mode === "url" ? (
        <TextField
          id={`${idBase}-url`}
          label="Image URL"
          type="url"
          required
          showCount={false}
          placeholder="https://…"
          hint="An https:// link, or a bundled image such as /assets/images/digital-dreams.svg. Images on other sites are loaded from those sites, which can see a visitor's IP address."
          value={value?.kind === "url" ? value.url : ""}
          maxLength={LIMITS.url}
          error={error}
          onChange={(url) =>
            onChange({ kind: "url", url: url.trim() }, { coalesceKey: `${idBase}-url` })
          }
        />
      ) : (
        <div className={styles.uploadArea}>
          <div>
            <label htmlFor={fileId} className={styles.uploadButton}>
              <span aria-hidden="true">⇪ </span>
              {busy ? "Uploading…" : "Upload an image"}
            </label>
            <input
              id={fileId}
              className={styles.fileInput}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              disabled={busy}
              aria-describedby={statusId}
              onChange={(e) => void handleFile(e)}
            />
          </div>
          <p id={statusId} className={styles.hint}>
            PNG, JPEG, GIF or WebP, up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.
            Images are converted and kept only in this browser. SVG isn't accepted.
          </p>
          {uploadError ? (
            <p className={styles.error} role="alert">
              <span aria-hidden="true">⚠ </span>
              {uploadError}
            </p>
          ) : null}
          {error && !uploadError ? (
            <p className={styles.error}>
              <span aria-hidden="true">⚠ </span>
              {error.message}
            </p>
          ) : null}

          {assets.length > 0 ? (
            <div className={styles.assetGrid} role="group" aria-label="Your uploaded images">
              {assets.map((asset, i) => {
                const selected = asset.id === selectedAsset;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={selected ? `${styles.assetChoice} ${styles.assetChosen}` : styles.assetChoice}
                    aria-pressed={selected}
                    aria-label={`Use uploaded image ${assets.length - i} (${asset.width}×${asset.height})`}
                    onClick={() => {
                      onChange({ kind: "asset", assetId: asset.id });
                      announce("Image selected.");
                    }}
                  >
                    <AssetThumb assetId={asset.id} />
                    {selected ? <span className={styles.assetTick} aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.hint}>No uploaded images yet.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
