import { ArtworkImage } from "../../components/ArtworkImage/ArtworkImage";
import { RoomHeader } from "../../components/RoomHeader/RoomHeader";
import { RoomSection } from "../../components/RoomSection/RoomSection";
import {
  patternOf,
  themeStyle,
  visibleLinks,
  WIDGET_HEADINGS,
  type TemplateProps,
} from "../shared/roomContent";
import { SafeLink } from "../shared/SafeLink";
import styles from "./ClassicWeb.module.css";

export type ClassicWebProps = TemplateProps;

export function ClassicWeb({ room }: ClassicWebProps) {
  const links = visibleLinks(room);

  return (
    <div
      className={styles.page}
      style={themeStyle(room)}
      data-pattern={patternOf(room)}
      data-template="classic-web"
      data-testid="room-page"
    >
      <div className={styles.shell}>
        <RoomHeader title={room.title} tagline={room.tagline} />

        <main className={styles.main}>
          <div className={styles.column}>
            {room.widgets.about ? (
              <RoomSection title={WIDGET_HEADINGS.about}>
                <p className={styles.ownerName}>{room.owner.displayName}</p>
                <p className={styles.bio}>{room.owner.bio}</p>
              </RoomSection>
            ) : null}

            {room.widgets.links ? (
              <RoomSection title={WIDGET_HEADINGS.links}>
                {links.length === 0 ? (
                  <p className={styles.empty}>No links yet — check back soon.</p>
                ) : (
                  <ul className={styles.linkList}>
                    {links.map((link) => (
                      <li key={link.id}>
                        <SafeLink link={link} />
                      </li>
                    ))}
                  </ul>
                )}
              </RoomSection>
            ) : null}
          </div>

          <div className={styles.column}>
            {room.widgets.gallery ? (
              <RoomSection title={WIDGET_HEADINGS.gallery}>
                {room.artwork.length === 0 ? (
                  <p className={styles.empty}>
                    The gallery is empty for now. More art coming soon.
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
              </RoomSection>
            ) : null}

            {room.widgets.music ? (
              <RoomSection title={WIDGET_HEADINGS.music}>
                {room.music === null ? (
                  <p className={styles.empty}>
                    Nothing queued right now. Silence can be nice too.
                  </p>
                ) : (
                  <div className={styles.music}>
                    <p className={styles.trackTitle}>{room.music.title}</p>
                    <p className={styles.artist}>by {room.music.artist}</p>
                    {room.music.description ? (
                      <p className={styles.musicDesc}>
                        {room.music.description}
                      </p>
                    ) : null}
                  </div>
                )}
              </RoomSection>
            ) : null}
          </div>
        </main>

        <footer className={styles.footer}>
          <p>thanks for stopping by — come back anytime ★</p>
          <p className={styles.attribution}>
            made with Internetrooms · Classic Web template
          </p>
        </footer>
      </div>
    </div>
  );
}
