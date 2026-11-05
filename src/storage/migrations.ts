import { CURRENT_SCHEMA_VERSION, type RoomConfig } from "../types/room";
import type { RoomConfigV1 } from "../types/roomV1";
import { isPlainObject } from "../validation/primitives";
import { validateRoomConfig } from "../validation/roomValidation";
import { validateRoomConfigV1 } from "../validation/roomValidationV1";

/**
 * Converts a schema v1 room (Milestones 1–3) into schema v2.
 *
 * - Title, tagline, owner, artwork, music and links are all carried over.
 * - The old visibility flags become ordered widget instances (the old
 *   `guestbook` flag held no content and is dropped).
 * - Template and theme colours are kept; the new background and
 *   typography settings start from neutral defaults.
 */
export function migrateV1ToV2(v1: RoomConfigV1): RoomConfig {
  const pattern = v1.theme.backgroundPattern ?? "stars";
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: v1.id,
    template: v1.template,
    title: v1.title,
    tagline: v1.tagline,
    theme: {
      backgroundColor: v1.theme.backgroundColor,
      primaryColor: v1.theme.primaryColor,
      secondaryColor: v1.theme.secondaryColor,
      accentColor: v1.theme.accentColor,
      textColor: v1.theme.textColor,
      backgroundPattern: pattern,
      background: {
        mode: "pattern",
        gradient: {
          from: v1.theme.backgroundColor,
          to: v1.theme.secondaryColor,
          direction: "to bottom",
        },
        image: { source: null, fit: "cover" },
      },
      typography: {
        headingFont: "template",
        bodyFont: "template",
        headingSize: "medium",
        align: "template",
      },
    },
    layout: {
      widgets: [
        {
          id: "w-about",
          type: "about",
          visible: v1.widgets.about,
          width: "half",
          content: { displayName: v1.owner.displayName, bio: v1.owner.bio },
        },
        {
          id: "w-music",
          type: "music",
          visible: v1.widgets.music,
          width: "half",
          content: { music: v1.music ? { ...v1.music } : null },
        },
        {
          id: "w-gallery",
          type: "gallery",
          visible: v1.widgets.gallery,
          width: "full",
          content: {
            artwork: v1.artwork.map((art) => ({
              id: art.id,
              title: art.title,
              alt: art.alt,
              image: { kind: "url", url: art.imageUrl },
            })),
          },
        },
        {
          id: "w-links",
          type: "links",
          visible: v1.widgets.links,
          width: "full",
          content: { links: v1.links.map((link) => ({ ...link })) },
        },
      ],
    },
    decorations: [],
  };
}

export type ReadRoomResult =
  | { ok: true; room: RoomConfig; migratedFrom: number | null }
  | { ok: false; reason: string };

function summarise(errors: string[]): string {
  return `${errors[0]}${errors.length > 1 ? `, and ${errors.length - 1} more` : ""}`;
}

/**
 * Reads parsed JSON of any known schema version and returns a validated
 * current-version room. Never mutates or discards the input.
 */
export function readRoom(input: unknown): ReadRoomResult {
  const version = isPlainObject(input) ? input.schemaVersion : undefined;

  if (version === CURRENT_SCHEMA_VERSION) {
    const result = validateRoomConfig(input);
    return result.ok
      ? { ok: true, room: result.room, migratedFrom: null }
      : { ok: false, reason: `Saved data failed validation (${summarise(result.errors)}).` };
  }

  if (version === 1) {
    const v1 = validateRoomConfigV1(input);
    if (!v1.ok) {
      return {
        ok: false,
        reason: `Saved data from an older version couldn't be upgraded (${summarise(v1.errors)}).`,
      };
    }
    // Re-validate the result as a safety net against migration bugs.
    const migrated = validateRoomConfig(migrateV1ToV2(v1.room));
    return migrated.ok
      ? { ok: true, room: migrated.room, migratedFrom: 1 }
      : {
          ok: false,
          reason: `Saved data from an older version couldn't be upgraded (${summarise(migrated.errors)}).`,
        };
  }

  return {
    ok: false,
    reason:
      typeof version === "number"
        ? `Saved data uses schema version ${version}, which this version of Internetrooms doesn't understand.`
        : "Saved data isn't a room this app recognises.",
  };
}
