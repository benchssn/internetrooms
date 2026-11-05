import { useId, useState } from "react";
import { DECORATION_LABELS, SLOT_LABELS } from "../../templates/shared/decorationInfo";
import {
  DECORATION_KINDS,
  DECORATION_SLOTS,
  type Decoration,
  type DecorationKind,
  type DecorationSlot,
} from "../../types/room";
import { LIMITS } from "../../validation/roomValidation";
import { EditorSection } from "../EditorField";
import { createId, moveItem, updateById, usePendingFocus, type SectionProps } from "../editorUtils";
import { ListItemControls } from "../ListItemControls";
import styles from "../RoomEditor.module.css";

export function DecorationsSection({ room, update, announce }: SectionProps) {
  const focusLater = usePendingFocus();
  const kindId = useId();
  const slotId = useId();
  const [newKind, setNewKind] = useState<DecorationKind>("pixel-star");
  const [newSlot, setNewSlot] = useState<DecorationSlot>("header-end");
  const items = room.decorations;
  const full = items.length >= LIMITS.decorations;

  const setDecorations = (fn: (d: Decoration[]) => Decoration[]) =>
    update((r) => ({ ...r, decorations: fn(r.decorations) }));

  const add = () => {
    if (full) return;
    const decoration: Decoration = {
      id: createId(
        "deco",
        items.map((d) => d.id),
      ),
      kind: newKind,
      slot: newSlot,
    };
    setDecorations((d) => [...d, decoration]);
    announce(`${DECORATION_LABELS[newKind]} added ${SLOT_LABELS[newSlot].toLowerCase()}.`);
  };

  return (
    <EditorSection
      title="Decorations"
      icon="✦"
      description="Little nostalgic touches. Each one sits in a fixed spot in your room, so nothing ever covers your content."
    >
      {items.length === 0 ? (
        <p className={styles.emptyList}>No decorations yet.</p>
      ) : (
        <ol className={styles.itemList}>
          {items.map((d, index) => {
            const name = DECORATION_LABELS[d.kind];
            const placeId = `ed-deco-${d.id}-slot`;
            return (
              <li key={d.id} className={styles.item}>
                <div className={styles.itemFieldset}>
                  <p className={styles.itemLegend}>{name}</p>
                  <div className={styles.field}>
                    <label htmlFor={placeId} className={styles.label}>
                      Position
                    </label>
                    <select
                      id={placeId}
                      className={styles.select}
                      value={d.slot}
                      aria-label={`Position of ${name}`}
                      onChange={(e) =>
                        setDecorations((list) =>
                          updateById(list, d.id, { slot: e.target.value as DecorationSlot }),
                        )
                      }
                    >
                      {DECORATION_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {SLOT_LABELS[slot]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ListItemControls
                    idPrefix={`ed-deco-${d.id}`}
                    itemName={name}
                    index={index}
                    count={items.length}
                    onMove={(offset) => {
                      setDecorations((list) => moveItem(list, index, offset));
                      const [same, other] = offset < 0 ? ["up", "down"] : ["down", "up"];
                      focusLater([`ed-deco-${d.id}-${same}`, `ed-deco-${d.id}-${other}`]);
                    }}
                    onRemove={() => {
                      setDecorations((list) => list.filter((x) => x.id !== d.id));
                      focusLater(["ed-deco-add"]);
                      announce(`Removed ${name}.`);
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className={styles.addDecoration}>
        <div className={styles.field}>
          <label htmlFor={kindId} className={styles.label}>
            New decoration
          </label>
          <select
            id={kindId}
            className={styles.select}
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as DecorationKind)}
          >
            {DECORATION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {DECORATION_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={slotId} className={styles.label}>
            Where
          </label>
          <select
            id={slotId}
            className={styles.select}
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value as DecorationSlot)}
          >
            {DECORATION_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>
        </div>
        <button
          id="ed-deco-add"
          type="button"
          className={styles.secondaryButton}
          disabled={full}
          onClick={add}
        >
          <span aria-hidden="true">+ </span>
          {full ? `Decorations are full (${LIMITS.decorations})` : "Add decoration"}
        </button>
      </div>
    </EditorSection>
  );
}
