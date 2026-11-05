import type { WidgetInstance } from "../../types/room";
import type { SectionProps } from "../editorUtils";
import { AboutEditor } from "./AboutEditor";
import { GalleryEditor } from "./GalleryEditor";
import { ImageEditor } from "./ImageEditor";
import { LinkListEditor } from "./LinkListEditor";
import { MusicEditor } from "./MusicEditor";
import { TextEditor } from "./TextEditor";

/** Picks the right content editor for a widget. */
export function WidgetContentEditor({ widget, ...props }: SectionProps & { widget: WidgetInstance }) {
  switch (widget.type) {
    case "about":
      return <AboutEditor {...props} widget={widget} />;
    case "gallery":
      return <GalleryEditor {...props} widget={widget} />;
    case "music":
      return <MusicEditor {...props} widget={widget} />;
    case "links":
      return <LinkListEditor {...props} widget={widget} />;
    case "link-collection":
      return <LinkListEditor {...props} widget={widget} />;
    case "text":
      return <TextEditor {...props} widget={widget} />;
    case "image":
      return <ImageEditor {...props} widget={widget} />;
  }
}
