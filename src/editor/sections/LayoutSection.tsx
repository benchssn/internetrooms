import { useId, useState } from "react";
import { ADDABLE_WIDGET_TYPES, type AddableWidgetType, type WidgetInstance } from "../../types/room";
import { LIMITS } from "../../validation/roomValidation";
import { EditorSection, ToggleField } from "../EditorField";
import {
  createWidget,
  duplicateWidget,
  editorWidgetName,
  isAddable,
  mapWidgets,
  moveTo,
  patchWidget,
  resetLayout,
  usePendingFocus,
  WIDGET_TYPE_LABELS,
  type SectionProps,
} from "../editorUtils";
import styles from "../RoomEditor.module.css";
import { useDragSort } from "../useDragSort";
import { WidgetContentEditor } from "../widgets/WidgetContentEditor";

const ADD_LABELS: Record<AddableWidgetType, string> = {
  text: "Text block",
  image: "Image block",
  "link-collection": "Link collection",
};

/** Where to put focus when a new widget's editor opens. */
function firstFieldId(widget: WidgetInstance): string {
  return widget.type === "image" ? `ed-${widget.id}-image-url` : `ed-${widget.id}-title`;
}

export function LayoutSection(props: SectionProps) {
  const { room, update, hasErrorsUnder, showAllErrors, announce, notifyUndoable } = props;
  const widgets = room.layout.widgets;
  const ids = widgets.map((w) => w.id);
  const focusLater = usePendingFocus();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const hintId = useId();
  const full = widgets.length >= LIMITS.widgets;

  const moveWidget = (from: number, to: number) => {
    const widget = widgets[from];
    if (!widget || to < 0 || to >= widgets.length) return;
    update((r) => mapWidgets(r, (ws) => moveTo(ws, ws.findIndex((w) => w.id === widget.id), to)));
    announce(`Moved ${editorWidgetName(widget)} to position ${to + 1} of ${widgets.length}.`);
  };

  const { drag, rowRef, handleProps } = useDragSort(ids, (from, to) => {
    moveWidget(from, to);
    const id = ids[from];
    focusLater([`ed-widget-${id}-handle`]);
  });

  const toggleOpen = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = (type: AddableWidgetType) => {
    if (full) return;
    const widget = createWidget(type, widgets);
    update((r) => mapWidgets(r, (ws) => [...ws, widget]));
    setOpen((current) => new Set(current).add(widget.id));
    focusLater([firstFieldId(widget)]);
    announce(`${ADD_LABELS[type]} added at the end of the room.`);
  };

  const duplicate = (widget: WidgetInstance) => {
    if (full) return;
    const copy = duplicateWidget(widget, widgets);
    update((r) =>
      mapWidgets(r, (ws) => {
        const at = ws.findIndex((w) => w.id === widget.id);
        return [...ws.slice(0, at + 1), copy, ...ws.slice(at + 1)];
      }),
    );
    focusLater([`ed-widget-${copy.id}-handle`]);
    announce(`Duplicated ${editorWidgetName(widget)}.`);
  };

  const remove = (widget: WidgetInstance, index: number) => {
    update((r) => mapWidgets(r, (ws) => ws.filter((w) => w.id !== widget.id)));
    const neighbour = widgets[index + 1] ?? widgets[index - 1];
    focusLater(neighbour ? [`ed-widget-${neighbour.id}-handle`] : ["ed-add-text"]);
    notifyUndoable(`Deleted ${editorWidgetName(widget)}.`);
  };

  return (
    <EditorSection
      title="Layout & widgets"
      icon="▤"
      description="Arrange your room. Drag the handle (or use the arrow keys on it), choose half or full width, and open a widget to edit its content."
    >
      <p id={hintId} className={styles.visuallyHidden}>
        Press the arrow keys to move this widget up or down.
      </p>
      <ol className={styles.widgetList}>
        {widgets.map((widget, index) => {
          const name = editorWidgetName(widget);
          const hasErrors = hasErrorsUnder(`widgets.${widget.id}.`);
          const isOpen = open.has(widget.id) || (showAllErrors && hasErrors);
          const panelId = `ed-widget-${widget.id}-panel`;
          const dropTarget =
            drag && drag.id !== widget.id && drag.over === index
              ? drag.over > drag.from
                ? "after"
                : "before"
              : undefined;
          return (
            <li
              key={widget.id}
              ref={rowRef(widget.id)}
              className={styles.widgetRow}
              data-dragging={drag?.id === widget.id ? "true" : undefined}
              data-drop={dropTarget}
              data-hidden={widget.visible ? undefined : "true"}
            >
              <div className={styles.widgetHeader}>
                <button
                  id={`ed-widget-${widget.id}-handle`}
                  type="button"
                  className={styles.dragHandle}
                  aria-label={`Reorder ${name}, position ${index + 1} of ${widgets.length}`}
                  aria-describedby={hintId}
                  {...handleProps(widget.id, index)}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <div className={styles.widgetTitle}>
                  <span className={styles.widgetName}>{name}</span>
                  <span className={styles.widgetMeta}>
                    {WIDGET_TYPE_LABELS[widget.type]} · {widget.width === "full" ? "Full width" : "Half width"}
                    {widget.visible ? "" : " · Hidden"}
                  </span>
                  {hasErrors && showAllErrors ? (
                    <span className={styles.errorBadge}>
                      <span aria-hidden="true">⚠ </span>Needs attention
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={styles.smallButton}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`${isOpen ? "Close" : "Edit"} ${name}`}
                  onClick={() => toggleOpen(widget.id)}
                >
                  {isOpen ? "Close" : "Edit"}
                </button>
              </div>

              <div className={styles.widgetControls}>
                <ToggleField
                  label={`Show ${name}`}
                  checked={widget.visible}
                  onChange={(visible) => {
                    update((r) => patchWidget(r, widget.id, { visible }));
                    announce(`${name} ${visible ? "shown" : "hidden"}.`);
                  }}
                />
                <fieldset className={styles.widthGroup}>
                  <legend className={styles.visuallyHidden}>Width of {name}</legend>
                  {(["half", "full"] as const).map((width) => (
                    <label key={width} className={styles.segment}>
                      <input
                        type="radio"
                        name={`ed-widget-${widget.id}-width`}
                        checked={widget.width === width}
                        onChange={() => update((r) => patchWidget(r, widget.id, { width }))}
                      />
                      <span>{width === "half" ? "Half" : "Full"}</span>
                    </label>
                  ))}
                </fieldset>
                <div className={styles.itemControls}>
                  <button
                    id={`ed-widget-${widget.id}-up`}
                    type="button"
                    className={styles.smallButton}
                    disabled={index === 0}
                    aria-label={`Move up: ${name}`}
                    onClick={() => {
                      moveWidget(index, index - 1);
                      focusLater([`ed-widget-${widget.id}-up`, `ed-widget-${widget.id}-down`]);
                    }}
                  >
                    <span aria-hidden="true">▲ </span>Up
                  </button>
                  <button
                    id={`ed-widget-${widget.id}-down`}
                    type="button"
                    className={styles.smallButton}
                    disabled={index === widgets.length - 1}
                    aria-label={`Move down: ${name}`}
                    onClick={() => {
                      moveWidget(index, index + 1);
                      focusLater([`ed-widget-${widget.id}-down`, `ed-widget-${widget.id}-up`]);
                    }}
                  >
                    <span aria-hidden="true">▼ </span>Down
                  </button>
                  {isAddable(widget.type) ? (
                    <>
                      <button
                        type="button"
                        className={styles.smallButton}
                        disabled={full}
                        aria-label={`Duplicate: ${name}`}
                        onClick={() => duplicate(widget)}
                      >
                        <span aria-hidden="true">⧉ </span>Duplicate
                      </button>
                      <button
                        type="button"
                        className={`${styles.smallButton} ${styles.dangerButton}`}
                        aria-label={`Delete: ${name}`}
                        onClick={() => remove(widget, index)}
                      >
                        <span aria-hidden="true">✕ </span>Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {isOpen ? (
                <div id={panelId} className={styles.widgetPanel} role="group" aria-label={`${name} content`}>
                  <WidgetContentEditor {...props} widget={widget} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className={styles.addRow} role="group" aria-label="Add a widget">
        {ADDABLE_WIDGET_TYPES.map((type) => (
          <button
            key={type}
            id={`ed-add-${type}`}
            type="button"
            className={styles.secondaryButton}
            disabled={full}
            onClick={() => add(type)}
          >
            <span aria-hidden="true">+ </span>
            {ADD_LABELS[type]}
          </button>
        ))}
      </div>
      {full ? <p className={styles.hint}>Rooms can hold up to {LIMITS.widgets} widgets.</p> : null}

      <button
        type="button"
        className={styles.linkLikeButton}
        onClick={() => {
          update((r) => mapWidgets(r, resetLayout));
          announce("Widget positions and widths reset. Your content is unchanged.");
        }}
      >
        <span aria-hidden="true">↺ </span>Reset widget positions
      </button>
    </EditorSection>
  );
}
