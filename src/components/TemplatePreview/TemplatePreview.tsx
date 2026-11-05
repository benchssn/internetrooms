import { useLayoutEffect, useRef, useState } from "react";
import { RoomRenderer } from "../../templates/RoomRenderer";
import type { RoomConfig } from "../../types/room";
import styles from "./TemplatePreview.module.css";

/** Width the room is laid out at before being scaled down. */
const VIRTUAL_WIDTH = 1100;

export interface TemplatePreviewProps {
  room: RoomConfig;
}

/**
 * A miniature, non-interactive render of a room. Uses the real
 * RoomRenderer, scaled to fit, and is hidden from assistive technology
 * and the tab order (the surrounding card describes it instead).
 */
export function TemplatePreview({ room }: TemplatePreviewProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / VIRTUAL_WIDTH);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className={styles.frame} aria-hidden="true">
      <div
        className={styles.inner}
        style={{ width: VIRTUAL_WIDTH, transform: `scale(${scale})` }}
        inert
      >
        <RoomRenderer room={room} />
      </div>
    </div>
  );
}
