import type {
  BackgroundPattern,
  RoomArtwork,
  RoomConfig,
  RoomLink,
  RoomTheme,
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
} as const;

export const BACKGROUND_PATTERNS: readonly BackgroundPattern[] = [
  "plain",
  "stars",
  "checkerboard",
  "grid",
];

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

export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  return (
    typeof value === "string" &&
    (BACKGROUND_PATTERNS as readonly string[]).includes(value)
  );
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

/* ------------------------------------------------------------------ */
/* Field-level validation (used by the editor)                         */
/* ------------------------------------------------------------------ */

export type FieldErrorKind = "required" | "format";

export interface FieldError {
  kind: FieldErrorKind;
  message: string;
}

/** Keyed by field path, e.g. "title" or "artwork.art-001.imageUrl". */
export type FieldErrors = Record<string, FieldError>;

export const fieldPath = {
  artwork: (id: string, field: keyof RoomArtwork) => `artwork.${id}.${field}`,
  link: (id: string, field: keyof RoomLink) => `links.${id}.${field}`,
};

function requireText(
  errors: FieldErrors,
  path: string,
  value: string,
  label: string,
  max: number,
) {
  if (value.trim().length === 0) {
    errors[path] = { kind: "required", message: `${label} is required.` };
  } else if (value.length > max) {
    errors[path] = {
      kind: "format",
      message: `${label} must be ${max} characters or fewer.`,
    };
  }
}

function limitText(
  errors: FieldErrors,
  path: string,
  value: string,
  label: string,
  max: number,
) {
  if (value.length > max) {
    errors[path] = {
      kind: "format",
      message: `${label} must be ${max} characters or fewer.`,
    };
  }
}

/**
 * Validates a draft room for saving. Returns an empty object when the
 * room is valid. Assumes the room already has the correct shape (the
 * editor only ever produces well-formed objects).
 */
