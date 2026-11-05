/**
 * Small, dependency-free validation helpers shared by the current schema,
 * the v1 migration path and the upload pipeline.
 */
import {
  BACKGROUND_PATTERNS,
  TEMPLATE_IDS,
  type BackgroundPattern,
  type RoomTheme,
  type TemplateId,
} from "../types/room";

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  title: 80,
  tagline: 160,
  displayName: 40,
  bio: 1000,
  artworkTitle: 100,
  artworkAlt: 250,
  linkLabel: 80,
  musicTitle: 100,
  musicArtist: 100,
  musicDescription: 300,
  url: 2048,
  galleryItems: 12,
  links: 20,
  id: 64,
  /** New in Milestone 4. */
  widgetTitle: 80,
  textBody: 5000,
  imageCaption: 200,
  widgets: 40,
  decorations: 16,
} as const;

/** Pattern used when a room does not specify one (Milestone 1 look). */
export const DEFAULT_PATTERN: BackgroundPattern = "stars";

export const THEME_COLOUR_KEYS = [
  "backgroundColor",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "textColor",
] as const satisfies readonly (keyof RoomTheme)[];

export type ThemeColourKey = (typeof THEME_COLOUR_KEYS)[number];

/* ------------------------------------------------------------------ */
/* Primitive checks                                                    */
/* ------------------------------------------------------------------ */

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOUR.test(value);
}

/**
 * Turns loose user input ("#abc", "AABBCC", " #aabbcc ") into "#AABBCC".
 * Returns null when the input cannot be read as a hex colour.
 */
export function parseHexColour(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    const expanded = raw
      .split("")
      .map((ch) => ch + ch)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return null;
}

export function isTemplateId(value: unknown): value is TemplateId {
  return (
    typeof value === "string" &&
    (TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  return isOneOf(BACKGROUND_PATTERNS, value);
}

/** True when `value` is one of the strings in `options`. */
export function isOneOf<T extends string>(
  options: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHttpsUrl(value: string): URL | null {
  if (value.length === 0 || value.length > LIMITS.url) return null;
  // Reject whitespace / control characters outright rather than letting
  // the URL parser silently strip them.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (url.username || url.password) return null;
  return url;
}

/** Links must be absolute https:// URLs. */
export function isSafeLinkUrl(value: unknown): value is string {
  return typeof value === "string" && parseHttpsUrl(value) !== null;
}

/**
 * Bundled local assets live under /assets/ in `public/`.
 * Only simple path characters are allowed and no directory traversal.
 */
const LOCAL_ASSET_PATH =
  /^\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|webp|avif|svg)$/i;

export function isLocalAssetPath(value: string): boolean {
  return (
    value.length <= LIMITS.url &&
    LOCAL_ASSET_PATH.test(value) &&
    !value.includes("..")
  );
}

/** Artwork images must be https:// URLs or bundled /assets/ paths. */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("/")) return isLocalAssetPath(value);
  return parseHttpsUrl(value) !== null;
}
