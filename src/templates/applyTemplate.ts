import type { RoomConfig, TemplateId } from "../types/room";
import { TEMPLATE_REGISTRY } from "./templateRegistry";

/**
 * Switches a room to another template and applies that template's default
 * theme. Everything else — identity, biography, artwork, music, links and
 * widget visibility — is carried over untouched.
 */
export function applyTemplate(room: RoomConfig, id: TemplateId): RoomConfig {
  const template = TEMPLATE_REGISTRY[id];
  return {
    ...room,
    template: id,
    theme: { ...template.defaultTheme },
  };
}
