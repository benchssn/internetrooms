import { describe, expect, it } from "vitest";
import { legacyRoomV1, widgetOf } from "../test/rooms";
import { migrateV1ToV2, readRoom } from "./migrations";

describe("migrateV1ToV2", () => {
  it("preserves every piece of content", () => {
    const v1 = legacyRoomV1();
    const room = migrateV1ToV2(v1);

    expect(room.schemaVersion).toBe(2);
    expect(room.id).toBe(v1.id);
    expect(room.template).toBe(v1.template);
    expect(room.title).toBe(v1.title);
    expect(room.tagline).toBe(v1.tagline);
    expect(widgetOf(room, "about").content).toEqual(v1.owner);
    expect(widgetOf(room, "music").content.music).toEqual(v1.music);
    expect(widgetOf(room, "links").content.links).toEqual(v1.links);
    expect(widgetOf(room, "gallery").content.artwork).toEqual([
      { id: "art-1", title: "Old Art", alt: "an old picture", image: { kind: "url", url: "https://example.com/old.png" } },
      { id: "art-2", title: "Bundled", alt: "shapes", image: { kind: "url", url: "/assets/images/digital-dreams.svg" } },
    ]);
  });

  it("turns visibility flags into ordered widget instances", () => {
    const room = migrateV1ToV2(legacyRoomV1());
    expect(room.layout.widgets.map((w) => [w.type, w.visible])).toEqual([
      ["about", true],
      ["music", true],
      ["gallery", false],
      ["links", true],
    ]);
  });

  it("keeps theme colours and pattern, with neutral new settings", () => {
    const v1 = legacyRoomV1();
    const { theme } = migrateV1ToV2(v1);
    expect(theme.backgroundColor).toBe("#112233");
    expect(theme.textColor).toBe("#FFFFFF");
    expect(theme.backgroundPattern).toBe("grid");
    expect(theme.background.mode).toBe("pattern");
    expect(theme.typography).toEqual({
      headingFont: "template",
      bodyFont: "template",
      headingSize: "medium",
      align: "template",
    });
  });

  it("gives Milestone 1 rooms without a pattern the original starfield", () => {
    const v1 = legacyRoomV1();
    delete v1.theme.backgroundPattern;
    expect(migrateV1ToV2(v1).theme.backgroundPattern).toBe("stars");
  });

  it("keeps a null music entry", () => {
    expect(widgetOf(migrateV1ToV2(legacyRoomV1({ music: null })), "music").content.music).toBeNull();
  });
});

describe("readRoom", () => {
  it("reads current rooms without migrating", () => {
    const room = migrateV1ToV2(legacyRoomV1());
    const result = readRoom(JSON.parse(JSON.stringify(room)));
    expect(result).toMatchObject({ ok: true, migratedFrom: null });
  });

  it("migrates v1 rooms and reports it", () => {
    const result = readRoom(legacyRoomV1());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFrom).toBe(1);
      expect(result.room.title).toBe("my old room");
    }
  });

  it("refuses invalid v1 data with a recoverable message", () => {
    const result = readRoom({ ...legacyRoomV1(), links: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/couldn't be upgraded/);
  });

  it("refuses unknown future versions", () => {
    const result = readRoom({ schemaVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/version 99/);
  });
});
