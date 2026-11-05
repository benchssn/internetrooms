import {
  BACKGROUND_MODES,
  CORE_WIDGET_TYPES,
  CURRENT_SCHEMA_VERSION,
  DECORATION_KINDS,
  DECORATION_SLOTS,
  FONT_IDS,
  GRADIENT_DIRECTIONS,
  HEADING_SIZES,
  IMAGE_FITS,
  TEXT_ALIGNS,
  WIDGET_TYPES,
  type Decoration,
  type ImageSource,
  type RoomArtwork,
  type RoomBackground,
  type RoomConfig,
  type RoomLink,
  type RoomMusic,
  type RoomTheme,
  type RoomTypography,
  type TemplateId,
  type WidgetInstance,
  type WidgetWidth,
} from "../types/room";
import {
  isBackgroundPattern,
  isHexColour,
  isOneOf,
  isPlainObject,
  isSafeImageUrl,
  isSafeLinkUrl,
  isTemplateId,
  LIMITS,
  THEME_COLOUR_KEYS,
} from "./primitives";

// Re-exported so existing imports from "validation/roomValidation" keep working.
export * from "./primitives";

/* ------------------------------------------------------------------ */
/* Asset ids                                                           */
/* ------------------------------------------------------------------ */

const ASSET_ID = /^asset-[A-Za-z0-9_-]{1,56}$/;

export function isAssetId(value: unknown): value is string {
  return typeof value === "string" && ASSET_ID.test(value);
}

export function isValidImageSource(value: ImageSource): boolean {
  return value.kind === "url" ? isSafeImageUrl(value.url) : isAssetId(value.assetId);
}

/* ------------------------------------------------------------------ */
/* Field-level validation (used by the editor)                         */
/* ------------------------------------------------------------------ */

export type FieldErrorKind = "required" | "format";

export interface FieldError {
  kind: FieldErrorKind;
  message: string;
}

/** Keyed by field path, e.g. "title" or "widgets.w-links.links.l1.url". */
export type FieldErrors = Record<string, FieldError>;

