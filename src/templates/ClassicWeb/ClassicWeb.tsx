import { ArtworkImage } from "../../components/ArtworkImage/ArtworkImage";
import { RoomHeader } from "../../components/RoomHeader/RoomHeader";
import { RoomSection } from "../../components/RoomSection/RoomSection";
import type { RoomConfig } from "../../types/room";
import {
  DEFAULT_PATTERN,
  isSafeLinkUrl,
} from "../../validation/roomValidation";
import styles from "./ClassicWeb.module.css";

export interface ClassicWebProps {
  room: RoomConfig;
}

export function ClassicWeb({ room }: ClassicWebProps) {
  // Links still being written in the editor (no label yet) aren't shown.
  const links = room.links.filter((link) => link.label.trim().length > 0);

  const themeStyle = {
    ["--room-bg" as string]: room.theme.backgroundColor,
    ["--room-primary" as string]: room.theme.primaryColor,
    ["--room-secondary" as string]: room.theme.secondaryColor,
    ["--room-accent" as string]: room.theme.accentColor,
    ["--room-text" as string]: room.theme.textColor,
  };

  return (
    <div
      className={styles.page}
      style={themeStyle}
      data-pattern={room.theme.backgroundPattern ?? DEFAULT_PATTERN}
      data-testid="classic-web-page"
    >
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
                {links.length === 0 ? (
                  <p className={styles.empty}>No links yet — check back soon.</p>
                ) : (
                  <ul className={styles.linkList}>
                    {links.map((link) => (
                      <li key={link.id}>
                        {isSafeLinkUrl(link.url) ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.label}
                          </a>
                        ) : (
                          // Unsafe or unfinished URLs are shown as plain text.
                          <span>{link.label}</span>
                        )}
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
