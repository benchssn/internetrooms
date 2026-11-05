import { useAssetList } from "../../hooks/useAssetList";
import { deleteAsset } from "../../storage/assetStore";
import { EditorSection } from "../EditorField";
import { collectAssetIds, type SectionProps } from "../editorUtils";
import { AssetThumb } from "../ImageSourceField";
import styles from "../RoomEditor.module.css";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Manages uploaded images. Images are never deleted automatically — only
 * here, after confirmation, with a warning if a room still uses them.
 */
export function ImageLibrarySection({
  room,
  savedRoom,
  announce,
}: SectionProps & { savedRoom: SectionProps["room"] }) {
  const { available, assets } = useAssetList();
  if (!available) return null;

  const usedByDraft = collectAssetIds(room);
  const usedBySaved = collectAssetIds(savedRoom);

  const remove = async (id: string, index: number) => {
    const inUse = usedByDraft.has(id) || usedBySaved.has(id);
    const ok = window.confirm(
      inUse
        ? "This image is still used in your room. Delete it anyway? Places that use it will show “image unavailable”. This can't be undone."
        : "Delete this image from your browser? This can't be undone.",
    );
    if (!ok) return;
    await deleteAsset(id);
    announce(`Deleted uploaded image ${assets.length - index}.`);
  };

  return (
    <EditorSection
      title="Image library"
      icon="▣"
      description="Images you've uploaded, stored only in this browser. Reuse them anywhere an image can go."
    >
      {assets.length === 0 ? (
        <p className={styles.emptyList}>No uploaded images yet.</p>
      ) : (
        <ul className={styles.libraryList}>
          {assets.map((asset, i) => {
            const n = assets.length - i;
            const used = usedByDraft.has(asset.id) || usedBySaved.has(asset.id);
            return (
              <li key={asset.id} className={styles.libraryItem}>
                <AssetThumb assetId={asset.id} />
                <div className={styles.libraryMeta}>
                  <span className={styles.widgetName}>Image {n}</span>
                  <span className={styles.hint}>
                    {asset.width}×{asset.height} · {formatSize(asset.size)} · {used ? "In use" : "Not used"}
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.smallButton} ${styles.dangerButton}`}
                  aria-label={`Delete uploaded image ${n}`}
                  onClick={() => void remove(asset.id, i)}
                >
                  <span aria-hidden="true">✕ </span>Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </EditorSection>
  );
}
