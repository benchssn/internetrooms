/**
 * Schema version 1 (Milestones 1–3). Kept only so old saved rooms can be
 * validated and migrated to the current schema — see
 * src/storage/migrations.ts. New code should use ./room.ts.
 */
import type { BackgroundPattern, TemplateId } from "./room";


export interface RoomThemeV1 {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  /**
   * Optional decorative pattern drawn over the background colour.
   * Added in Milestone 2; rooms without it render the original
   * Milestone 1 starfield ("stars").
   */
  backgroundPattern?: BackgroundPattern;
}

export interface RoomLinkV1 {
  id: string;
  label: string;
  url: string;
}

export interface RoomArtworkV1 {
  id: string;
  title: string;
  imageUrl: string;
  alt: string;
}

export interface RoomMusicV1 {
  title: string;
  artist: string;
  description?: string;
}

export interface RoomWidgetsV1 {
  about: boolean;
  gallery: boolean;
  music: boolean;
  links: boolean;
  guestbook: boolean;
}

export interface RoomConfigV1 {
  schemaVersion: 1;
  id: string;
  template: TemplateId;
  title: string;
  tagline: string;
  owner: {
    displayName: string;
    bio: string;
  };
  theme: RoomThemeV1;
  widgets: RoomWidgetsV1;
  artwork: RoomArtworkV1[];
  music: RoomMusicV1 | null;
  links: RoomLinkV1[];
}
