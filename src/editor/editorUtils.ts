import { useEffect, useRef } from "react";
import type { RoomUpdater, UpdateOptions } from "../hooks/useRoomDraft";
import type {
  AddableWidgetType,
  BackgroundPattern,
  CoreWidgetType,
  RoomArtwork,
  RoomConfig,
  RoomLink,
  WidgetContentMap,
  WidgetInstance,
  WidgetOfType,
  WidgetType,
  WidgetWidth,
} from "../types/room";
import type { FieldError, ThemeColourKey } from "../validation/roomValidation";

/** Callback the editor sections use to change the draft room. */
export type UpdateRoom = (updater: RoomUpdater, options?: UpdateOptions) => void;

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const COLOUR_LABELS: Record<ThemeColourKey, string> = {
  backgroundColor: "Background colour",
  primaryColor: "Primary colour",
  secondaryColor: "Secondary colour",
  accentColor: "Accent colour",
  textColor: "Text colour",
};

export const COLOUR_HINTS: Record<ThemeColourKey, string> = {
  backgroundColor: "Behind everything",
  primaryColor: "Panels and cards",
  secondaryColor: "Title bars, frames and soft tints",
  accentColor: "Highlights and glow",
  textColor: "All room text",
};

export const PATTERN_LABELS: Record<BackgroundPattern, string> = {
  plain: "Plain colour",
  stars: "Pixel stars",
  checkerboard: "Checkerboard",
  grid: "Retro grid",
};

export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  about: "About Me",
  gallery: "Art Gallery",
  music: "Music",
  links: "Favourite Links",
  text: "Text block",
  image: "Image block",
  "link-collection": "Link collection",
};

/* ------------------------------------------------------------------ */
/* Ids and lists                                                       */
/* ------------------------------------------------------------------ */

/** Creates an id with the given prefix that isn't already in use. */
export function createId(prefix: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let id: string;
  do {
    const random = Math.random().toString(36).slice(2, 8);
    id = `${prefix}-${Date.now().toString(36)}-${random}`;
  } while (taken.has(id));
  return id;
}

export function createArtwork(existing: RoomArtwork[]): RoomArtwork {
  return {
    id: createId(
      "art",
      existing.map((a) => a.id),
    ),
    title: "",
    image: { kind: "url", url: "" },
    alt: "",
  };
}

export function createLink(existing: RoomLink[]): RoomLink {
  return {
    id: createId(
      "link",
      existing.map((l) => l.id),
    ),
    label: "",
    url: "",
  };
}

/** Returns a new array with the item at `from` moved to `to`. */
export function moveTo<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Returns a new array with the item at `from` moved by `offset`. */
export function moveItem<T>(items: T[], from: number, offset: -1 | 1): T[] {
  return moveTo(items, from, from + offset);
}

export function updateById<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

/** A short human name for a widget, used in labels and announcements. */
export function editorWidgetName(widget: WidgetInstance): string {
  switch (widget.type) {
    case "text":
    case "link-collection":
      return widget.content.title.trim() || WIDGET_TYPE_LABELS[widget.type];
    case "image":
      return widget.content.caption.trim() || WIDGET_TYPE_LABELS.image;
    default:
      return WIDGET_TYPE_LABELS[widget.type];
  }
}

export function isAddable(type: WidgetType): type is AddableWidgetType {
  return type === "text" || type === "image" || type === "link-collection";
}

export function findWidget<T extends WidgetType>(
  room: RoomConfig,
  id: string,
  type: T,
): WidgetOfType<T> | undefined {
  const widget = room.layout.widgets.find((w) => w.id === id);
  return widget?.type === type ? (widget as WidgetOfType<T>) : undefined;
}

/** Replaces the widget with `id` (if it exists) with `fn(widget)`. */
export function mapWidgets(
  room: RoomConfig,
  fn: (widgets: WidgetInstance[]) => WidgetInstance[],
): RoomConfig {
  return { ...room, layout: { ...room.layout, widgets: fn(room.layout.widgets) } };
}

/**
 * Merges `patch` into the content of the widget with this id and type.
 * Does nothing if the widget is gone or has changed type.
 */
export function patchWidgetContent<T extends WidgetType>(
  room: RoomConfig,
  id: string,
  type: T,
  patch: (content: WidgetContentMap[T]) => Partial<WidgetContentMap[T]>,
): RoomConfig {
  const widget = findWidget(room, id, type);
  if (!widget) return room;
  // findWidget has checked the type tag, so the content matches T.
  const current = widget.content as WidgetContentMap[T];
  const content = { ...current, ...patch(current) };
  return mapWidgets(room, (ws) => ws.map((w) => (w.id === id ? ({ ...w, content } as WidgetInstance) : w)));
}

