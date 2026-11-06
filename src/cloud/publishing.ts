import { getAsset } from "../storage/assetStore";
import type { ImageSource, RoomConfig } from "../types/room";
import { canonicalRoomJson, getFieldErrors, validateRoomConfig } from "../validation/roomValidation";
import type { CloudApi, CloudResult, OwnRoom, Visibility } from "./cloudTypes";

/** Matches the database's limit on a room configuration. */
export const MAX_PUBLISHED_BYTES = 262_144;

/* ------------------------------------------------------------------ */
/* Draft fingerprints and what this browser last published             */
/* ------------------------------------------------------------------ */

/** A short, stable hash of a room (FNV-1a over its canonical JSON). */
export function roomFingerprint(room: RoomConfig): string {
  const text = canonicalRoomJson(room);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${text.length}`;
}

/**
 * What this browser knows about the published room: the fingerprint of the
 * local draft that was published from here, and the server's updated_at at
 * that moment. Lets the editor tell "unpublished changes" apart from
 * "the room was changed somewhere else".
 */
export interface PublishState {
  fingerprint: string | null;
  updatedAt: string;
}

const stateKey = (userId: string) => `internetrooms:publish-state:${userId}`;

export function readPublishState(userId: string): PublishState | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(stateKey(userId)) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { fingerprint, updatedAt } = parsed as Record<string, unknown>;
    if (typeof updatedAt !== "string") return null;
    return { fingerprint: typeof fingerprint === "string" ? fingerprint : null, updatedAt };
  } catch {
    return null;
  }
}

export function writePublishState(userId: string, state: PublishState) {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    // Not fatal: the editor just can't detect unpublished changes as precisely.
  }
}

/** Records a change made from this browser (e.g. visibility in /settings). */
export function noteRemoteUpdate(userId: string, updatedAt: string) {
  const previous = readPublishState(userId);
  writePublishState(userId, { fingerprint: previous?.fingerprint ?? null, updatedAt });
}

export type PublishStatus =
  | "not-published"
  | "published"
  | "unpublished-changes"
  /** Published (or changed) from another browser or device. */
  | "changed-elsewhere";

export function publishStatus(remote: OwnRoom | null, state: PublishState | null, draft: RoomConfig): PublishStatus {
  if (!remote || !remote.published) return "not-published";
  if (!state || state.updatedAt !== remote.updatedAt) return "changed-elsewhere";
  return state.fingerprint === roomFingerprint(draft) ? "published" : "unpublished-changes";
}

/* ------------------------------------------------------------------ */
/* Image references                                                    */
/* ------------------------------------------------------------------ */

/** Returns a copy of the room with every image source passed through `fn`. */
export function mapImageSources(room: RoomConfig, fn: (source: ImageSource) => ImageSource): RoomConfig {
  const bg = room.theme.background;
  return {
    ...room,
    theme: {
      ...room.theme,
      background: { ...bg, image: { ...bg.image, source: bg.image.source ? fn(bg.image.source) : null } },
    },
    layout: {
      widgets: room.layout.widgets.map((w) => {
        if (w.type === "gallery") {
          return { ...w, content: { artwork: w.content.artwork.map((a) => ({ ...a, image: fn(a.image) })) } };
        }
        if (w.type === "image" && w.content.image) {
          return { ...w, content: { ...w.content, image: fn(w.content.image) } };
        }
        return w;
      }),
    },
  };
}

function imageSources(room: RoomConfig): ImageSource[] {
  const found: ImageSource[] = [];
  mapImageSources(room, (s) => {
    found.push(s);
    return s;
  });
  return found;
}

/** Remembers which local uploads were already copied to Storage. */
const uploadsKey = (folder: string) => `internetrooms:uploaded-images:${folder}`;

function readUploads(folder: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(uploadsKey(folder)) ?? "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeUploads(folder: string, map: Record<string, string>) {
  try {
    localStorage.setItem(uploadsKey(folder), JSON.stringify(map));
  } catch {
    // Not fatal: images will just be uploaded again next time.
  }
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

export interface PublishOptions {
  cloud: CloudApi;
  userId: string;
  draft: RoomConfig;
  visibility: Visibility;
  /** Reads a browser-stored upload; injectable for tests. */
  readAsset?: (assetId: string) => Promise<Blob | null>;
}

async function readLocalAsset(assetId: string): Promise<Blob | null> {
  const asset = await getAsset(assetId);
  return asset?.blob ?? null;
}

/**
 * Publishes (or updates) the signed-in user's room from their local draft.
 * Nothing is saved unless every step succeeds, and the local draft is
 * never modified.
 */
export async function publishDraft({
  cloud,
  userId,
  draft,
  visibility,
  readAsset = readLocalAsset,
}: PublishOptions): Promise<CloudResult<OwnRoom>> {
  // 1. The draft must be complete and use only supported widgets.
  const fieldErrors = Object.keys(getFieldErrors(draft)).length;
  if (fieldErrors > 0) {
    return {
      ok: false,
      code: "invalid_draft",
      message: `Your room has ${fieldErrors} ${fieldErrors === 1 ? "field that needs" : "fields that need"} attention. Fix the ⚠ messages in the editor, then publish.`,
    };
  }
  if (!validateRoomConfig(draft).ok) {
    return { ok: false, code: "invalid_draft", message: "This room contains something Internetrooms can't publish. Nothing was published." };
  }

  // 2. A (still invisible) room row gives us the private image folder.
  const room = await cloud.ensureOwnRoom(userId);
  if (!room.ok) return room;
  const folder = room.data.assetFolder;

  // 3. Copy browser-only uploads to Storage. Any failure stops here.
  const sources = imageSources(draft);
  const uploaded = readUploads(folder);
  const replacements = new Map<string, string>();
  for (const source of sources) {
    if (source.kind === "stored" && !source.path.startsWith(`${folder}/`)) {
      return { ok: false, code: "foreign_image", message: "This room uses an image that belongs to another room. Replace it, then publish." };
    }
    if (source.kind !== "asset" || replacements.has(source.assetId)) continue;
    const known = uploaded[source.assetId];
    if (known && known.startsWith(`${folder}/`)) {
      replacements.set(source.assetId, known);
      continue;
    }
    const blob = await readAsset(source.assetId).catch(() => null);
    if (!blob) {
      return {
        ok: false,
        code: "missing_image",
        message: "An uploaded image is missing from this browser, so the room wasn't published. Re-upload or replace it, then try again.",
      };
    }
    const result = await cloud.uploadRoomImage(folder, blob);
    if (!result.ok) {
      return { ok: false, code: result.code, message: `${result.message} Nothing was published.` };
    }
    replacements.set(source.assetId, result.data);
    uploaded[source.assetId] = result.data;
    writeUploads(folder, uploaded);
  }

  // 4. Swap local references for stored ones and re-check the result.
  const published = mapImageSources(draft, (source) =>
    source.kind === "asset" ? { kind: "stored", path: replacements.get(source.assetId)! } : source,
  );
  const check = validateRoomConfig(published);
  if (!check.ok) {
    return { ok: false, code: "invalid_published", message: "The room couldn't be prepared for publishing. Nothing was published." };
  }
  if (JSON.stringify(check.room).length > MAX_PUBLISHED_BYTES) {
    return { ok: false, code: "too_large", message: "This room has too much text to publish. Shorten some writing and try again." };
  }

  // 5. Save. The database only lets you write your own room.
  const saved = await cloud.saveOwnRoom(userId, { configuration: check.room, visibility, published: true });
  if (!saved.ok) return saved;
  writePublishState(userId, { fingerprint: roomFingerprint(draft), updatedAt: saved.data.updatedAt });
  return saved;
}
