import type { DecorationKind, DecorationSlot } from "../../types/room";

export const DECORATION_LABELS: Record<DecorationKind, string> = {
  "pixel-star": "Pixel star",
  heart: "Pixel heart",
  sparkle: "Sparkle",
  "divider-stars": "Star divider",
  "divider-hearts": "Heart divider",
  "sticker-smiley": "Smiley sticker",
  "sticker-cd": "CD sticker",
  "badge-construction": "“Under construction” badge",
  "badge-best-viewed": "“Best viewed” badge",
  "badge-handmade": "“Handmade” badge",
};

export const SLOT_LABELS: Record<DecorationSlot, string> = {
  "header-start": "Beside the title (left)",
  "header-end": "Beside the title (right)",
  "below-header": "Under the header",
  "below-widgets": "After the widgets",
  footer: "In the footer",
};

/** Dividers stretch across the slot rather than sitting inline. */
export function isDivider(kind: DecorationKind): boolean {
  return kind === "divider-stars" || kind === "divider-hearts";
}