export function patchWidget(
  room: RoomConfig,
  id: string,
  patch: Partial<Pick<WidgetInstance, "visible" | "width">>,
): RoomConfig {
  return mapWidgets(room, (ws) =>
    ws.map((w) => (w.id === id ? ({ ...w, ...patch } as WidgetInstance) : w)),
  );
}

export const DEFAULT_WIDTHS: Record<WidgetType, WidgetWidth> = {
  about: "half",
  music: "half",
  gallery: "full",
  links: "full",
  text: "half",
  image: "half",
  "link-collection": "half",
};

const CORE_ORDER: CoreWidgetType[] = ["about", "music", "gallery", "links"];

export function createWidget(type: AddableWidgetType, existing: WidgetInstance[]): WidgetInstance {
  const id = createId(
    "w",
    existing.map((w) => w.id),
  );
  const base = { id, visible: true, width: DEFAULT_WIDTHS[type] };
  switch (type) {
    case "text":
      return { ...base, type, content: { title: "", body: "" } };
    case "image":
      return { ...base, type, content: { image: null, alt: "", caption: "" } };
    case "link-collection":
      return { ...base, type, content: { title: "", links: [] } };
  }
}

/** A copy of a widget with a fresh id (content is deep-copied). */
export function duplicateWidget(widget: WidgetInstance, existing: WidgetInstance[]): WidgetInstance {
  return {
    ...structuredClone(widget),
    id: createId(
      "w",
      existing.map((w) => w.id),
    ),
  };
}

/**
 * Restores the default arrangement: the original widgets first in their
 * standard order, then added widgets in their current relative order,
 * all at their default widths. Visibility and content are untouched.
 */
export function resetLayout(widgets: WidgetInstance[]): WidgetInstance[] {
  const core = CORE_ORDER.flatMap((type) => widgets.filter((w) => w.type === type));
  const others = widgets.filter((w) => isAddable(w.type));
  return [...core, ...others].map(
    (w) => ({ ...w, width: DEFAULT_WIDTHS[w.type] }) as WidgetInstance,
  );
}

/** Every uploaded asset id a room refers to (including hidden widgets). */
export function collectAssetIds(room: RoomConfig): Set<string> {
  const ids = new Set<string>();
  const bg = room.theme.background.image.source;
  if (bg?.kind === "asset") ids.add(bg.assetId);
  for (const w of room.layout.widgets) {
    if (w.type === "image" && w.content.image?.kind === "asset") ids.add(w.content.image.assetId);
    if (w.type === "gallery") {
      for (const art of w.content.artwork) {
        if (art.image.kind === "asset") ids.add(art.image.assetId);
      }
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/* Colour contrast (WCAG relative luminance)                           */
/* ------------------------------------------------------------------ */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ */
/* Focus helper for list reordering                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns a function that queues focus for after the next render.
 * Pass element ids in priority order; the first enabled one wins.
 * Used so focus follows an item when it moves or is removed.
 */
export function usePendingFocus() {
  const pending = useRef<string[] | null>(null);

  useEffect(() => {
    const ids = pending.current;
    if (!ids) return;
    pending.current = null;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && !(el as HTMLButtonElement).disabled) {
        el.focus();
        return;
      }
    }
  });

  return (ids: string[]) => {
    pending.current = ids;
  };
}

/* ------------------------------------------------------------------ */
/* Shared props for editor sections                                    */
/* ------------------------------------------------------------------ */

export interface SectionProps {
  room: RoomConfig;
  update: UpdateRoom;
  /** Returns the error to display for a field path, if any. */
  errorFor: (path: string) => FieldError | undefined;
  /** True if any error (shown or not) exists at or under this path prefix. */
  hasErrorsUnder: (prefix: string) => boolean;
  /** True after a failed save: hidden problems should be revealed. */
  showAllErrors: boolean;
  /** Sends a message to the editor's polite live region. */
  announce: (message: string) => void;
  /** Shows a message with an Undo button (e.g. after deleting something). */
  notifyUndoable: (message: string) => void;
}

/** Props for an editor of one widget's content. */
export interface WidgetEditorProps<T extends WidgetType> extends SectionProps {
  widget: WidgetOfType<T>;
}
