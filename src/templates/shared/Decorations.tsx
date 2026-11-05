import type { DecorationKind, DecorationSlot as Slot, RoomConfig } from "../../types/room";
import { isDivider } from "./decorationInfo";
import styles from "./decorations.module.css";

/** Pixel maps: each string is a row, "#" a filled pixel, "o" a highlight. */
const PIXEL_ART: Partial<Record<DecorationKind, { rows: string[]; fill: string; highlight?: string }>> = {
  "pixel-star": {
    fill: "#FFDF68",
    highlight: "#FFFFFF",
    rows: [
      "....#....",
      "....#....",
      "...###...",
      "#########",
      ".#######.",
      "..#####..",
      "..##.##..",
      ".##...##.",
      ".#.....#.",
    ],
  },
  heart: {
    fill: "#FF5C8A",
    highlight: "#FFD1DF",
    rows: [".##...##.", "#o##.####", "#o#######", "#########", ".#######.", "..#####..", "...###...", "....#...."],
  },
  sparkle: {
    fill: "#FFFFFF",
    highlight: "#BFF4FF",
    rows: ["...#...", "...#...", "..ooo..", "##ooo##", "..ooo..", "...#...", "...#..."],
  },
  "sticker-smiley": {
    fill: "#FFD23F",
    highlight: "#3A2A00",
    rows: [
      "..#####..",
      ".#######.",
      "##o###o##",
      "##o###o##",
      "#########",
      "#o#####o#",
      "##ooooo##",
      ".#######.",
      "..#####..",
    ],
  },
};

function PixelSprite({ kind }: { kind: DecorationKind }) {
  const art = PIXEL_ART[kind];
  if (!art) return null;
  const width = art.rows[0].length;
  const height = art.rows.length;
  return (
    <svg
      className={styles.sprite}
      viewBox={`0 0 ${width} ${height}`}
      width={width * 3}
      height={height * 3}
      shapeRendering="crispEdges"
      focusable="false"
    >
      {art.rows.flatMap((row, y) =>
        row.split("").map((ch, x) =>
          ch === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={ch === "o" ? (art.highlight ?? art.fill) : art.fill}
            />
          ),
        ),
      )}
    </svg>
  );
}

function CdSticker() {
  return (
    <svg className={styles.sprite} viewBox="0 0 32 32" width={32} height={32} focusable="false">
      <defs>
        <linearGradient id="ir-cd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8ECFF" />
          <stop offset="0.35" stopColor="#B9F3FF" />
          <stop offset="0.6" stopColor="#F6C1FF" />
          <stop offset="1" stopColor="#D8DCF1" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#ir-cd)" stroke="#0F1630" strokeWidth="1" />
      <circle cx="16" cy="16" r="5" fill="#FFFFFF" stroke="#0F1630" strokeWidth="1" />
      <circle cx="16" cy="16" r="2" fill="#0F1630" />
    </svg>
  );
}

function DecorationArt({ kind }: { kind: DecorationKind }) {
  switch (kind) {
    case "pixel-star":
    case "heart":
    case "sparkle":
    case "sticker-smiley":
      return (
        <span className={styles.item} data-kind={kind}>
          <PixelSprite kind={kind} />
        </span>
      );
    case "sticker-cd":
      return (
        <span className={styles.item} data-kind={kind}>
          <CdSticker />
        </span>
      );
    case "divider-stars":
      return <span className={styles.divider}>· ★ · ✦ · ★ · ✦ · ★ ·</span>;
    case "divider-hearts":
      return <span className={styles.divider}>♡ ─── ♥ ─── ♡ ─── ♥ ─── ♡</span>;
    case "badge-construction":
      return <span className={`${styles.badge} ${styles.construction}`}>under construction</span>;
    case "badge-best-viewed":
      return <span className={`${styles.badge} ${styles.bestViewed}`}>best viewed in any browser</span>;
    case "badge-handmade":
      return <span className={`${styles.badge} ${styles.handmade}`}>♥ handmade</span>;
  }
}

export interface DecorationSlotProps {
  room: RoomConfig;
  slot: Slot;
  className?: string;
}

/**
 * Renders the decorations placed in one of the template's fixed slots.
 * Decorations are purely visual and hidden from assistive technology.
 */
export function DecorationSlot({ room, slot, className }: DecorationSlotProps) {
  const items = room.decorations.filter((d) => d.slot === slot);
  if (items.length === 0) return null;
  const hasDivider = items.some((d) => isDivider(d.kind));
  return (
    <div
      className={[styles.slot, hasDivider ? styles.wide : "", className ?? ""].join(" ").trim()}
      data-slot={slot}
      aria-hidden="true"
    >
      {items.map((d) => (
        <DecorationArt key={d.id} kind={d.kind} />
      ))}
    </div>
  );
}
