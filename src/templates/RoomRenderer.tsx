import type { RoomConfig } from "../types/room";
import {
  FALLBACK_TEMPLATE_ID,
  getTemplate,
  TEMPLATE_REGISTRY,
} from "./templateRegistry";

export interface RoomRendererProps {
  room: RoomConfig;
}

/**
 * Renders a room with whichever template it names. Unknown template ids
 * (e.g. data from a newer version) fall back to Classic Web rather than
 * failing, so the owner's content is always visible.
 */
export function RoomRenderer({ room }: RoomRendererProps) {
  const template =
    getTemplate(room.template) ?? TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID];
  const Template = template.component;
  return <Template room={room} />;
}