export function getFieldErrors(room: RoomConfig): FieldErrors {
  const errors: FieldErrors = {};

  requireText(errors, "title", room.title, "Room title", LIMITS.title);
  limitText(errors, "tagline", room.tagline, "Tagline", LIMITS.tagline);
  requireText(
    errors,
    "owner.displayName",
    room.owner.displayName,
    "Display name",
    LIMITS.displayName,
  );
  limitText(errors, "owner.bio", room.owner.bio, "Biography", LIMITS.bio);

  for (const key of THEME_COLOUR_KEYS) {
    if (!isHexColour(room.theme[key])) {
      errors[`theme.${key}`] = {
        kind: "format",
        message: "Use a hex colour such as #263F88.",
      };
    }
  }

  room.artwork.forEach((art) => {
    requireText(
      errors,
      fieldPath.artwork(art.id, "title"),
      art.title,
      "Artwork title",
      LIMITS.artworkTitle,
    );
    requireText(
      errors,
      fieldPath.artwork(art.id, "alt"),
      art.alt,
      "Alternative text",
      LIMITS.artworkAlt,
    );
    const urlPath = fieldPath.artwork(art.id, "imageUrl");
    if (art.imageUrl.trim().length === 0) {
      errors[urlPath] = { kind: "required", message: "Image URL is required." };
    } else if (!isSafeImageUrl(art.imageUrl)) {
      errors[urlPath] = {
        kind: "format",
        message:
          "Use an https:// image link or a bundled path such as /assets/images/digital-dreams.svg.",
      };
    }
  });

  room.links.forEach((link) => {
    requireText(
      errors,
      fieldPath.link(link.id, "label"),
      link.label,
      "Link label",
      LIMITS.linkLabel,
    );
    const urlPath = fieldPath.link(link.id, "url");
    if (link.url.trim().length === 0) {
      errors[urlPath] = { kind: "required", message: "Link URL is required." };
    } else if (!isSafeLinkUrl(link.url)) {
      errors[urlPath] = {
        kind: "format",
        message: "Links must start with https:// (for example https://archive.org).",
      };
    }
  });

  if (room.music) {
    requireText(
      errors,
      "music.title",
      room.music.title,
      "Track title",
      LIMITS.musicTitle,
    );
    requireText(
      errors,
      "music.artist",
      room.music.artist,
      "Artist",
      LIMITS.musicArtist,
    );
    limitText(
      errors,
      "music.description",
      room.music.description ?? "",
      "Description",
      LIMITS.musicDescription,
    );
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/* Structural validation (used for untrusted stored data)              */
/* ------------------------------------------------------------------ */

export type RoomValidationResult =
  | { ok: true; room: RoomConfig }
  | { ok: false; errors: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkString(
  errors: string[],
  value: unknown,
  path: string,
  max: number,
  required: boolean,
): value is string {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return false;
  }
  if (required && value.trim().length === 0) {
    errors.push(`${path} is required`);
    return false;
  }
  if (value.length > max) {
    errors.push(`${path} exceeds ${max} characters`);
    return false;
  }
  return true;
}

function checkId(
  errors: string[],
  value: unknown,
  path: string,
  seen: Set<string>,
) {
  if (!checkString(errors, value, path, LIMITS.id, true)) return;
  if (seen.has(value)) errors.push(`${path} "${value}" is not unique`);
  seen.add(value);
}

/**
 * Validates an unknown value (e.g. parsed localStorage JSON) against the
 * RoomConfig schema. On success, returns a fresh object containing only
 * known fields so unexpected keys are never carried into the app.
 */
export function validateRoomConfig(input: unknown): RoomValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ["room must be an object"] };
  }

  if (input.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (input.template !== "classic-web")
    errors.push('template must be "classic-web"');
  checkString(errors, input.id, "id", LIMITS.id, true);
  checkString(errors, input.title, "title", LIMITS.title, true);
  checkString(errors, input.tagline, "tagline", LIMITS.tagline, false);

  const owner = input.owner;
  if (!isPlainObject(owner)) {
    errors.push("owner must be an object");
  } else {
    checkString(
      errors,
      owner.displayName,
      "owner.displayName",
      LIMITS.displayName,
      true,
    );
    checkString(errors, owner.bio, "owner.bio", LIMITS.bio, false);
  }

  const theme = input.theme;
  if (!isPlainObject(theme)) {
    errors.push("theme must be an object");
  } else {
    for (const key of THEME_COLOUR_KEYS) {
      if (!isHexColour(theme[key])) {
        errors.push(`theme.${key} must be a #RRGGBB colour`);
      }
    }
    if (
      theme.backgroundPattern !== undefined &&
      !isBackgroundPattern(theme.backgroundPattern)
    ) {
      errors.push("theme.backgroundPattern is not a supported pattern");
    }
  }

  const widgets = input.widgets;
  if (!isPlainObject(widgets)) {
    errors.push("widgets must be an object");
  } else {
    for (const key of ["about", "gallery", "music", "links", "guestbook"]) {
      if (typeof widgets[key] !== "boolean") {
        errors.push(`widgets.${key} must be true or false`);
      }
    }
  }

  const artwork = input.artwork;
  if (!Array.isArray(artwork)) {
    errors.push("artwork must be a list");
  } else {
    if (artwork.length > LIMITS.galleryItems) {
      errors.push(`artwork has more than ${LIMITS.galleryItems} entries`);
    }
    const seen = new Set<string>();
    artwork.forEach((art: unknown, i) => {
      const p = `artwork[${i}]`;
      if (!isPlainObject(art)) {
        errors.push(`${p} must be an object`);
        return;
      }
      checkId(errors, art.id, `${p}.id`, seen);
      checkString(errors, art.title, `${p}.title`, LIMITS.artworkTitle, true);
      checkString(errors, art.alt, `${p}.alt`, LIMITS.artworkAlt, true);
      if (!isSafeImageUrl(art.imageUrl)) {
        errors.push(`${p}.imageUrl is not an allowed image URL`);
      }
    });
  }

  const links = input.links;
  if (!Array.isArray(links)) {
    errors.push("links must be a list");
  } else {
    if (links.length > LIMITS.links) {
      errors.push(`links has more than ${LIMITS.links} entries`);
    }
    const seen = new Set<string>();
    links.forEach((link: unknown, i) => {
      const p = `links[${i}]`;
      if (!isPlainObject(link)) {
        errors.push(`${p} must be an object`);
        return;
      }
      checkId(errors, link.id, `${p}.id`, seen);
      checkString(errors, link.label, `${p}.label`, LIMITS.linkLabel, true);
      if (!isSafeLinkUrl(link.url)) {
        errors.push(`${p}.url must be an https:// URL`);
      }
    });
  }

  const music = input.music;
  if (music !== null) {
    if (!isPlainObject(music)) {
      errors.push("music must be an object or null");
    } else {
      checkString(errors, music.title, "music.title", LIMITS.musicTitle, true);
      checkString(
        errors,
        music.artist,
        "music.artist",
        LIMITS.musicArtist,
        true,
      );
      if (music.description !== undefined) {
        checkString(
          errors,
          music.description,
          "music.description",
          LIMITS.musicDescription,
          false,
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Rebuild from known fields only. Casts are safe: everything was checked.
  const o = owner as Record<string, unknown>;
  const t = theme as Record<string, unknown>;
  const w = widgets as Record<string, unknown>;
  const m = music as Record<string, unknown> | null;

  const room: RoomConfig = {
    schemaVersion: 1,
    id: input.id as string,
    template: "classic-web",
    title: input.title as string,
    tagline: input.tagline as string,
    owner: {
      displayName: o.displayName as string,
      bio: o.bio as string,
    },
    theme: {
      backgroundColor: t.backgroundColor as string,
      primaryColor: t.primaryColor as string,
      secondaryColor: t.secondaryColor as string,
      accentColor: t.accentColor as string,
      textColor: t.textColor as string,
      ...(t.backgroundPattern !== undefined
        ? { backgroundPattern: t.backgroundPattern as BackgroundPattern }
        : {}),
    },
    widgets: {
      about: w.about as boolean,
      gallery: w.gallery as boolean,
      music: w.music as boolean,
      links: w.links as boolean,
      guestbook: w.guestbook as boolean,
    },
    artwork: (artwork as Record<string, unknown>[]).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      imageUrl: a.imageUrl as string,
      alt: a.alt as string,
    })),
    music: m
      ? {
          title: m.title as string,
          artist: m.artist as string,
          ...(m.description !== undefined
            ? { description: m.description as string }
            : {}),
        }
      : null,
    links: (links as Record<string, unknown>[]).map((l) => ({
      id: l.id as string,
      label: l.label as string,
      url: l.url as string,
    })),
  };

  return { ok: true, room };
}

/* ------------------------------------------------------------------ */
/* Normalisation (for dirty-state comparison)                          */
/* ------------------------------------------------------------------ */

/**
 * Produces a canonical representation so that equivalent rooms compare
 * equal: colours upper-cased, default pattern filled in, empty optional
 * music description removed, and a fixed key order.
 */
export function normaliseRoom(room: RoomConfig): RoomConfig {
  const description = room.music?.description;
  return {
    schemaVersion: 1,
    id: room.id,
    template: room.template,
    title: room.title,
    tagline: room.tagline,
    owner: { displayName: room.owner.displayName, bio: room.owner.bio },
    theme: {
      backgroundColor: room.theme.backgroundColor.toUpperCase(),
      primaryColor: room.theme.primaryColor.toUpperCase(),
      secondaryColor: room.theme.secondaryColor.toUpperCase(),
      accentColor: room.theme.accentColor.toUpperCase(),
      textColor: room.theme.textColor.toUpperCase(),
      backgroundPattern: room.theme.backgroundPattern ?? DEFAULT_PATTERN,
    },
    widgets: {
      about: room.widgets.about,
      gallery: room.widgets.gallery,
      music: room.widgets.music,
      links: room.widgets.links,
      guestbook: room.widgets.guestbook,
    },
    artwork: room.artwork.map((a) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.imageUrl,
      alt: a.alt,
    })),
    music: room.music
      ? {
          title: room.music.title,
          artist: room.music.artist,
          ...(description ? { description } : {}),
        }
      : null,
    links: room.links.map((l) => ({ id: l.id, label: l.label, url: l.url })),
  };
}

export function roomsEqual(a: RoomConfig, b: RoomConfig): boolean {
  return (
    JSON.stringify(normaliseRoom(a)) === JSON.stringify(normaliseRoom(b))
  );
}
