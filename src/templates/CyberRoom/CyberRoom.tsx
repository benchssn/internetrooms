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
import styles from "./CyberRoom.module.css";

function Panel({
  title,
  code,
  wide,
  children,
}: {
  title: string;
  code: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className={wide ? `${styles.panel} ${styles.wide}` : styles.panel}
      aria-labelledby={headingId}
    >
      <div className={styles.panelBar}>
        <h2 id={headingId} className={styles.panelTitle}>
          <span aria-hidden="true" className={styles.panelArrow}>
            ▸{" "}
          </span>
          {title}
        </h2>
        <span aria-hidden="true" className={styles.panelCode}>
          {code}
        </span>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

const EQ_BARS = 12;

export function CyberRoom({ room }: TemplateProps) {
  const links = visibleLinks(room);

  return (
    <div
      className={styles.page}
      style={themeStyle(room)}
      data-pattern={patternOf(room)}
      data-template="cyber-room"
      data-testid="room-page"
    >
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
          <h1 className={styles.title}>{room.title}</h1>
          {room.tagline ? <p className={styles.tagline}>{room.tagline}</p> : null}
          <div className={styles.hudTicks} aria-hidden="true">
            <span>sys.ok</span>
            <span>▮▮▮▮▮▯▯</span>
            <span>0x2000</span>
          </div>
        </header>

        <main className={styles.grid}>
          {room.widgets.about ? (
            <Panel title={WIDGET_HEADINGS.about} code="01">
              <p className={styles.ownerName}>{room.owner.displayName}</p>
              {room.owner.bio ? (
                <p className={styles.bio}>{room.owner.bio}</p>
              ) : (
                <p className={styles.empty}>no bio uploaded yet.</p>
              )}
            </Panel>
          ) : null}

          {room.widgets.music ? (
            <Panel title={WIDGET_HEADINGS.music} code="02">
              {room.music === null ? (
                <p className={styles.empty}>
                  deck is idle. nothing queued right now.
                </p>
              ) : (
                <div className={styles.deck}>
                  <p className={styles.nowPlaying} aria-hidden="true">
                    now playing
                  </p>
                  <p className={styles.trackTitle}>{room.music.title}</p>
                  <p className={styles.artist}>by {room.music.artist}</p>
                  <div className={styles.eq} aria-hidden="true">
                    {Array.from({ length: EQ_BARS }, (_, i) => (
                      <span
                        key={i}
                        className={styles.eqBar}
                        style={{ ["--i" as string]: i }}
                      />
                    ))}
                  </div>
                  {room.music.description ? (
                    <p className={styles.musicDesc}>{room.music.description}</p>
                  ) : null}
                </div>
              )}
            </Panel>
          ) : null}

          {room.widgets.gallery ? (
            <Panel title={WIDGET_HEADINGS.gallery} code="03" wide>
              {room.artwork.length === 0 ? (
                <p className={styles.empty}>
                  gallery buffer empty. more art incoming.
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
            </Panel>
          ) : null}

          {room.widgets.links ? (
            <Panel title={WIDGET_HEADINGS.links} code="04" wide>
              {links.length === 0 ? (
                <p className={styles.empty}>no links logged yet.</p>
              ) : (
                <ul className={styles.linkList}>
                  {links.map((link) => (
                    <li key={link.id}>
                      <SafeLink link={link} className={styles.link} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </main>

        <footer className={styles.footer}>
          <p>end of transmission — come back anytime</p>
          <p className={styles.attribution}>
            made with Internetrooms · Cyber Room template
          </p>
        </footer>
      </div>
    </div>
  );
}
