import type { CSSProperties } from "react";
import type {
  BackgroundPattern,
  RoomConfig,
  RoomLink,
  WidgetInstance,
  WidgetType,
} from "../../types/room";
import { FONT_STACKS, HEADING_SCALE } from "./typography";

/** Props every room template receives. */
export interface TemplateProps {
  room: RoomConfig;
  /** Resolved URL of the background image, when background mode is "image". */
  backgroundImageUrl?: string | null;
}

/**
 * Builds the CSS custom properties every template reads: the five theme
 * colours, typography overrides and the custom background layer.
 * Typography variables are only set when the user picked something other
 * than "template default", so each template's own fonts act as fallbacks.
 */
export function roomStyle(room: RoomConfig, backgroundImageUrl?: string | null): CSSProperties {
  const { theme } = room;
  const { typography, background } = theme;
  const style: Record<string, string | number> = {
    "--room-bg": theme.backgroundColor,
    "--room-primary": theme.primaryColor,
    "--room-secondary": theme.secondaryColor,
    "--room-accent": theme.accentColor,
    "--room-text": theme.textColor,
    "--room-heading-scale": HEADING_SCALE[typography.headingSize],
  };
  if (typography.headingFont !== "template") {
    style["--room-font-heading"] = FONT_STACKS[typography.headingFont];
  }
  if (typography.bodyFont !== "template") {
    style["--room-font-body"] = FONT_STACKS[typography.bodyFont];
  }
  if (typography.align !== "template") {
    style["--room-align"] = typography.align;
  }

  if (background.mode === "gradient") {
    const { from, to, direction } = background.gradient;
    style["--room-bg-layer"] =
      direction === "radial"
        ? `radial-gradient(circle at 50% 30%, ${from}, ${to})`
        : `linear-gradient(${direction}, ${from}, ${to})`;
    style["--room-bg-size"] = "cover";
    style["--room-bg-repeat"] = "no-repeat";
  } else if (background.mode === "image" && backgroundImageUrl) {
    // JSON.stringify produces a safely quoted, escaped CSS string.
    style["--room-bg-layer"] = `url(${JSON.stringify(backgroundImageUrl)})`;
    style["--room-bg-size"] = background.image.fit === "tile" ? "auto" : "cover";
    style["--room-bg-repeat"] = background.image.fit === "tile" ? "repeat" : "no-repeat";
  }
  return style as CSSProperties;
}

/** Which background a template should paint: its pattern, or a custom layer. */
export function backgroundModeOf(
  room: RoomConfig,
  backgroundImageUrl?: string | null,
): "pattern" | "custom" {
  const { mode } = room.theme.background;
  if (mode === "gradient") return "custom";
  if (mode === "image" && backgroundImageUrl) return "custom";
  return "pattern";
}

export function patternOf(room: RoomConfig): BackgroundPattern {
  return room.theme.backgroundPattern;
}

/** Links still being written in the editor (no label yet) aren't shown. */
export function visibleLinks(links: RoomLink[]): RoomLink[] {
  return links.filter((link) => link.label.trim().length > 0);
}

/**
 * Headings for the original widgets, shared by all templates so the room
 * reads the same way to assistive technology whichever look is chosen.
 */
export const WIDGET_HEADINGS = {
  about: "About Me",
  gallery: "Art Gallery",
  music: "Music",
  links: "Favourite Links",
} as const;

/** Fallback headings for widgets whose heading is optional. */
export const DEFAULT_WIDGET_TITLES: Record<WidgetType, string> = {
  ...WIDGET_HEADINGS,
  text: "Notes",
  image: "Image",
  "link-collection": "More Links",
};

/**
 * The visible heading for a widget, or null for widgets that are just an
 * image (those are labelled by their caption or alt text instead).
 */
export function widgetHeading(widget: WidgetInstance): string | null {
  switch (widget.type) {
    case "text":
    case "link-collection":
      return widget.content.title.trim() || DEFAULT_WIDGET_TITLES[widget.type];
    case "image":
      return null;
    default:
      return WIDGET_HEADINGS[widget.type];
  }
}

/** Accessible name for a widget's region. */
export function widgetLabel(widget: WidgetInstance): string {
  if (widget.type === "image") {
    return widget.content.caption.trim() || widget.content.alt.trim() || "Image";
  }
  return widgetHeading(widget) ?? DEFAULT_WIDGET_TITLES[widget.type];
}

/** Splits plain text into paragraphs at blank lines. */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim().length > 0);
}
