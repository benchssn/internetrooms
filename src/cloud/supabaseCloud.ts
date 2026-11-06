import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyCloudError } from "./cloudErrors";
import type {
  CloudApi,
  CloudResult,
  OwnRoom,
  Profile,
  ProfileInput,
  SaveRoomInput,
  VisibleRoom,
  Visibility,
} from "./cloudTypes";
import { VISIBILITIES } from "./cloudTypes";

const ROOM_ASSETS = "room-assets";
const AVATARS = "avatars";
const PROFILE_COLUMNS = "id, username, display_name, bio, avatar_path";
// share_token is deliberately never selected (the database refuses it anyway).
const ROOM_COLUMNS = "visibility, published_at, updated_at, asset_folder, configuration";
const SIGNED_URL_SECONDS = 60 * 60;

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toProfile(row: Row): Profile {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: str(row.display_name),
    bio: str(row.bio),
    avatarPath: str(row.avatar_path),
  };
}

function toVisibility(value: unknown): Visibility {
  return VISIBILITIES.includes(value as Visibility) ? (value as Visibility) : "private";
}

function toOwnRoom(row: Row): OwnRoom {
  return {
    visibility: toVisibility(row.visibility),
    published: row.published_at !== null && row.published_at !== undefined,
    publishedAt: str(row.published_at),
    updatedAt: String(row.updated_at),
    assetFolder: String(row.asset_folder),
    configuration: row.configuration,
  };
}

function fail<T>(error: unknown, context: Parameters<typeof friendlyCloudError>[1]): CloudResult<T> {
  return { ok: false, ...friendlyCloudError(error, context) };
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "webp";
}

/** A minimal, valid placeholder used only for a not-yet-published room row. */
const PLACEHOLDER_CONFIGURATION = { schemaVersion: 2, placeholder: true };

export function createSupabaseCloud(client: SupabaseClient): CloudApi {
  const signedUrls = new Map<string, { url: string; expires: number }>();

  const api: CloudApi = {
    async getProfileById(id) {
      const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
      if (error) return fail(error, "profile");
      return { ok: true, data: data ? toProfile(data as Row) : null };
    },

    async getProfileByUsername(username) {
      const { data, error } = await client
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (error) return fail(error, "profile");
      return { ok: true, data: data ? toProfile(data as Row) : null };
    },

    async isUsernameTaken(username, exceptUserId) {
      const { data, error } = await client
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (error) return fail(error, "profile");
      return { ok: true, data: Boolean(data) && (data as Row).id !== exceptUserId };
    },

    async createProfile(userId, input: ProfileInput) {
      const { data, error } = await client
        .from("profiles")
        .insert({
          id: userId,
          username: input.username,
          display_name: input.displayName,
          bio: input.bio,
          avatar_path: input.avatarPath ?? null,
        })
        .select(PROFILE_COLUMNS)
        .single();
      if (error) return fail(error, "profile");
      return { ok: true, data: toProfile(data as Row) };
    },

    async updateProfile(userId, input) {
      const patch: Row = {};
      if (input.username !== undefined) patch.username = input.username;
      if (input.displayName !== undefined) patch.display_name = input.displayName;
      if (input.bio !== undefined) patch.bio = input.bio;
      if (input.avatarPath !== undefined) patch.avatar_path = input.avatarPath;
      const { data, error } = await client
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) return fail(error, "profile");
      return { ok: true, data: toProfile(data as Row) };
    },

    async uploadAvatar(userId, image) {
      const path = `${userId}/${crypto.randomUUID()}.${extensionFor(image.type)}`;
      const { error } = await client.storage
        .from(AVATARS)
        .upload(path, image, { contentType: image.type, upsert: false, cacheControl: "3600" });
      if (error) return fail(error, "upload");
      return { ok: true, data: path };
    },

    avatarUrl(path) {
      return client.storage.from(AVATARS).getPublicUrl(path).data.publicUrl;
    },

    async getOwnRoom(userId) {
      const { data, error } = await client.from("rooms").select(ROOM_COLUMNS).eq("owner_id", userId).maybeSingle();
      if (error) return fail(error, "room");
      return { ok: true, data: data ? toOwnRoom(data as Row) : null };
    },

    async ensureOwnRoom(userId) {
      const existing = await api.getOwnRoom(userId);
      if (!existing.ok || existing.data) return existing as CloudResult<OwnRoom>;
      // Invisible until published: private, published_at null.
      const { error } = await client
        .from("rooms")
        .insert({ owner_id: userId, configuration: PLACEHOLDER_CONFIGURATION, visibility: "private" });
      // Another tab may have created it first; either way, read it back.
      if (error && error.code !== "23505") return fail(error, "room");
      const created = await api.getOwnRoom(userId);
      if (!created.ok) return created;
      return created.data ? { ok: true, data: created.data } : { ok: false, message: "Your room couldn't be created." };
    },

    async saveOwnRoom(userId, input: SaveRoomInput) {
      const { data, error } = await client
        .from("rooms")
        .upsert(
          {
            owner_id: userId,
            configuration: input.configuration,
            visibility: input.visibility,
            // The server replaces this with its own time; null unpublishes.
            published_at: input.published ? new Date().toISOString() : null,
          },
          { onConflict: "owner_id" },
        )
        .select(ROOM_COLUMNS)
        .single();
      if (error) return fail(error, "room");
      return { ok: true, data: toOwnRoom(data as Row) };
    },

    async updateOwnRoom(userId, patch) {
      const row: Row = {};
      if (patch.visibility) row.visibility = patch.visibility;
      if (patch.published !== undefined) row.published_at = patch.published ? new Date().toISOString() : null;
      const { data, error } = await client
        .from("rooms")
        .update(row)
        .eq("owner_id", userId)
        .select(ROOM_COLUMNS)
        .single();
      if (error) return fail(error, "room");
      return { ok: true, data: toOwnRoom(data as Row) };
    },

    async uploadRoomImage(assetFolder, image) {
      const path = `${assetFolder}/${crypto.randomUUID()}.${extensionFor(image.type)}`;
      const { error } = await client.storage
        .from(ROOM_ASSETS)
        .upload(path, image, { contentType: image.type, upsert: false, cacheControl: "3600" });
      if (error) return fail(error, "upload");
      return { ok: true, data: path };
    },

    async getShareToken() {
      const { data, error } = await client.rpc("get_my_room_share_token");
      if (error) return fail(error, "room");
      return { ok: true, data: typeof data === "string" ? data : null };
    },

    async rotateShareToken() {
      const { data, error } = await client.rpc("rotate_my_room_share_token");
      if (error || typeof data !== "string") return fail(error, "room");
      return { ok: true, data };
    },

    async getVisibleRoom(username, key) {
      const { data, error } = await client.rpc("get_published_room", {
        p_username: username.toLowerCase(),
        p_key: key,
      });
      if (error) return fail(error, "room");
      const row = Array.isArray(data) ? (data[0] as Row | undefined) : undefined;
      if (!row) return { ok: true, data: null };
      const room: VisibleRoom = {
        configuration: row.configuration,
        visibility: toVisibility(row.visibility),
        isPublished: row.is_published === true,
        isOwner: row.is_owner === true,
        updatedAt: String(row.updated_at),
      };
      return { ok: true, data: room };
    },

    async storedImageUrl(path) {
      const cached = signedUrls.get(path);
      if (cached && cached.expires > Date.now() + 60_000) return cached.url;
      const { data, error } = await client.storage.from(ROOM_ASSETS).createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl) return null;
      signedUrls.set(path, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
      return data.signedUrl;
    },
  };

  return api;
}
