import { RoomHeader } from "../../components/RoomHeader/RoomHeader";
import { Window } from "../../components/Window/Window";
import { DecorationSlot } from "../shared/Decorations";
import { roomPageProps } from "../shared/pageProps";
import type { TemplateProps } from "../shared/roomContent";
import { RoomWidgets, type WidgetFrameProps, type WidgetSkin } from "../shared/RoomWidgets";
import styles from "./ClassicWeb.module.css";

export type ClassicWebProps = TemplateProps;

function ClassicFrame({ title, label, children }: WidgetFrameProps) {
  return (
    <Window title={title} label={label}>
      {children}
    </Window>
  );
}

const skin: WidgetSkin = {
  Frame: ClassicFrame,
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
    about: "Nothing written here yet.",
    gallery: "The gallery is empty for now. More art coming soon.",
    music: "Nothing queued right now. Silence can be nice too.",
    links: "No links yet — check back soon.",
    text: "Nothing written here yet.",
    "link-collection": "No links yet — check back soon.",
  },
};

export function ClassicWeb({ room, backgroundImageUrl }: ClassicWebProps) {
  return (
    <div {...roomPageProps(room, backgroundImageUrl, styles.page, "classic-web")}>
      <div className={styles.shell}>
        <RoomHeader
          title={room.title}
          tagline={room.tagline}
          start={<DecorationSlot room={room} slot="header-start" />}
          end={<DecorationSlot room={room} slot="header-end" />}
        />
        <DecorationSlot room={room} slot="below-header" />

        <RoomWidgets room={room} skin={skin} className={styles.main} />

        <DecorationSlot room={room} slot="below-widgets" />

        <footer className={styles.footer}>
          <p>thanks for stopping by — come back anytime ★</p>
          <DecorationSlot room={room} slot="footer" className={styles.footerDecor} />
          <p className={styles.attribution}>made with Internetrooms · Classic Web template</p>
        </footer>
      </div>
    </div>
  );
}
