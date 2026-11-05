import { useImageSourceUrl } from "../hooks/useImageSourceUrl";
import type { RoomConfig } from "../types/room";
import styles from "./RoomRenderer.module.css";
import {
  FALLBACK_TEMPLATE_ID,
  getTemplate,
  TEMPLATE_REGISTRY,
} from "./templateRegistry";

export interface RoomRendererProps {
  room: RoomConfig;
}

/**
 * Renders a room with whichever template it names. This is the only
 * rendering path: the editor preview, Preview mode, /room and template
 * miniatures all use it. Unknown template ids (e.g. data from a newer
 * version) fall back to Classic Web so the owner's content always shows.
 */
export function RoomRenderer({ room }: RoomRendererProps) {
  const { background } = room.theme;
  const backgroundImage = useImageSourceUrl(
    background.mode === "image" ? background.image.source : null,
  );
  const template = getTemplate(room.template) ?? TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID];
  const Template = template.component;
  return (
    <div className={styles.container}>
      <Template room={room} backgroundImageUrl={backgroundImage.url} />
    </div>
  );
}
