import { RoomHeader } from "../../components/RoomHeader/RoomHeader";
import { RoomSection } from "../../components/RoomSection/RoomSection";
import type { RoomConfig } from "../../types/room";
import styles from "./ClassicWeb.module.css";

export interface ClassicWebProps {
  room: RoomConfig;
}

export function ClassicWeb({ room }: ClassicWebProps) {
  const themeStyle = {
    ["--room-bg" as string]: room.theme.backgroundColor,
    ["--room-primary" as string]: room.theme.primaryColor,
    ["--room-secondary" as string]: room.theme.secondaryColor,
    ["--room-accent" as string]: room.theme.accentColor,
    ["--room-text" as string]: room.theme.textColor,
  };

  return (
    <div className={styles.page} style={themeStyle}>
      <div className={styles.shell}>
        <RoomHeader title={room.title} tagline={room.tagline} />

        <main className={styles.main}>
          <div className={styles.column}>
            {room.widgets.about ? (
              <RoomSection title="About Me">
                <p className={styles.ownerName}>{room.owner.displayName}</p>
                <p className={styles.bio}>{room.owner.bio}</p>
              </RoomSection>
            ) : null}

            {room.widgets.links ? (
              <RoomSection title="Favourite Links">
                {room.links.length === 0 ? (
                  <p className={styles.empty}>No links yet — check back soon.</p>
                ) : (
                  <ul className={styles.linkList}>
                    {room.links.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </RoomSection>
            ) : null}
          </div>

          <div className={styles.column}>
            {room.widgets.gallery ? (
              <RoomSection title="Art Gallery">
                {room.artwork.length === 0 ? (
                  <p className={styles.empty}>
                    The gallery is empty for now. More art coming soon.
                  </p>
                ) : (
                  <ul className={styles.gallery}>
                    {room.artwork.map((art) => (
                      <li key={art.id} className={styles.galleryItem}>
                        <figure className={styles.figure}>
                          <img
                            src={art.imageUrl}
                            alt={art.alt}
                            width={480}
                            height={320}
                            loading="lazy"
                          />
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
              <RoomSection title="Music">
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
