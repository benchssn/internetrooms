/** Shapes shared by the Supabase-backed features (profiles, published rooms). */

export type Visibility = "public" | "unlisted" | "private";
export const VISIBILITIES: readonly Visibility[] = ["public", "unlisted", "private"];

export type CloudResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
}

export interface ProfileInput {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarPath?: string | null;
}

/** The signed-in owner's own room row (never includes the share token). */
export interface OwnRoom {
  visibility: Visibility;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  assetFolder: string;
  /** Untrusted until validated. */
  configuration: unknown;
}

/** What a visitor (or the owner) gets from get_published_room(). */
export interface VisibleRoom {
  configuration: unknown;
  visibility: Visibility;
  isPublished: boolean;
  isOwner: boolean;
  updatedAt: string;
}

export interface SaveRoomInput {
  configuration: unknown;
  visibility: Visibility;
  published: boolean;
}

/** Everything the app does with Supabase beyond authentication. */
export interface CloudApi {
  getProfileById(id: string): Promise<CloudResult<Profile | null>>;
  getProfileByUsername(username: string): Promise<CloudResult<Profile | null>>;
  isUsernameTaken(username: string, exceptUserId?: string): Promise<CloudResult<boolean>>;
  createProfile(userId: string, input: ProfileInput): Promise<CloudResult<Profile>>;
  updateProfile(userId: string, input: Partial<ProfileInput>): Promise<CloudResult<Profile>>;
  uploadAvatar(userId: string, image: Blob): Promise<CloudResult<string>>;
  avatarUrl(path: string): string;

  getOwnRoom(userId: string): Promise<CloudResult<OwnRoom | null>>;
  /** Creates an unpublished, private room row if none exists. */
  ensureOwnRoom(userId: string): Promise<CloudResult<OwnRoom>>;
  saveOwnRoom(userId: string, input: SaveRoomInput): Promise<CloudResult<OwnRoom>>;
  updateOwnRoom(userId: string, patch: { visibility?: Visibility; published?: boolean }): Promise<CloudResult<OwnRoom>>;
  uploadRoomImage(assetFolder: string, image: Blob): Promise<CloudResult<string>>;
  getShareToken(): Promise<CloudResult<string | null>>;
  rotateShareToken(): Promise<CloudResult<string>>;

  getVisibleRoom(username: string, key: string | null): Promise<CloudResult<VisibleRoom | null>>;
  /** A short-lived URL for a stored room image, or null if not allowed. */
  storedImageUrl(path: string): Promise<string | null>;
}
