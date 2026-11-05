import type { RoomLink } from "../../types/room";
import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextField } from "../EditorField";
import {
  createLink,
  moveItem,
  patchWidgetContent,
  updateById,
  usePendingFocus,
  type WidgetEditorProps,
} from "../editorUtils";
import { ListItemControls } from "../ListItemControls";
import styles from "../RoomEditor.module.css";

type Props = WidgetEditorProps<"links"> | WidgetEditorProps<"link-collection">;

/** Edits the links in a Favourite Links or Link Collection widget. */
export function LinkListEditor(props: Props) {
  const { widget, update, errorFor, announce } = props;
  const focusLater = usePendingFocus();
  const wid = widget.id;
  const type = widget.type;
  const items = widget.content.links;
  const full = items.length >= LIMITS.links;
  const addId = `ed-${wid}-link-add`;

  const setLinks = (fn: (links: RoomLink[]) => RoomLink[], coalesceKey?: string) =>
    update(
      (r) =>
        type === "links"
          ? patchWidgetContent(r, wid, "links", (c) => ({ links: fn(c.links) }))
          : patchWidgetContent(r, wid, "link-collection", (c) => ({ links: fn(c.links) })),
      coalesceKey ? { coalesceKey } : undefined,
    );

  const nameOf = (link: RoomLink, index: number) => link.label.trim() || `Link ${index + 1}`;

  const add = () => {
    if (full) return;
    const link = createLink(items);
    setLinks((links) => [...links, link]);
    focusLater([`ed-${wid}-link-${link.id}-label`]);
    announce(`Link ${items.length + 1} added.`);
  };

  const move = (link: RoomLink, index: number, offset: -1 | 1) => {
    setLinks((links) => moveItem(links, links.findIndex((l) => l.id === link.id), offset));
    const [same, other] = offset < 0 ? ["up", "down"] : ["down", "up"];
    focusLater([`ed-${wid}-link-${link.id}-${same}`, `ed-${wid}-link-${link.id}-${other}`]);
    announce(`Moved ${nameOf(link, index)} to position ${index + offset + 1} of ${items.length}.`);
  };

  const remove = (link: RoomLink, index: number) => {
    setLinks((links) => links.filter((l) => l.id !== link.id));
    focusLater([addId]);
    announce(`Removed ${nameOf(link, index)}.`);
  };

  return (
    <>
      {type === "link-collection" ? (
        <TextField
          id={`ed-${wid}-title`}
          label="Heading"
          hint="Optional. Shown as “More Links” if left empty."
          value={widget.content.title}
          maxLength={LIMITS.widgetTitle}
          error={errorFor(fieldPath.widget(wid, "title"))}
          onChange={(title) =>
            update((r) => patchWidgetContent(r, wid, "link-collection", () => ({ title })), {
              coalesceKey: fieldPath.widget(wid, "title"),
            })
          }
        />
      ) : null}

      <p className={styles.hint}>Links must start with https://. Up to {LIMITS.links} links.</p>

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
                  id={`ed-${wid}-link-${link.id}-label`}
                  label="Label"
                  required
                  value={link.label}
                  maxLength={LIMITS.linkLabel}
                  error={errorFor(fieldPath.item(wid, "links", link.id, "label"))}
                  onChange={(label) =>
                    setLinks(
                      (links) => updateById(links, link.id, { label }),
                      fieldPath.item(wid, "links", link.id, "label"),
                    )
                  }
                />
                <TextField
                  id={`ed-${wid}-link-${link.id}-url`}
                  label="URL"
                  type="url"
                  required
                  showCount={false}
                  placeholder="https://…"
                  value={link.url}
                  maxLength={LIMITS.url}
                  error={errorFor(fieldPath.item(wid, "links", link.id, "url"))}
                  onChange={(url) =>
                    setLinks(
                      (links) => updateById(links, link.id, { url: url.trim() }),
                      fieldPath.item(wid, "links", link.id, "url"),
                    )
                  }
                />
                <ListItemControls
                  idPrefix={`ed-${wid}-link-${link.id}`}
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

      <button id={addId} type="button" className={styles.secondaryButton} disabled={full} onClick={add}>
        <span aria-hidden="true">+ </span>
        {full ? `Links are full (${LIMITS.links} of ${LIMITS.links})` : `Add link (${items.length} of ${LIMITS.links})`}
      </button>
    </>
  );
}
