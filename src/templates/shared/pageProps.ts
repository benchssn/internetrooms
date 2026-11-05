import type { HTMLAttributes } from "react";
import type { RoomConfig, TemplateId } from "../../types/room";
import background from "./background.module.css";
import { backgroundModeOf, patternOf, roomStyle } from "./roomContent";

/**
 * Attributes for a template's outermost element: theme variables,
 * pattern/background hooks for CSS, and test ids. Every template uses
 * this so they all respond to the same settings.
 */
export function roomPageProps(
  room: RoomConfig,
  backgroundImageUrl: string | null | undefined,
  className: string,
  templateId: TemplateId,
): HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string> {
  const mode = backgroundModeOf(room, backgroundImageUrl);
  return {
    className: mode === "custom" ? `${className} ${background.custom}` : className,
    style: roomStyle(room, backgroundImageUrl),
    "data-pattern": patternOf(room),
    "data-background": mode === "custom" ? room.theme.background.mode : "pattern",
    "data-template": templateId,
    "data-testid": "room-page",
  };
}
