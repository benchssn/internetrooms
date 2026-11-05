import { getDefaultRoom } from "../data/defaultRoom";
import type { RoomConfig, WidgetInstance, WidgetOfType, WidgetType } from "../types/room";
import type { RoomConfigV1 } from "../types/roomV1";

/** The first widget of a given type in a room (throws if missing). */
export function widgetOf<T extends WidgetType>(room: RoomConfig, type: T): WidgetOfType<T> {
  const widget = room.layout.widgets.find((w) => w.type === type);
  if (!widget) throw new Error(`room has no ${type} widget`);
  return widget as WidgetOfType<T>;
}

/** Returns a copy of the default room after applying `edit` to it. */
export function roomWith(edit: (room: RoomConfig) => void): RoomConfig {
  const room = getDefaultRoom();
  edit(room);
  return room;
}

export function setAllVisible(room: RoomConfig, visible: boolean) {
  for (const w of room.layout.widgets) w.visible = visible;
}

export function textWidget(id: string, title: string, body: string): WidgetInstance {
  return { id, type: "text", visible: true, width: "half", content: { title, body } };
}

/** A room as saved by Milestones 1–3 (schema v1). */
export function legacyRoomV1(overrides: Partial<RoomConfigV1> = {}): RoomConfigV1 {
  return {
    schemaVersion: 1,
    id: "room-001",
    template: "classic-web",
    title: "my old room",
    tagline: "saved before milestone 4",
    owner: { displayName: "old friend", bio: "a bio from the past\nwith two lines" },
    theme: {
      backgroundColor: "#112233",
      primaryColor: "#445566",
      secondaryColor: "#778899",
      accentColor: "#AABBCC",
      textColor: "#FFFFFF",
      backgroundPattern: "grid",
    },
    widgets: { about: true, gallery: false, music: true, links: true, guestbook: false },
    artwork: [
      { id: "art-1", title: "Old Art", imageUrl: "https://example.com/old.png", alt: "an old picture" },
      { id: "art-2", title: "Bundled", imageUrl: "/assets/images/digital-dreams.svg", alt: "shapes" },
    ],
    music: { title: "Old Song", artist: "Old Band", description: "still listening" },
    links: [
      { id: "l-1", label: "First", url: "https://first.example" },
      { id: "l-2", label: "Second", url: "https://second.example" },
    ],
    ...overrides,
  };
}

/** Bytes that start like a real PNG (enough for signature sniffing). */
export function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
}

export function fakeImageFile(
  name = "photo.png",
  type = "image/png",
  bytes: Uint8Array = pngBytes(),
): File {
  return new File([bytes as BlobPart], name, { type });
}
