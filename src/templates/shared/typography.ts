import type { FontId, HeadingSize } from "../../types/room";

/**
 * Curated system font stacks. No web fonts are downloaded: each stack
 * falls back through commonly installed fonts to a generic family.
 */
export const FONT_STACKS: Record<Exclude<FontId, "template">, string> = {
  "classic-sans": 'Tahoma, Verdana, Geneva, sans-serif',
  humanist: '"Trebuchet MS", "Segoe UI", "Gill Sans", sans-serif',
  geometric: 'Futura, "Century Gothic", "Avenir Next", Avenir, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  book: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  typewriter: '"Courier New", Courier, "Nimbus Mono PS", monospace',
  terminal: '"Lucida Console", Monaco, "DejaVu Sans Mono", monospace',
  impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif',
  handwritten: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", "Marker Felt", cursive',
};

export const FONT_LABELS: Record<FontId, string> = {
  template: "Template default",
  "classic-sans": "Classic sans (Tahoma)",
  humanist: "Humanist (Trebuchet)",
  geometric: "Geometric (Futura)",
  serif: "Serif (Georgia)",
  book: "Book (Palatino)",
  typewriter: "Typewriter (Courier)",
  terminal: "Terminal (Lucida Console)",
  impact: "Poster (Impact)",
  handwritten: "Handwritten (Comic Sans)",
};

export const HEADING_SCALE: Record<HeadingSize, number> = {
  small: 0.8,
  medium: 1,
  large: 1.25,
  huge: 1.55,
};

export const HEADING_SIZE_LABELS: Record<HeadingSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  huge: "Huge",
};
