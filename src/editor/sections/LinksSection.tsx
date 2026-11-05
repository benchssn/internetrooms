import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { EditorSection, TextField } from "../EditorField";
import {
  createLink,
  moveItem,
  updateById,
  usePendingFocus,
  type SectionProps,
} from "../editorUtils";
import { ListItemControls } from "../ListItemControls";
import styles from "../RoomEditor.module.css";
import type { RoomLink } from "../../types/room";

const ADD_BUTTON_ID = "ed-link-add";

export function LinksSection({ room, update, errorFor, announce }: SectionProps) {
  const focusLater = usePendingFocus();
  const items = room.links;
  const full = items.length >= LIMITS.links;

  const nameOf = (link: RoomLink, index: number) =>
    link.label.trim() || `Link ${index + 1}`;

  const patch = (id: string, change: Partial<RoomLink>) =>
    update((r) => ({ ...r, links: updateById(r.links, id, change) }));

  const add = () => {
    if (full) return;
    const link = createLink(items);
    update((r) => ({ ...r, links: [...r.links, link] }));
    focusLater([`ed-link-${link.id}-label`]);
    announce(`Link ${items.length + 1} added.`);
  };

  const move = (link: RoomLink, index: number, offset: -1 | 1) => {
    update((r) => {
      const from = r.links.findIndex((l) => l.id === link.id);
      return { ...r, links: moveItem(r.links, from, offset) };
    });
    const [same, other] = offset < 0 ? ["up", "down"] : ["down", "up"];
    focusLater([`ed-link-${link.id}-${same}`, `ed-link-${link.id}-${other}`]);
    announce(
      `Moved ${nameOf(link, index)} to position ${index + offset + 1} of ${items.length}.`,
    );
  };

  const remove = (link: RoomLink, index: number) => {
    update((r) => ({ ...r, links: r.links.filter((l) => l.id !== link.id) }));
    focusLater([ADD_BUTTON_ID]);
    announce(`Removed ${nameOf(link, index)}.`);
  };

  return (
    <EditorSection
      title="Links"
      icon="⛓"
      description={`Share up to ${LIMITS.links} favourite places on the web. Links must start with https://.`}
    >
      {items.length === 0 ? (
        <p className={styles.emptyList}>No links yet.</p>
      ) : (
        <ol className={styles.itemList}>
          {items.map((link, index) => (
            <li key={link.id} className={styles.item}>
              <fieldset className={styles.itemFieldset}>
                <legend className={styles.itemLegend}>
                  Link {index + 1}
                  {link.label.trim() ? `: ${link.label}` : ""}
                </legend>
                <TextField
                  id={`ed-link-${link.id}-label`}
                  label="Label"
                  required
                  value={link.label}
                  maxLength={LIMITS.linkLabel}
                  error={errorFor(fieldPath.link(link.id, "label"))}
                  onChange={(label) => patch(link.id, { label })}
                />
                <TextField
                  id={`ed-link-${link.id}-url`}
                  label="URL"
                  type="url"
                  required
                  showCount={false}
                  placeholder="https://…"
                  value={link.url}
                  maxLength={LIMITS.url}
                  error={errorFor(fieldPath.link(link.id, "url"))}
                  onChange={(url) => patch(link.id, { url: url.trim() })}
                />
                <ListItemControls
                  idPrefix={`ed-link-${link.id}`}
                  itemName={nameOf(link, index)}
                  index={index}
                  count={items.length}
                  onMove={(offset) => move(link, index, offset)}
                  onRemove={() => remove(link, index)}
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
          ? `Links are full (${LIMITS.links} of ${LIMITS.links})`
          : `Add link (${items.length} of ${LIMITS.links})`}
      </button>
    </EditorSection>
  );
}
