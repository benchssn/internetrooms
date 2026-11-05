import styles from "./RoomEditor.module.css";

export interface ListItemControlsProps {
  /** Prefix for button ids, used to restore focus after moves. */
  idPrefix: string;
  /** Human-readable name of the item, used in accessible labels. */
  itemName: string;
  index: number;
  count: number;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

export function ListItemControls({
  idPrefix,
  itemName,
  index,
  count,
  onMove,
  onRemove,
}: ListItemControlsProps) {
  const position = `${index + 1} of ${count}`;
  return (
    <div className={styles.itemControls}>
      <button
        id={`${idPrefix}-up`}
        type="button"
        className={styles.smallButton}
        disabled={index === 0}
        aria-label={`Move up: ${itemName}, item ${position}`}
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">▲ </span>Move up
      </button>
      <button
        id={`${idPrefix}-down`}
        type="button"
        className={styles.smallButton}
        disabled={index === count - 1}
        aria-label={`Move down: ${itemName}, item ${position}`}
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">▼ </span>Move down
      </button>
      <button
        id={`${idPrefix}-remove`}
        type="button"
        className={`${styles.smallButton} ${styles.dangerButton}`}
        aria-label={`Remove: ${itemName}`}
        onClick={onRemove}
      >
        <span aria-hidden="true">✕ </span>Remove
      </button>
    </div>
  );
}
