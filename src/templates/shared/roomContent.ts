import type { CSSProperties } from "react";
import type { BackgroundPattern, RoomConfig, RoomLink } from "../../types/room";
import { DEFAULT_PATTERN } from "../../validation/roomValidation";

/** Props every room template receives. */
export interface TemplateProps {
  room: RoomConfig;
}

/**
 * Exposes the room theme as CSS custom properties. Every template reads
 * the same five variables, so user colour choices work everywhere.
 */
export function themeStyle(room: RoomConfig): CSSProperties {
  return {
    ["--room-bg" as string]: room.theme.backgroundColor,
    ["--room-primary" as string]: room.theme.primaryColor,
    ["--room-secondary" as string]: room.theme.secondaryColor,
    ["--room-accent" as string]: room.theme.accentColor,
    ["--room-text" as string]: room.theme.textColor,
  };
}

export function patternOf(room: RoomConfig): BackgroundPattern {
  return room.theme.backgroundPattern ?? DEFAULT_PATTERN;
}

/** Links still being written in the editor (no label yet) aren't shown. */
export function visibleLinks(room: RoomConfig): RoomLink[] {
  return room.links.filter((link) => link.label.trim().length > 0);
}

/**
 * Section headings shared by all templates so the room reads the same way
 * to assistive technology whichever look is chosen. Templates may add
 * decorative (aria-hidden) flourishes around them.
 */
export const WIDGET_HEADINGS = {
  about: "About Me",
  gallery: "Art Gallery",
  music: "Music",
  links: "Favourite Links",
} as const;
