import { useId } from "react";
import { DecorationSlot } from "../shared/Decorations";
import { roomPageProps } from "../shared/pageProps";
import type { TemplateProps } from "../shared/roomContent";
import { RoomWidgets, type WidgetFrameProps, type WidgetSkin } from "../shared/RoomWidgets";
import styles from "./DreamRoom.module.css";

const ICONS = {
  about: "☾",
  gallery: "✿",
  music: "♪",
  links: "✦",
  text: "✎",
  image: "❀",
  "link-collection": "✧",
} as const;

function DreamFrame({ widget, title, label, children }: WidgetFrameProps) {
  const headingId = useId();
  return (
    <section
      className={styles.card}
      aria-labelledby={title !== null ? headingId : undefined}
      aria-label={title === null ? label : undefined}
    >
      {title !== null ? (
        <h2 id={headingId} className={styles.cardTitle}>
          <span aria-hidden="true" className={styles.cardIcon}>
            {ICONS[widget.type]}
          </span>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

const skin: WidgetSkin = {
  Frame: DreamFrame,
  classes: {
    ownerName: styles.ownerName,
    bio: styles.bio,
    empty: styles.empty,
    gallery: styles.gallery,
    galleryItem: styles.galleryItem,
    figure: styles.figure,
    caption: styles.caption,
    music: styles.music,
    trackTitle: styles.trackTitle,
    artist: styles.artist,
    musicDesc: styles.musicDesc,
    linkList: styles.linkList,
    link: styles.link,
    text: styles.text,
    imageFigure: styles.imageFigure,
    imageCaption: styles.caption,
  },
  empty: {
    about: "a quiet space, waiting for words.",
    gallery: "the gallery is resting. new art will bloom soon.",
    music: "nothing playing — just the hum of the breeze.",
    links: "no paths to wander yet.",
    text: "a blank page, waiting for words.",
    "link-collection": "no paths to wander yet.",
  },
};

/** Decorative drifting shapes: clouds, sparkles, petals, a moon. */
const FLOATERS = [
  { glyph: "☁", className: "cloudA" },
  { glyph: "☁", className: "cloudB" },
  { glyph: "✧", className: "sparkA" },
  { glyph: "✦", className: "sparkB" },
  { glyph: "✿", className: "petalA" },
  { glyph: "❀", className: "petalB" },
  { glyph: "☾", className: "moon" },
] as const;

export function DreamRoom({ room, backgroundImageUrl }: TemplateProps) {
  return (
    <div {...roomPageProps(room, backgroundImageUrl, styles.page, "dream-room")}>
      <div className={styles.floaters} aria-hidden="true">
        {FLOATERS.map((f) => (
          <span key={f.className} className={`${styles.floater} ${styles[f.className]}`}>
            {f.glyph}
          </span>
        ))}
      </div>

      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.brand}>
            <span aria-hidden="true">✧ </span>Internetrooms
            <span aria-hidden="true"> ✧</span>
          </p>
          <div className={styles.titleRow}>
            <DecorationSlot room={room} slot="header-start" />
            <h1 className={styles.title}>{room.title}</h1>
            <DecorationSlot room={room} slot="header-end" />
          </div>
          {room.tagline ? <p className={styles.tagline}>{room.tagline}</p> : null}
          <p className={styles.divider} aria-hidden="true">
            ~ ✿ ~
          </p>
        </header>

        <DecorationSlot room={room} slot="below-header" />
        <RoomWidgets room={room} skin={skin} className={styles.grid} />
        <DecorationSlot room={room} slot="below-widgets" />

        <footer className={styles.footer}>
          <p>thank you for drifting by ☁</p>
          <DecorationSlot room={room} slot="footer" />
          <p className={styles.attribution}>made with Internetrooms · Dream Room template</p>
        </footer>
      </div>
    </div>
  );
}
