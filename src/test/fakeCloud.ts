import { vi } from "vitest";
import type { CloudApi, CloudResult, OwnRoom, Profile, Visibility } from "../cloud/cloudTypes";
import { RESERVED_USERNAMES, validateUsername } from "../cloud/usernames";

/**
 * In-memory stand-in for the Supabase-backed CloudApi, mirroring the
 * database rules closely enough for UI tests. The real permission rules
 * are tested against PostgreSQL in supabase/tests (npm run test:db).
 */

interface RoomRow {
  ownerId: string;
  configuration: unknown;
  visibility: Visibility;
  publishedAt: string | null;
  updatedAt: string;
  assetFolder: string;
  token: string;
}

let clock = 0;
const tick = () => new Date(Date.UTC(2026, 0, 1, 0, 0, ++clock)).toISOString();

export function createFakeCloud() {
  const profiles = new Map<string, Profile>();
  const rooms = new Map<string, RoomRow>();
  const uploads: string[] = [];
  const state = { viewerId: null as string | null, failUploads: false };

  const ok = <T>(data: T): CloudResult<T> => ({ ok: true, data });
  const err = (message: string, code?: string): CloudResult<never> => ({ ok: false, message, code });
  const toOwn = (r: RoomRow): OwnRoom => ({
    visibility: r.visibility,
    published: r.publishedAt !== null,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    assetFolder: r.assetFolder,
    configuration: structuredClone(r.configuration),
  });
  const byUsername = (username: string) => [...profiles.values()].find((p) => p.username === username.toLowerCase());
  const checkUsername = (username: string, exceptId?: string): CloudResult<never> | null => {
    if (validateUsername(username) || RESERVED_USERNAMES.has(username)) {
      return err("That username isn't allowed.", "invalid");
    }
    const existing = byUsername(username);
    if (existing && existing.id !== exceptId) {
      return err("That username is already taken. Try another.", "username_taken");
    }
    return null;
  };

  const api: CloudApi = {
    getProfileById: vi.fn(async (id: string) => ok(profiles.get(id) ?? null)),
    getProfileByUsername: vi.fn(async (username: string) => ok(byUsername(username) ?? null)),
    isUsernameTaken: vi.fn(async (username: string, except?: string) => {
      const p = byUsername(username);
      return ok(Boolean(p) && p!.id !== except);
    }),
    createProfile: vi.fn(async (userId, input) => {
      if (profiles.has(userId)) return err("That already exists.", "duplicate");
      const problem = checkUsername(input.username);
      if (problem) return problem;
      const profile: Profile = {
        id: userId,
        username: input.username,
        displayName: input.displayName,
        bio: input.bio,
        avatarPath: input.avatarPath ?? null,
      };
      profiles.set(userId, profile);
      return ok(profile);
    }),
    updateProfile: vi.fn(async (userId, input) => {
      const current = profiles.get(userId);
      if (!current) return err("That couldn't be found.", "not_found");
      if (input.username !== undefined) {
        const problem = checkUsername(input.username, userId);
        if (problem) return problem;
      }
      const next: Profile = {
        ...current,
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarPath !== undefined ? { avatarPath: input.avatarPath } : {}),
      };
      profiles.set(userId, next);
      return ok(next);
    }),
    uploadAvatar: vi.fn(async (userId: string) => ok(`${userId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`)),
    avatarUrl: (path: string) => `https://avatars.test/${path}`,

    getOwnRoom: vi.fn(async (userId: string) => {
      const r = rooms.get(userId);
      return ok(r ? toOwn(r) : null);
    }),
    ensureOwnRoom: vi.fn(async (userId: string) => {
      if (!rooms.has(userId)) {
        rooms.set(userId, {
          ownerId: userId,
          configuration: { schemaVersion: 2, placeholder: true },
          visibility: "private",
          publishedAt: null,
          updatedAt: tick(),
          assetFolder: "f0f0f0f0-0000-4000-8000-00000000000" + (rooms.size % 10),
          token: `token-${userId}`,
        });
      }
      return ok(toOwn(rooms.get(userId)!));
    }),
    saveOwnRoom: vi.fn(async (userId, input) => {
      const existing = rooms.get(userId);
      const row: RoomRow = {
        ownerId: userId,
        configuration: structuredClone(input.configuration),
        visibility: input.visibility,
        publishedAt: input.published ? (existing?.publishedAt ?? tick()) : null,
        updatedAt: tick(),
        assetFolder: existing?.assetFolder ?? "f0f0f0f0-0000-4000-8000-000000000009",
        token: existing?.token ?? `token-${userId}`,
      };
      rooms.set(userId, row);
      return ok(toOwn(row));
    }),
    updateOwnRoom: vi.fn(async (userId, patch) => {
      const r = rooms.get(userId);
      if (!r) return err("That couldn't be found.", "not_found");
      if (patch.visibility) r.visibility = patch.visibility;
      if (patch.published !== undefined) r.publishedAt = patch.published ? (r.publishedAt ?? tick()) : null;
      r.updatedAt = tick();
      return ok(toOwn(r));
    }),
    uploadRoomImage: vi.fn(async (folder: string) => {
      if (state.failUploads) return err("An image couldn't be uploaded. Please try again.", "upload_failed");
      const path = `${folder}/${crypto.randomUUID()}.webp`;
      uploads.push(path);
      return ok(path);
    }),
    getShareToken: vi.fn(async () => ok(state.viewerId ? (rooms.get(state.viewerId)?.token ?? null) : null)),
    rotateShareToken: vi.fn(async () => {
      const r = state.viewerId ? rooms.get(state.viewerId) : undefined;
      if (!r) return err("No room.");
      r.token = `${r.token}-rotated`;
      return ok(r.token);
    }),
    getVisibleRoom: vi.fn(async (username: string, key: string | null) => {
      const profile = byUsername(username);
      const r = profile ? rooms.get(profile.id) : undefined;
      if (!profile || !r) return ok(null);
      const isOwner = state.viewerId === r.ownerId;
      const published = r.publishedAt !== null;
      const visible =
        isOwner ||
        (published && r.visibility === "public") ||
        (published && r.visibility === "unlisted" && key === r.token);
      if (!visible) return ok(null);
      return ok({
        configuration: structuredClone(r.configuration),
        visibility: r.visibility,
        isPublished: published,
        isOwner,
        updatedAt: r.updatedAt,
      });
    }),
    storedImageUrl: vi.fn(async (path: string) => `https://storage.test/signed/${path}`),
  };

  return { api, profiles, rooms, uploads, state };
}

export type FakeCloud = ReturnType<typeof createFakeCloud>;
