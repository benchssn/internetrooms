import type { ComponentType, ReactNode } from "react";
import { ArtworkImage } from "../../components/ArtworkImage/ArtworkImage";
import type { RoomConfig, RoomLink, WidgetInstance, WidgetType } from "../../types/room";
import { paragraphsOf, visibleLinks, widgetHeading, widgetLabel } from "./roomContent";
import { SafeLink } from "./SafeLink";
import grid from "./widgetGrid.module.css";

/* ------------------------------------------------------------------ */
/* Skin contract: what each template supplies                          */
/* ------------------------------------------------------------------ */

export interface WidgetFrameProps {
  widget: WidgetInstance;
  /** Visible heading, or null for image-only widgets. */
  title: string | null;
  /** Accessible name for the widget region. */
  label: string;
  /** 1-based position among visible widgets (for decorative numbering). */
  index: number;
  children: ReactNode;
}

/** Class names a template provides for widget content. */
export interface WidgetClasses {
  ownerName: string;
  bio: string;
  empty: string;
  gallery: string;
  galleryItem: string;
  figure: string;
  caption: string;
  music: string;
  trackTitle: string;
  artist: string;
  musicDesc: string;
  linkList: string;
  link: string;
  text: string;
  imageFigure: string;
  imageCaption: string;
}

export interface WidgetSkin {
  Frame: ComponentType<WidgetFrameProps>;
  classes: WidgetClasses;
  /** Template-flavoured empty-state messages. */
  empty: Record<Exclude<WidgetType, "image">, string>;
  /** Optional extra decoration inside the music widget (e.g. an equaliser). */
  musicExtra?: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Content renderers (shared by every template)                        */
/* ------------------------------------------------------------------ */

function LinkList({ links, skin, emptyText }: { links: RoomLink[]; skin: WidgetSkin; emptyText: string }) {
  const shown = visibleLinks(links);
  if (shown.length === 0) return <p className={skin.classes.empty}>{emptyText}</p>;
  return (
    <ul className={skin.classes.linkList}>
      {shown.map((link) => (
        <li key={link.id}>
          <SafeLink link={link} className={skin.classes.link} />
        </li>
      ))}
    </ul>
  );
}

function WidgetContent({ widget, skin }: { widget: WidgetInstance; skin: WidgetSkin }) {
  const c = skin.classes;
  switch (widget.type) {
    case "about":
      return (
        <>
          <p className={c.ownerName}>{widget.content.displayName}</p>
          {widget.content.bio ? (
            <p className={c.bio}>{widget.content.bio}</p>
          ) : (
            <p className={c.empty}>{skin.empty.about}</p>
          )}
        </>
      );
    case "gallery":
      return widget.content.artwork.length === 0 ? (
        <p className={c.empty}>{skin.empty.gallery}</p>
      ) : (
        <ul className={c.gallery}>
          {widget.content.artwork.map((art) => (
            <li key={art.id} className={c.galleryItem}>
              <figure className={c.figure}>
                <ArtworkImage source={art.image} alt={art.alt} />
                <figcaption className={c.caption}>{art.title}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      );
    case "music": {
      const music = widget.content.music;
      return music === null ? (
        <p className={c.empty}>{skin.empty.music}</p>
      ) : (
        <div className={c.music}>
          <p className={c.trackTitle}>{music.title}</p>
          <p className={c.artist}>by {music.artist}</p>
          {skin.musicExtra}
          {music.description ? <p className={c.musicDesc}>{music.description}</p> : null}
        </div>
      );
    }
    case "links":
      return <LinkList links={widget.content.links} skin={skin} emptyText={skin.empty.links} />;
    case "link-collection":
      return (
        <LinkList
          links={widget.content.links}
          skin={skin}
          emptyText={skin.empty["link-collection"]}
        />
      );
    case "text": {
      const paragraphs = paragraphsOf(widget.content.body);
      return paragraphs.length === 0 ? (
        <p className={c.empty}>{skin.empty.text}</p>
      ) : (
        <div className={c.text}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    }
    case "image":
      return (
        <figure className={c.imageFigure}>
          <ArtworkImage source={widget.content.image} alt={widget.content.alt} ratio="natural" />
          {widget.content.caption.trim() ? (
            <figcaption className={c.imageCaption}>{widget.content.caption}</figcaption>
          ) : null}
        </figure>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export interface RoomWidgetsProps {
  room: RoomConfig;
  skin: WidgetSkin;
  className?: string;
}

/**
 * Renders the room's visible widgets in order on a two-column grid.
 * Full-width widgets span both columns; everything stacks into a single
 * column when the room is narrow (a container query, so it also works in
 * the editor's mobile preview).
 */
export function RoomWidgets({ room, skin, className }: RoomWidgetsProps) {
  const visible = room.layout.widgets.filter((w) => w.visible);
  const { Frame } = skin;
  return (
    <main className={className ? `${grid.grid} ${className}` : grid.grid}>
      {visible.map((widget, i) => (
        <div
          key={widget.id}
          className={grid.cell}
          data-width={widget.width}
          data-widget-type={widget.type}
          data-widget-id={widget.id}
        >
          <Frame
            widget={widget}
            title={widgetHeading(widget)}
            label={widgetLabel(widget)}
            index={i + 1}
          >
            <WidgetContent widget={widget} skin={skin} />
          </Frame>
        </div>
      ))}
    </main>
  );
}