export const fieldPath = {
  /** A field directly on a widget's content, e.g. bio or title. */
  widget: (widgetId: string, field: string) => `widgets.${widgetId}.${field}`,
  /** A field on an item inside a widget list (artwork or links). */
  item: (widgetId: string, list: string, itemId: string, field: string) =>
    `widgets.${widgetId}.${list}.${itemId}.${field}`,
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

const IMAGE_URL_MESSAGE =
  "Use an https:// image link, a bundled path such as /assets/images/digital-dreams.svg, or upload an image.";

function checkImage(
  errors: FieldErrors,
  path: string,
  source: ImageSource | null,
  label: string,
) {
  if (source === null || (source.kind === "url" && source.url.trim() === "")) {
    errors[path] = { kind: "required", message: `${label} is required.` };
  } else if (!isValidImageSource(source)) {
    errors[path] = { kind: "format", message: IMAGE_URL_MESSAGE };
  }
}

function checkLinks(errors: FieldErrors, widgetId: string, links: RoomLink[]) {
  for (const link of links) {
    requireText(
      errors,
      fieldPath.item(widgetId, "links", link.id, "label"),
      link.label,
      "Link label",
      LIMITS.linkLabel,
    );
    const urlPath = fieldPath.item(widgetId, "links", link.id, "url");
    if (link.url.trim().length === 0) {
      errors[urlPath] = { kind: "required", message: "Link URL is required." };
    } else if (!isSafeLinkUrl(link.url)) {
      errors[urlPath] = {
        kind: "format",
        message: "Links must start with https:// (for example https://archive.org).",
      };
    }
  }
}

function checkWidget(errors: FieldErrors, widget: WidgetInstance) {
  const id = widget.id;
  switch (widget.type) {
    case "about":
      requireText(
        errors,
        fieldPath.widget(id, "displayName"),
        widget.content.displayName,
        "Display name",
        LIMITS.displayName,
      );
      limitText(errors, fieldPath.widget(id, "bio"), widget.content.bio, "Biography", LIMITS.bio);
      return;
    case "gallery":
      for (const art of widget.content.artwork) {
        requireText(
          errors,
          fieldPath.item(id, "artwork", art.id, "title"),
          art.title,
          "Artwork title",
          LIMITS.artworkTitle,
        );
        requireText(
          errors,
          fieldPath.item(id, "artwork", art.id, "alt"),
          art.alt,
          "Alternative text",
          LIMITS.artworkAlt,
        );
        checkImage(errors, fieldPath.item(id, "artwork", art.id, "image"), art.image, "Image");
      }
      return;
    case "music": {
      const music = widget.content.music;
      if (!music) return;
      requireText(errors, fieldPath.widget(id, "title"), music.title, "Track title", LIMITS.musicTitle);
      requireText(errors, fieldPath.widget(id, "artist"), music.artist, "Artist", LIMITS.musicArtist);
      limitText(
        errors,
        fieldPath.widget(id, "description"),
        music.description ?? "",
        "Description",
        LIMITS.musicDescription,
      );
      return;
    }
    case "links":
      checkLinks(errors, id, widget.content.links);
      return;
    case "text":
      limitText(errors, fieldPath.widget(id, "title"), widget.content.title, "Heading", LIMITS.widgetTitle);
      requireText(errors, fieldPath.widget(id, "body"), widget.content.body, "Text", LIMITS.textBody);
      return;
    case "image":
      checkImage(errors, fieldPath.widget(id, "image"), widget.content.image, "Image");
      requireText(errors, fieldPath.widget(id, "alt"), widget.content.alt, "Alternative text", LIMITS.artworkAlt);
      limitText(errors, fieldPath.widget(id, "caption"), widget.content.caption, "Caption", LIMITS.imageCaption);
      return;
    case "link-collection":
      limitText(errors, fieldPath.widget(id, "title"), widget.content.title, "Heading", LIMITS.widgetTitle);
      checkLinks(errors, id, widget.content.links);
      return;
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

  for (const key of THEME_COLOUR_KEYS) {
    if (!isHexColour(room.theme[key])) {
      errors[`theme.${key}`] = { kind: "format", message: "Use a hex colour such as #263F88." };
    }
  }

  const { background } = room.theme;
  if (background.mode === "image") {
    checkImage(errors, "theme.background.image", background.image.source, "Background image");
  }

  for (const widget of room.layout.widgets) checkWidget(errors, widget);

  return errors;
}

/* ------------------------------------------------------------------ */
/* Structural validation (used for untrusted stored data)              */
/* ------------------------------------------------------------------ */

export type RoomValidationResult =
  | { ok: true; room: RoomConfig }
  | { ok: false; errors: string[] };

/**
 * Collects problems while reading an unknown value. Each reader returns
 * a clean, typed copy (or undefined) so unknown keys never leak through.
 */
class Reader {
  readonly errors: string[] = [];

  fail(message: string): undefined {
    this.errors.push(message);
    return undefined;
  }

  string(value: unknown, path: string, max: number, required = false): string | undefined {
    if (typeof value !== "string") return this.fail(`${path} must be a string`);
    if (required && value.trim().length === 0) return this.fail(`${path} is required`);
    if (value.length > max) return this.fail(`${path} exceeds ${max} characters`);
    return value;
  }

  colour(value: unknown, path: string): string | undefined {
    return isHexColour(value) ? value : this.fail(`${path} must be a #RRGGBB colour`);
  }

  oneOf<T extends string>(options: readonly T[], value: unknown, path: string): T | undefined {
    return isOneOf(options, value) ? value : this.fail(`${path} is not a supported value`);
  }

  boolean(value: unknown, path: string): boolean | undefined {
    return typeof value === "boolean" ? value : this.fail(`${path} must be true or false`);
  }

  object(value: unknown, path: string): Record<string, unknown> | undefined {
    return isPlainObject(value) ? value : this.fail(`${path} must be an object`);
  }

  id(value: unknown, path: string, seen: Set<string>): string | undefined {
    const id = this.string(value, path, LIMITS.id, true);
    if (id === undefined) return undefined;
    if (seen.has(id)) return this.fail(`${path} "${id}" is not unique`);
    seen.add(id);
    return id;
  }

  list(value: unknown, path: string, max: number): unknown[] | undefined {
    if (!Array.isArray(value)) return this.fail(`${path} must be a list`);
    if (value.length > max) return this.fail(`${path} has more than ${max} entries`);
    return value;
  }

  imageSource(value: unknown, path: string): ImageSource | undefined {
    const o = this.object(value, path);
    if (!o) return undefined;
    if (o.kind === "url") {
      return isSafeImageUrl(o.url)
        ? { kind: "url", url: o.url }
        : this.fail(`${path}.url is not an allowed image URL`);
    }
    if (o.kind === "asset") {
      return isAssetId(o.assetId)
        ? { kind: "asset", assetId: o.assetId }
        : this.fail(`${path}.assetId is not a valid asset id`);
    }
    return this.fail(`${path}.kind must be "url" or "asset"`);
  }

  links(value: unknown, path: string): RoomLink[] | undefined {
    const list = this.list(value, path, LIMITS.links);
    if (!list) return undefined;
    const seen = new Set<string>();
    const out: RoomLink[] = [];
    list.forEach((item, i) => {
      const p = `${path}[${i}]`;
      const o = this.object(item, p);
      if (!o) return;
      const id = this.id(o.id, `${p}.id`, seen);
      const label = this.string(o.label, `${p}.label`, LIMITS.linkLabel, true);
      const url = isSafeLinkUrl(o.url) ? o.url : this.fail(`${p}.url must be an https:// URL`);
      if (id !== undefined && label !== undefined && url !== undefined) {
        out.push({ id, label, url });
      }
    });
    return out;
  }

  artwork(value: unknown, path: string): RoomArtwork[] | undefined {
    const list = this.list(value, path, LIMITS.galleryItems);
    if (!list) return undefined;
    const seen = new Set<string>();
    const out: RoomArtwork[] = [];
    list.forEach((item, i) => {
      const p = `${path}[${i}]`;
      const o = this.object(item, p);
      if (!o) return;
      const id = this.id(o.id, `${p}.id`, seen);
      const title = this.string(o.title, `${p}.title`, LIMITS.artworkTitle, true);
      const alt = this.string(o.alt, `${p}.alt`, LIMITS.artworkAlt, true);
      const image = this.imageSource(o.image, `${p}.image`);
      if (id !== undefined && title !== undefined && alt !== undefined && image) {
        out.push({ id, title, alt, image });
      }
    });
    return out;
  }

  music(value: unknown, path: string): RoomMusic | null | undefined {
    if (value === null) return null;
    const o = this.object(value, path);
    if (!o) return undefined;
    const title = this.string(o.title, `${path}.title`, LIMITS.musicTitle, true);
    const artist = this.string(o.artist, `${path}.artist`, LIMITS.musicArtist, true);
    const description =
      o.description === undefined
        ? undefined
        : this.string(o.description, `${path}.description`, LIMITS.musicDescription);
    if (title === undefined || artist === undefined) return undefined;
    return description === undefined ? { title, artist } : { title, artist, description };
  }

  widget(value: unknown, path: string, seen: Set<string>): WidgetInstance | undefined {
    const o = this.object(value, path);
    if (!o) return undefined;
    const id = this.id(o.id, `${path}.id`, seen);
    const type = this.oneOf(WIDGET_TYPES, o.type, `${path}.type`);
    const visible = this.boolean(o.visible, `${path}.visible`);
    const width = this.oneOf<WidgetWidth>(["half", "full"], o.width, `${path}.width`);
    const c = this.object(o.content, `${path}.content`);
    if (id === undefined || !type || visible === undefined || !width || !c) return undefined;
    const base = { id, visible, width };
    const cp = `${path}.content`;

    switch (type) {
      case "about": {
        const displayName = this.string(c.displayName, `${cp}.displayName`, LIMITS.displayName, true);
        const bio = this.string(c.bio, `${cp}.bio`, LIMITS.bio);
        if (displayName === undefined || bio === undefined) return undefined;
        return { ...base, type, content: { displayName, bio } };
      }
      case "gallery": {
        const artwork = this.artwork(c.artwork, `${cp}.artwork`);
        return artwork ? { ...base, type, content: { artwork } } : undefined;
      }
      case "music": {
        const music = this.music(c.music, `${cp}.music`);
        return music === undefined ? undefined : { ...base, type, content: { music } };
      }
      case "links": {
        const links = this.links(c.links, `${cp}.links`);
        return links ? { ...base, type, content: { links } } : undefined;
      }
      case "text": {
        const title = this.string(c.title, `${cp}.title`, LIMITS.widgetTitle);
        const body = this.string(c.body, `${cp}.body`, LIMITS.textBody, true);
        if (title === undefined || body === undefined) return undefined;
        return { ...base, type, content: { title, body } };
      }
      case "image": {
        const image = this.imageSource(c.image, `${cp}.image`);
        const alt = this.string(c.alt, `${cp}.alt`, LIMITS.artworkAlt, true);
        const caption = this.string(c.caption, `${cp}.caption`, LIMITS.imageCaption);
        if (!image || alt === undefined || caption === undefined) return undefined;
        return { ...base, type, content: { image, alt, caption } };
      }
      case "link-collection": {
        const title = this.string(c.title, `${cp}.title`, LIMITS.widgetTitle);
        const links = this.links(c.links, `${cp}.links`);
        if (title === undefined || !links) return undefined;
        return { ...base, type, content: { title, links } };
      }
    }
  }

  background(value: unknown, path: string): RoomBackground | undefined {
    const o = this.object(value, path);
    if (!o) return undefined;
    const mode = this.oneOf(BACKGROUND_MODES, o.mode, `${path}.mode`);
    const g = this.object(o.gradient, `${path}.gradient`);
    const img = this.object(o.image, `${path}.image`);
    if (!mode || !g || !img) return undefined;
    const from = this.colour(g.from, `${path}.gradient.from`);
    const to = this.colour(g.to, `${path}.gradient.to`);
    const direction = this.oneOf(GRADIENT_DIRECTIONS, g.direction, `${path}.gradient.direction`);
    const source = img.source === null ? null : this.imageSource(img.source, `${path}.image.source`);
    const fit = this.oneOf(IMAGE_FITS, img.fit, `${path}.image.fit`);
    if (!from || !to || !direction || source === undefined || !fit) return undefined;
    if (mode === "image" && source === null) {
      return this.fail(`${path}.image.source is required when mode is "image"`);
    }
    return { mode, gradient: { from, to, direction }, image: { source, fit } };
  }

  typography(value: unknown, path: string): RoomTypography | undefined {
    const o = this.object(value, path);
    if (!o) return undefined;
    const headingFont = this.oneOf(FONT_IDS, o.headingFont, `${path}.headingFont`);
    const bodyFont = this.oneOf(FONT_IDS, o.bodyFont, `${path}.bodyFont`);
    const headingSize = this.oneOf(HEADING_SIZES, o.headingSize, `${path}.headingSize`);
    const align = this.oneOf(TEXT_ALIGNS, o.align, `${path}.align`);
    if (!headingFont || !bodyFont || !headingSize || !align) return undefined;
    return { headingFont, bodyFont, headingSize, align };
  }

  theme(value: unknown, path: string): RoomTheme | undefined {
    const o = this.object(value, path);
    if (!o) return undefined;
    const colours = THEME_COLOUR_KEYS.map((key) => this.colour(o[key], `${path}.${key}`));
    const backgroundPattern = isBackgroundPattern(o.backgroundPattern)
      ? o.backgroundPattern
      : this.fail(`${path}.backgroundPattern is not a supported pattern`);
    const background = this.background(o.background, `${path}.background`);
    const typography = this.typography(o.typography, `${path}.typography`);
    const [backgroundColor, primaryColor, secondaryColor, accentColor, textColor] = colours;
    if (
      !backgroundColor || !primaryColor || !secondaryColor || !accentColor || !textColor ||
      !backgroundPattern || !background || !typography
    ) {
      return undefined;
    }
    return {
      backgroundColor,
      primaryColor,
      secondaryColor,
      accentColor,
      textColor,
      backgroundPattern,
      background,
      typography,
    };
  }

  decorations(value: unknown, path: string): Decoration[] | undefined {
    const list = this.list(value, path, LIMITS.decorations);
    if (!list) return undefined;
    const seen = new Set<string>();
    const out: Decoration[] = [];
    list.forEach((item, i) => {
      const p = `${path}[${i}]`;
      const o = this.object(item, p);
      if (!o) return;
      const id = this.id(o.id, `${p}.id`, seen);
      const kind = this.oneOf(DECORATION_KINDS, o.kind, `${p}.kind`);
      const slot = this.oneOf(DECORATION_SLOTS, o.slot, `${p}.slot`);
      if (id !== undefined && kind && slot) out.push({ id, kind, slot });
    });
    return out;
  }
}

/**
 * Validates an unknown value (e.g. parsed localStorage JSON) against the
 * current RoomConfig schema. On success, returns a fresh object containing
 * only known fields so unexpected keys are never carried into the app.
 */
export function validateRoomConfig(input: unknown): RoomValidationResult {
  const r = new Reader();
  if (!isPlainObject(input)) return { ok: false, errors: ["room must be an object"] };

  if (input.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    r.fail(`schemaVersion must be ${CURRENT_SCHEMA_VERSION}`);
  }
  const template = isTemplateId(input.template)
    ? input.template
    : r.fail("template is not a supported template");
  const id = r.string(input.id, "id", LIMITS.id, true);
  const title = r.string(input.title, "title", LIMITS.title, true);
  const tagline = r.string(input.tagline, "tagline", LIMITS.tagline);
  const theme = r.theme(input.theme, "theme");
  const decorations = r.decorations(input.decorations, "decorations");

  let widgets: WidgetInstance[] | undefined;
  const layout = r.object(input.layout, "layout");
  if (layout) {
    const list = r.list(layout.widgets, "layout.widgets", LIMITS.widgets);
    if (list) {
      const seen = new Set<string>();
      widgets = [];
      list.forEach((item, i) => {
        const widget = r.widget(item, `layout.widgets[${i}]`, seen);
        if (widget) widgets!.push(widget);
      });
      for (const core of CORE_WIDGET_TYPES) {
        const count = widgets.filter((w) => w.type === core).length;
        if (count !== 1) r.fail(`layout must contain exactly one "${core}" widget (found ${count})`);
      }
    }
  }

  if (
    r.errors.length > 0 ||
    !template || id === undefined || title === undefined || tagline === undefined ||
    !theme || !decorations || !widgets
  ) {
    return { ok: false, errors: r.errors.length ? r.errors : ["room is incomplete"] };
  }

  return {
    ok: true,
    room: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      template: template as TemplateId,
      title,
      tagline,
      theme,
      layout: { widgets },
      decorations,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Normalisation (for dirty-state comparison)                          */
/* ------------------------------------------------------------------ */

const COLOUR_KEYS = new Set<string>([...THEME_COLOUR_KEYS, "from", "to"]);

/** JSON with sorted keys, upper-cased colours and empty descriptions dropped. */
function canonical(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => canonical(v));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = value[k];
      if (v === undefined) continue;
      if (k === "description" && v === "") continue;
      out[k] = canonical(v, k);
    }
    return out;
  }
  if (typeof value === "string" && key && COLOUR_KEYS.has(key) && isHexColour(value)) {
    return value.toUpperCase();
  }
  return value;
}

export function roomsEqual(a: RoomConfig, b: RoomConfig): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
