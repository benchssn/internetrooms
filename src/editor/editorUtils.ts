import { useEffect, useRef } from "react";
import type {
  BackgroundPattern,
  RoomArtwork,
  RoomConfig,
  RoomLink,
} from "../types/room";
import type {
  FieldError,
  ThemeColourKey,
} from "../validation/roomValidation";

/** Callback the editor sections use to change the draft room. */
export type UpdateRoom = (updater: (room: RoomConfig) => RoomConfig) => void;

export const COLOUR_LABELS: Record<ThemeColourKey, string> = {
  backgroundColor: "Background colour",
  primaryColor: "Primary colour",
  secondaryColor: "Secondary colour",
  accentColor: "Accent colour",
  textColor: "Text colour",
};

export const COLOUR_HINTS: Record<ThemeColourKey, string> = {
  backgroundColor: "Behind everything",
  primaryColor: "Window and header panels",
  secondaryColor: "Title bars and frames",
  accentColor: "Highlights and title-bar glow",
  textColor: "All room text",
};

export const PATTERN_LABELS: Record<BackgroundPattern, string> = {
  plain: "Plain",
  stars: "Pixel stars",
  checkerboard: "Checkerboard",
  grid: "Retro grid",
};

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
    imageUrl: "",
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

/** Returns a new array with the item at `from` moved by `offset`. */
export function moveItem<T>(items: T[], from: number, offset: -1 | 1): T[] {
  const to = from + offset;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function updateById<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/* ---- Colour contrast (WCAG relative luminance) ---- */

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

/* ---- Focus helper for list reordering ---- */

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

/* ---- Shared props for editor sections ---- */

export interface SectionProps {
  room: RoomConfig;
  update: UpdateRoom;
  /** Returns the error to display for a field path, if any. */
  errorFor: (path: string) => FieldError | undefined;
  /** Sends a message to the editor's polite live region. */
  announce: (message: string) => void;
}
