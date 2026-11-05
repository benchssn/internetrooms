import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { EditorSection, TextField } from "../EditorField";
import {
  createArtwork,
  moveItem,
  updateById,
  usePendingFocus,
  type SectionProps,
} from "../editorUtils";
import { ListItemControls } from "../ListItemControls";
import styles from "../RoomEditor.module.css";
import type { RoomArtwork } from "../../types/room";

const ADD_BUTTON_ID = "ed-art-add";

export function GallerySection({ room, update, errorFor, announce }: SectionProps) {
  const focusLater = usePendingFocus();
  const items = room.artwork;
  const full = items.length >= LIMITS.galleryItems;

  const nameOf = (art: RoomArtwork, index: number) =>
    art.title.trim() || `Artwork ${index + 1}`;

  const patch = (id: string, change: Partial<RoomArtwork>) =>
    update((r) => ({ ...r, artwork: updateById(r.artwork, id, change) }));

  const add = () => {
    if (full) return;
    const art = createArtwork(items);
    update((r) => ({ ...r, artwork: [...r.artwork, art] }));
    focusLater([`ed-art-${art.id}-title`]);
    announce(`Artwork ${items.length + 1} added.`);
  };

  const move = (art: RoomArtwork, index: number, offset: -1 | 1) => {
    update((r) => {
      const from = r.artwork.findIndex((a) => a.id === art.id);
      return { ...r, artwork: moveItem(r.artwork, from, offset) };
    });
    const [same, other] = offset < 0 ? ["up", "down"] : ["down", "up"];
    focusLater([`ed-art-${art.id}-${same}`, `ed-art-${art.id}-${other}`]);
    announce(
      `Moved ${nameOf(art, index)} to position ${index + offset + 1} of ${items.length}.`,
    );
  };

  const remove = (art: RoomArtwork, index: number) => {
    update((r) => ({ ...r, artwork: r.artwork.filter((a) => a.id !== art.id) }));
    focusLater([ADD_BUTTON_ID]);
    announce(`Removed ${nameOf(art, index)}.`);
  };

  return (
    <EditorSection
      title="Gallery"
      icon="▣"
      description={`Show off up to ${LIMITS.galleryItems} pieces of art.`}
    >
      <p className={styles.hint}>
        Use an <strong>https://</strong> image link, or a bundled image such as{" "}
        <code>/assets/images/digital-dreams.svg</code>. Note: images hosted on
        other websites are loaded from those sites, which can see a visitor's
        IP address.
      </p>

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
                  id={`ed-art-${art.id}-title`}
                  label="Title"
                  required
                  value={art.title}
                  maxLength={LIMITS.artworkTitle}
                  error={errorFor(fieldPath.artwork(art.id, "title"))}
                  onChange={(title) => patch(art.id, { title })}
                />
                <TextField
                  id={`ed-art-${art.id}-url`}
                  label="Image URL"
                  type="url"
                  required
                  showCount={false}
                  placeholder="https://…"
                  value={art.imageUrl}
                  maxLength={LIMITS.url}
                  error={errorFor(fieldPath.artwork(art.id, "imageUrl"))}
                  onChange={(imageUrl) => patch(art.id, { imageUrl: imageUrl.trim() })}
                />
                <TextField
                  id={`ed-art-${art.id}-alt`}
                  label="Alternative text"
                  hint="Describe the image for people who can't see it."
                  required
                  value={art.alt}
                  maxLength={LIMITS.artworkAlt}
                  error={errorFor(fieldPath.artwork(art.id, "alt"))}
                  onChange={(alt) => patch(art.id, { alt })}
                />
                <ListItemControls
                  idPrefix={`ed-art-${art.id}`}
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

      <button
        id={ADD_BUTTON_ID}
        type="button"
        className={styles.secondaryButton}
        disabled={full}
        onClick={add}
      >
        <span aria-hidden="true">+ </span>
        {full
          ? `Gallery is full (${LIMITS.galleryItems} of ${LIMITS.galleryItems})`
          : `Add artwork (${items.length} of ${LIMITS.galleryItems})`}
      </button>
    </EditorSection>
  );
}
