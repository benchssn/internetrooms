/**
 * Every template id the app understands. The template registry
 * (src/templates/templateRegistry.ts) must provide an entry for each one —
 * TypeScript enforces this. The list lives here, rather than in the
 * registry, so validation can check ids without importing React components.
 */
export const TEMPLATE_IDS = ["classic-web", "cyber-room", "dream-room"] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type BackgroundPattern = "plain" | "stars" | "checkerboard" | "grid";

export interface RoomTheme {
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

export interface RoomLink {
  id: string;
  label: string;
  url: string;
}

export interface RoomArtwork {
  id: string;
  title: string;
  imageUrl: string;
  alt: string;
}

export interface RoomMusic {
  title: string;
  artist: string;
  description?: string;
}

export interface RoomWidgets {
  about: boolean;
  gallery: boolean;
  music: boolean;
  links: boolean;
  guestbook: boolean;
}

export interface RoomConfig {
  schemaVersion: 1;
  id: string;
  template: TemplateId;
  title: string;
  tagline: string;
  owner: {
    displayName: string;
    bio: string;
  };
  theme: RoomTheme;
  widgets: RoomWidgets;
  artwork: RoomArtwork[];
  music: RoomMusic | null;
  links: RoomLink[];
}
