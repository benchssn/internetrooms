/**
 * Room configuration — schema version 2 (Milestone 4).
 *
 * Rooms are an ordered list of typed widget instances plus a theme
 * (colours, background, typography) and optional decorations. Version 1
 * rooms are migrated on load; see src/storage/migrations.ts.
 */

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every template id the app understands. The template registry
 * (src/templates/templateRegistry.ts) must provide an entry for each one —
 * TypeScript enforces this. The list lives here, rather than in the
 * registry, so validation can check ids without importing React components.
 */
export const TEMPLATE_IDS = ["classic-web", "cyber-room", "dream-room"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * Where an image comes from: an https:// URL (or bundled /assets/ path),
 * or an uploaded file stored in IndexedDB and referenced by id. Room JSON
 * never contains image data itself.
 */
export type ImageSource =
  | { kind: "url"; url: string }
  | { kind: "asset"; assetId: string };

/* ------------------------------------------------------------------ */
/* Shared content pieces                                               */
/* ------------------------------------------------------------------ */

export interface RoomLink {
  id: string;
  label: string;
  url: string;
}

export interface RoomArtwork {
  id: string;
  title: string;
  image: ImageSource;
  alt: string;
}

export interface RoomMusic {
  title: string;
  artist: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

export const WIDGET_TYPES = [
  "about",
  "gallery",
  "music",
  "links",
  "text",
  "image",
  "link-collection",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** The original widgets: exactly one of each, can be hidden but not deleted. */
export const CORE_WIDGET_TYPES = ["about", "gallery", "music", "links"] as const;
export type CoreWidgetType = (typeof CORE_WIDGET_TYPES)[number];

/** Widgets users can add, duplicate and delete freely. */
export const ADDABLE_WIDGET_TYPES = ["text", "image", "link-collection"] as const;
export type AddableWidgetType = (typeof ADDABLE_WIDGET_TYPES)[number];

export type WidgetWidth = "half" | "full";

interface WidgetBase<T extends WidgetType, C> {
  id: string;
  type: T;
  visible: boolean;
  width: WidgetWidth;
  content: C;
}

export type AboutWidget = WidgetBase<"about", { displayName: string; bio: string }>;
export type GalleryWidget = WidgetBase<"gallery", { artwork: RoomArtwork[] }>;
export type MusicWidget = WidgetBase<"music", { music: RoomMusic | null }>;
export type LinksWidget = WidgetBase<"links", { links: RoomLink[] }>;
export type TextWidget = WidgetBase<"text", { title: string; body: string }>;
export type ImageWidget = WidgetBase<
  "image",
  { image: ImageSource | null; alt: string; caption: string }
>;
export type LinkCollectionWidget = WidgetBase<
  "link-collection",
  { title: string; links: RoomLink[] }
>;

export type WidgetInstance =
  | AboutWidget
  | GalleryWidget
  | MusicWidget
  | LinksWidget
  | TextWidget
  | ImageWidget
  | LinkCollectionWidget;

/** Narrows a widget union member by its type tag. */
export type WidgetOfType<T extends WidgetType> = Extract<WidgetInstance, { type: T }>;

/** Maps each widget type to its content shape. */
export type WidgetContentMap = {
  [W in WidgetInstance as W["type"]]: W["content"];
};

export interface RoomLayout {
  widgets: WidgetInstance[];
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

export const BACKGROUND_PATTERNS = ["plain", "stars", "checkerboard", "grid"] as const;
export type BackgroundPattern = (typeof BACKGROUND_PATTERNS)[number];

/** Which background layer is active. Pattern "plain" is a solid colour. */
export const BACKGROUND_MODES = ["pattern", "gradient", "image"] as const;
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];

export const GRADIENT_DIRECTIONS = [
  "to bottom",
  "to right",
  "to bottom right",
  "to top right",
  "radial",
] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

export const IMAGE_FITS = ["cover", "tile"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

export interface RoomBackground {
  mode: BackgroundMode;
  /** Used when mode is "gradient". Kept when switching modes. */
  gradient: { from: string; to: string; direction: GradientDirection };
  /** Used when mode is "image". Kept when switching modes. */
  image: { source: ImageSource | null; fit: ImageFit };
}

/** "template" means: use the current template's own font. */
export const FONT_IDS = [
  "template",
  "classic-sans",
  "humanist",
  "geometric",
  "serif",
  "book",
  "typewriter",
  "terminal",
  "impact",
  "handwritten",
] as const;
export type FontId = (typeof FONT_IDS)[number];

export const HEADING_SIZES = ["small", "medium", "large", "huge"] as const;
export type HeadingSize = (typeof HEADING_SIZES)[number];

export const TEXT_ALIGNS = ["template", "left", "center"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export interface RoomTypography {
  headingFont: FontId;
  bodyFont: FontId;
  headingSize: HeadingSize;
  align: TextAlign;
}

export interface RoomTheme {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundPattern: BackgroundPattern;
  background: RoomBackground;
  typography: RoomTypography;
}

/* ------------------------------------------------------------------ */
/* Decorations                                                         */
/* ------------------------------------------------------------------ */

export const DECORATION_KINDS = [
  "pixel-star",
  "heart",
  "sparkle",
  "divider-stars",
  "divider-hearts",
  "sticker-smiley",
  "sticker-cd",
  "badge-construction",
  "badge-best-viewed",
  "badge-handmade",
] as const;
export type DecorationKind = (typeof DECORATION_KINDS)[number];

/** Fixed places in every template where decorations can sit. */
export const DECORATION_SLOTS = [
  "header-start",
  "header-end",
  "below-header",
  "below-widgets",
  "footer",
] as const;
export type DecorationSlot = (typeof DECORATION_SLOTS)[number];

export interface Decoration {
  id: string;
  kind: DecorationKind;
  slot: DecorationSlot;
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

export const CURRENT_SCHEMA_VERSION = 2;

export interface RoomConfig {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  id: string;
  template: TemplateId;
  title: string;
  tagline: string;
  theme: RoomTheme;
  layout: RoomLayout;
  decorations: Decoration[];
}
