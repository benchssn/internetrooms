import type { ReactNode } from "react";
import { useId } from "react";
import { ArtworkImage } from "../../components/ArtworkImage/ArtworkImage";
import {
  patternOf,
  themeStyle,
  visibleLinks,
  WIDGET_HEADINGS,
  type TemplateProps,
} from "../shared/roomContent";
import { SafeLink } from "../shared/SafeLink";
import styles from "./DreamRoom.module.css";

function Card({
  title,
  icon,
  wide,
  children,
}: {
  title: string;
  icon: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className={wide ? `${styles.card} ${styles.wide}` : styles.card}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={styles.cardTitle}>
        <span aria-hidden="true" className={styles.cardIcon}>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

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

export function DreamRoom({ room }: TemplateProps) {
  const links = visibleLinks(room);

  return (
    <div
      className={styles.page}
      style={themeStyle(room)}
      data-pattern={patternOf(room)}
      data-template="dream-room"
      data-testid="room-page"
    >
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
          <h1 className={styles.title}>{room.title}</h1>
          {room.tagline ? <p className={styles.tagline}>{room.tagline}</p> : null}
          <p className={styles.divider} aria-hidden="true">
            ~ ✿ ~
          </p>
        </header>

        <main className={styles.grid}>
          {room.widgets.about ? (
            <Card title={WIDGET_HEADINGS.about} icon="☾">
              <p className={styles.ownerName}>{room.owner.displayName}</p>
              {room.owner.bio ? (
                <p className={styles.bio}>{room.owner.bio}</p>
              ) : (
                <p className={styles.empty}>a quiet space, waiting for words.</p>
              )}
            </Card>
          ) : null}

          {room.widgets.music ? (
            <Card title={WIDGET_HEADINGS.music} icon="♪">
              {room.music === null ? (
                <p className={styles.empty}>
                  nothing playing — just the hum of the breeze.
                </p>
              ) : (
                <div className={styles.music}>
                  <p className={styles.trackTitle}>{room.music.title}</p>
                  <p className={styles.artist}>by {room.music.artist}</p>
                  {room.music.description ? (
                    <p className={styles.musicDesc}>{room.music.description}</p>
                  ) : null}
                </div>
              )}
            </Card>
          ) : null}

          {room.widgets.gallery ? (
            <Card title={WIDGET_HEADINGS.gallery} icon="✿" wide>
              {room.artwork.length === 0 ? (
                <p className={styles.empty}>
                  the gallery is resting. new art will bloom soon.
                </p>
              ) : (
                <ul className={styles.gallery}>
                  {room.artwork.map((art) => (
                    <li key={art.id} className={styles.galleryItem}>
                      <figure className={styles.figure}>
                        <ArtworkImage src={art.imageUrl} alt={art.alt} />
                        <figcaption className={styles.caption}>
                          {art.title}
                        </figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {room.widgets.links ? (
            <Card title={WIDGET_HEADINGS.links} icon="✦" wide>
              {links.length === 0 ? (
                <p className={styles.empty}>no paths to wander yet.</p>
              ) : (
                <ul className={styles.linkList}>
                  {links.map((link) => (
                    <li key={link.id}>
                      <SafeLink link={link} className={styles.link} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </main>

        <footer className={styles.footer}>
          <p>thank you for drifting by ☁</p>
          <p className={styles.attribution}>
            made with Internetrooms · Dream Room template
          </p>
        </footer>
      </div>
    </div>
  );
}
