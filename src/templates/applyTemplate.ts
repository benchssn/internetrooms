import type { RoomConfig, TemplateId } from "../types/room";
import { TEMPLATE_REGISTRY } from "./templateRegistry";

/**
 * Switches a room to another template and applies that template's colours
 * and background pattern (and switches the background back to "pattern"
 * mode so the template's look shows).
 *
 * Everything else is carried over untouched: every widget's content,
 * order, width and visibility; decorations; typography; and the saved
 * gradient and background-image settings (so switching back restores them
 * with one click).
 */
export function applyTemplate(room: RoomConfig, id: TemplateId): RoomConfig {
  const defaults = TEMPLATE_REGISTRY[id].defaultTheme;
  return {
    ...room,
    template: id,
    theme: {
      ...room.theme,
      ...defaults,
      background: { ...room.theme.background, mode: "pattern" },
    },
  };
}
