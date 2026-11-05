import { TEMPLATE_IDS, type BackgroundPattern, type TemplateId } from "../types/room";
import type { RoomConfigV1 } from "../types/roomV1";
import {
  isBackgroundPattern,
  isHexColour,
  isPlainObject,
  isSafeImageUrl,
  isSafeLinkUrl,
  isTemplateId,
  LIMITS,
  THEME_COLOUR_KEYS,
} from "./primitives";

/**
 * Structural validator for schema v1 rooms (Milestones 1–3). Only used to
 * check old saved data before migrating it; see storage/migrations.ts.
 */
/* ------------------------------------------------------------------ */
/* Structural validation (used for untrusted stored data)              */
/* ------------------------------------------------------------------ */

export type RoomValidationResultV1 =
  | { ok: true; room: RoomConfigV1 }
  | { ok: false; errors: string[] };

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
export function validateRoomConfigV1(input: unknown): RoomValidationResultV1 {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ["room must be an object"] };
  }

  if (input.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!isTemplateId(input.template))
    errors.push(`template must be one of: ${TEMPLATE_IDS.join(", ")}`);
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

  const room: RoomConfigV1 = {
    schemaVersion: 1,
    id: input.id as string,
    template: input.template as TemplateId,
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

