import type { RoomArtwork } from "../../types/room";
import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextField } from "../EditorField";
import {
  createArtwork,
  moveItem,
  patchWidgetContent,
  updateById,
  usePendingFocus,
  type WidgetEditorProps,
} from "../editorUtils";
import { ImageSourceField } from "../ImageSourceField";
import { ListItemControls } from "../ListItemControls";
import styles from "../RoomEditor.module.css";

export function GalleryEditor({ widget, update, errorFor, announce }: WidgetEditorProps<"gallery">) {
  const focusLater = usePendingFocus();
  const wid = widget.id;
  const items = widget.content.artwork;
  const full = items.length >= LIMITS.galleryItems;
  const addId = `ed-${wid}-art-add`;

  const setArtwork = (fn: (artwork: RoomArtwork[]) => RoomArtwork[], coalesceKey?: string) =>
    update(
      (r) => patchWidgetContent(r, wid, "gallery", (c) => ({ artwork: fn(c.artwork) })),
      coalesceKey ? { coalesceKey } : undefined,
    );

  const nameOf = (art: RoomArtwork, index: number) => art.title.trim() || `Artwork ${index + 1}`;

  const add = () => {
    if (full) return;
    const art = createArtwork(items);
    setArtwork((artwork) => [...artwork, art]);
    focusLater([`ed-${wid}-art-${art.id}-title`]);
    announce(`Artwork ${items.length + 1} added.`);
  };

  const move = (art: RoomArtwork, index: number, offset: -1 | 1) => {
    setArtwork((artwork) => moveItem(artwork, artwork.findIndex((a) => a.id === art.id), offset));
    const [same, other] = offset < 0 ? ["up", "down"] : ["down", "up"];
    focusLater([`ed-${wid}-art-${art.id}-${same}`, `ed-${wid}-art-${art.id}-${other}`]);
    announce(`Moved ${nameOf(art, index)} to position ${index + offset + 1} of ${items.length}.`);
  };

  const remove = (art: RoomArtwork, index: number) => {
    setArtwork((artwork) => artwork.filter((a) => a.id !== art.id));
    focusLater([addId]);
    announce(`Removed ${nameOf(art, index)}.`);
  };

  return (
    <>
      <p className={styles.hint}>Show off up to {LIMITS.galleryItems} pieces of art.</p>
      {items.length === 0 ? (
        <p className={styles.emptyList}>No artwork yet.</p>
      ) : (
        <ol className={styles.itemList}>
          {items.map((art, index) => (
            <li key={art.id} className={styles.item}>
              <fieldset className={styles.itemFieldset}>
                <legend className={styles.itemLegend}>
                  Artwork {index + 1}
                  {art.title.trim() ? `: ${art.title}` : ""}
                </legend>
                <TextField
                  id={`ed-${wid}-art-${art.id}-title`}
                  label="Title"
                  required
                  value={art.title}
                  maxLength={LIMITS.artworkTitle}
                  error={errorFor(fieldPath.item(wid, "artwork", art.id, "title"))}
                  onChange={(title) =>
                    setArtwork(
                      (artwork) => updateById(artwork, art.id, { title }),
                      fieldPath.item(wid, "artwork", art.id, "title"),
                    )
                  }
                />
                <ImageSourceField
                  idBase={`ed-${wid}-art-${art.id}-image`}
                  label="Image"
                  value={art.image}
                  error={errorFor(fieldPath.item(wid, "artwork", art.id, "image"))}
                  announce={announce}
                  onChange={(image, options) =>
                    setArtwork(
                      (artwork) =>
                        updateById(artwork, art.id, { image: image ?? { kind: "url", url: "" } }),
                      options?.coalesceKey,
                    )
                  }
                />
                <TextField
                  id={`ed-${wid}-art-${art.id}-alt`}
                  label="Alternative text"
                  hint="Describe the image for people who can't see it."
                  required
                  value={art.alt}
                  maxLength={LIMITS.artworkAlt}
                  error={errorFor(fieldPath.item(wid, "artwork", art.id, "alt"))}
                  onChange={(alt) =>
                    setArtwork(
                      (artwork) => updateById(artwork, art.id, { alt }),
                      fieldPath.item(wid, "artwork", art.id, "alt"),
                    )
                  }
                />
                <ListItemControls
                  idPrefix={`ed-${wid}-art-${art.id}`}
                  itemName={nameOf(art, index)}
                  index={index}
                  count={items.length}
                  onMove={(offset) => move(art, index, offset)}
                  onRemove={() => remove(art, index)}
                />
              </fieldset>
            </li>
          ))}
        </ol>
      )}
      <button id={addId} type="button" className={styles.secondaryButton} disabled={full} onClick={add}>
        <span aria-hidden="true">+ </span>
        {full
          ? `Gallery is full (${LIMITS.galleryItems} of ${LIMITS.galleryItems})`
          : `Add artwork (${items.length} of ${LIMITS.galleryItems})`}
      </button>
    </>
  );
}
