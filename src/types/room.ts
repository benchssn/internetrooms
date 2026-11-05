export type TemplateId = "classic-web";

export interface RoomTheme {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
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
