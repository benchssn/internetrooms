import { useId } from "react";
import { DecorationSlot } from "../shared/Decorations";
import { roomPageProps } from "../shared/pageProps";
import type { TemplateProps } from "../shared/roomContent";
import { RoomWidgets, type WidgetFrameProps, type WidgetSkin } from "../shared/RoomWidgets";
import styles from "./CyberRoom.module.css";

function CyberFrame({ title, label, index, children }: WidgetFrameProps) {
  const headingId = useId();
  const code = String(index).padStart(2, "0");
  return (
    <section
      className={styles.panel}
      aria-labelledby={title !== null ? headingId : undefined}
      aria-label={title === null ? label : undefined}
    >
      <div className={styles.panelBar}>
        {title !== null ? (
          <h2 id={headingId} className={styles.panelTitle}>
            <span aria-hidden="true" className={styles.panelArrow}>
              ▸{" "}
            </span>
            {title}
          </h2>
        ) : (
          <span aria-hidden="true" className={styles.panelArrow}>
            ▸ img
          </span>
        )}
        <span aria-hidden="true" className={styles.panelCode}>
          {code}
        </span>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

const EQ_BARS = 12;

const skin: WidgetSkin = {
  Frame: CyberFrame,
  classes: {
    ownerName: styles.ownerName,
    bio: styles.bio,
    empty: styles.empty,
    gallery: styles.gallery,
    galleryItem: styles.galleryItem,
    figure: styles.figure,
    caption: styles.caption,
    music: styles.deck,
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
    about: "no bio uploaded yet.",
    gallery: "gallery buffer empty. more art incoming.",
    music: "deck is idle. nothing queued right now.",
    links: "no links logged yet.",
    text: "no transmission yet.",
    "link-collection": "no links logged yet.",
  },
  musicExtra: (
    <div className={styles.eq} aria-hidden="true">
      {Array.from({ length: EQ_BARS }, (_, i) => (
        <span key={i} className={styles.eqBar} style={{ ["--i" as string]: i }} />
      ))}
    </div>
  ),
};

export function CyberRoom({ room, backgroundImageUrl }: TemplateProps) {
  return (
    <div {...roomPageProps(room, backgroundImageUrl, styles.page, "cyber-room")}>
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.hud}>
          <div className={styles.hudRow}>
            <p className={styles.brand}>Internetrooms // cyber</p>
            <p className={styles.signal}>
              <span aria-hidden="true" className={styles.signalDot} />
              link active
            </p>
          </div>
          <div className={styles.titleRow}>
            <DecorationSlot room={room} slot="header-start" />
            <h1 className={styles.title}>{room.title}</h1>
            <DecorationSlot room={room} slot="header-end" />
          </div>
          {room.tagline ? <p className={styles.tagline}>{room.tagline}</p> : null}
          <div className={styles.hudTicks} aria-hidden="true">
            <span>sys.ok</span>
            <span>▮▮▮▮▮▯▯</span>
            <span>0x2000</span>
          </div>
        </header>

        <DecorationSlot room={room} slot="below-header" />
        <RoomWidgets room={room} skin={skin} className={styles.grid} />
        <DecorationSlot room={room} slot="below-widgets" />

        <footer className={styles.footer}>
          <p>end of transmission — come back anytime</p>
          <DecorationSlot room={room} slot="footer" />
          <p className={styles.attribution}>made with Internetrooms · Cyber Room template</p>
        </footer>
      </div>
    </div>
  );
}
