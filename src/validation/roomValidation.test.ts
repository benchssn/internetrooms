import { describe, expect, it } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import { roomWith, textWidget, widgetOf } from "../test/rooms";
import {
  getFieldErrors,
  isSafeImageUrl,
  isSafeLinkUrl,
  isAssetId,
  parseHexColour,
  roomsEqual,
  validateRoomConfig,
} from "./roomValidation";

describe("URL validation", () => {
  it.each([
    "https://archive.org",
    "https://example.com/path?q=1#top",
  ])("accepts safe link %s", (url) => {
    expect(isSafeLinkUrl(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "ftp://example.com",
    "file:///etc/passwd",
    "//example.com",
    "/relative",
    "https://user:pass@example.com",
    " https://example.com",
    "https://exa mple.com",
    "",
    `https://example.com/${"a".repeat(2048)}`,
  ])("rejects unsafe link %s", (url) => {
    expect(isSafeLinkUrl(url)).toBe(false);
  });

  it.each([
    "https://example.com/art.png",
    "/assets/images/digital-dreams.svg",
    "/assets/backgrounds/stars.webp",
  ])("accepts image %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(true);
  });

  it.each([
    "data:image/png;base64,AAAA",
    "data:image/svg+xml,<svg/>",
    "javascript:alert(1)",
    "http://example.com/a.png",
    "file:///Users/me/a.png",
    "C:\\pictures\\a.png",
    "/assets/../secret.png",
    "/etc/passwd",
    "/assets/images/run.js",
    "//evil.example/a.png",
  ])("rejects image %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(false);
  });
});

describe("parseHexColour", () => {
  it("normalises valid input", () => {
    expect(parseHexColour("#abcdef")).toBe("#ABCDEF");
    expect(parseHexColour("abcdef")).toBe("#ABCDEF");
    expect(parseHexColour(" #abc ")).toBe("#AABBCC");
  });

  it("rejects invalid input", () => {
    expect(parseHexColour("#abcd")).toBeNull();
    expect(parseHexColour("red")).toBeNull();
    expect(parseHexColour("#gggggg")).toBeNull();
    expect(parseHexColour("")).toBeNull();
  });
});

describe("validateRoomConfig (schema v2)", () => {
  it("accepts the bundled example room", () => {
    expect(validateRoomConfig(getDefaultRoom()).ok).toBe(true);
  });

  it.each(["classic-web", "cyber-room", "dream-room"])("accepts the %s template", (template) => {
    expect(validateRoomConfig({ ...getDefaultRoom(), template }).ok).toBe(true);
  });

  it("accepts every widget type, including several of the new ones", () => {
    const room = roomWith((r) => {
      r.layout.widgets.push(
        textWidget("t1", "Hello", "First.\n\nSecond."),
        textWidget("t2", "", "Another"),
        {
          id: "i1",
          type: "image",
          visible: false,
          width: "full",
          content: { image: { kind: "asset", assetId: "asset-abc123" }, alt: "a cat", caption: "" },
        },
        {
          id: "c1",
          type: "link-collection",
          visible: true,
          width: "half",
          content: { title: "Zines", links: [{ id: "z", label: "Zine", url: "https://zine.example" }] },
        },
      );
    });
    const result = validateRoomConfig(room);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.room.layout.widgets).toHaveLength(8);
  });

  it("strips unknown fields everywhere", () => {
    const room = getDefaultRoom() as unknown as Record<string, unknown>;
    room.injected = "<script>";
    (widgetOf(room as never, "about") as unknown as Record<string, unknown>).extra = 1;
    const result = validateRoomConfig(room);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("injected" in result.room).toBe(false);
      expect("extra" in widgetOf(result.room, "about")).toBe(false);
    }
  });

  const invalid: [string, (r: ReturnType<typeof getDefaultRoom>) => void][] = [
    ["schema version 1 shape", (r) => Object.assign(r, { schemaVersion: 1 })],
    ["unknown template", (r) => Object.assign(r, { template: "other" })],
    ["overlong title", (r) => (r.title = "x".repeat(81))],
    ["empty title", (r) => (r.title = "  ")],
    ["bad colour", (r) => (r.theme.textColor = "red")],
    ["unknown pattern", (r) => Object.assign(r.theme, { backgroundPattern: "lava" })],
    ["unknown font", (r) => Object.assign(r.theme.typography, { headingFont: "Comic Papyrus" })],
    ["bad gradient colour", (r) => (r.theme.background.gradient.from = "url(evil)")],
    ["image background without an image", (r) => (r.theme.background.mode = "image")],
    ["missing core widget", (r) => (r.layout.widgets = r.layout.widgets.filter((w) => w.type !== "music"))],
    ["duplicate core widget", (r) => r.layout.widgets.push({ ...widgetOf(r, "about"), id: "w-about-2" })],
    ["duplicate widget ids", (r) => r.layout.widgets.push(textWidget("w-about", "", "x"))],
    ["unknown widget type", (r) => r.layout.widgets.push({ ...textWidget("x", "", "x"), type: "guestbook" } as never)],
    ["bad widget width", (r) => Object.assign(r.layout.widgets[0], { width: "third" })],
    ["non-boolean visibility", (r) => Object.assign(r.layout.widgets[0], { visible: "yes" })],
    ["javascript link", (r) => (widgetOf(r, "links").content.links[0].url = "javascript:alert(1)")],
    [
      "data image URL",
      (r) => (widgetOf(r, "gallery").content.artwork[0].image = { kind: "url", url: "data:image/png;base64,AA" }),
    ],
    [
      "malformed asset id",
      (r) => (widgetOf(r, "gallery").content.artwork[0].image = { kind: "asset", assetId: "../../etc" }),
    ],
    [
      "too many links",
      (r) =>
        (widgetOf(r, "links").content.links = Array.from({ length: 21 }, (_, i) => ({
          id: `l${i}`,
          label: "x",
          url: "https://a.com",
        }))),
    ],
    [
      "unknown decoration",
      (r) => r.decorations.push({ id: "d9", kind: "skull" as never, slot: "footer" }),
    ],
    [
      "unknown decoration slot",
      (r) => r.decorations.push({ id: "d9", kind: "heart", slot: "anywhere" as never }),
    ],
  ];

  it.each(invalid)("rejects %s", (_name, edit) => {
    expect(validateRoomConfig(roomWith(edit)).ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateRoomConfig("hello").ok).toBe(false);
    expect(validateRoomConfig(null).ok).toBe(false);
  });
});

describe("isAssetId", () => {
  it("accepts generated ids and rejects anything else", () => {
    expect(isAssetId("asset-lz3k1-ab12cd")).toBe(true);
    expect(isAssetId("asset-")).toBe(false);
    expect(isAssetId("asset-../x")).toBe(false);
    expect(isAssetId("blob:https://x")).toBe(false);
  });
});

describe("getFieldErrors", () => {
  it("returns no errors for the default room", () => {
    expect(getFieldErrors(getDefaultRoom())).toEqual({});
  });

  it("flags required and format problems with widget-scoped paths", () => {
    const room = roomWith((r) => {
      r.title = "";
      widgetOf(r, "links").content.links = [{ id: "l1", label: "Bad", url: "javascript:alert(1)" }];
      r.layout.widgets.push(textWidget("t1", "", ""));
    });
    const errors = getFieldErrors(room);
    expect(errors.title?.kind).toBe("required");
    expect(errors["widgets.w-links.links.l1.url"]?.kind).toBe("format");
    expect(errors["widgets.t1.body"]?.kind).toBe("required");
  });

  it("checks hidden widgets too, so nothing invalid is ever saved", () => {
    const room = roomWith((r) => {
      const t = textWidget("t1", "", "");
      t.visible = false;
      r.layout.widgets.push(t);
    });
    expect(getFieldErrors(room)["widgets.t1.body"]).toBeDefined();
  });

  it("requires an image when the background is set to image", () => {
    const room = roomWith((r) => (r.theme.background.mode = "image"));
    expect(getFieldErrors(room)["theme.background.image"]?.kind).toBe("required");
  });
});

describe("roomsEqual", () => {
  it("ignores colour case and empty music descriptions", () => {
    const a = getDefaultRoom();
    const b = roomWith((r) => {
      r.theme.backgroundColor = r.theme.backgroundColor.toLowerCase();
      r.theme.background.gradient.to = r.theme.background.gradient.to.toLowerCase();
    });
    expect(roomsEqual(a, b)).toBe(true);

    const withEmpty = roomWith((r) => {
      const music = widgetOf(r, "music").content.music!;
      delete music.description;
    });
    const withBlank = roomWith((r) => (widgetOf(r, "music").content.music!.description = ""));
    expect(roomsEqual(withEmpty, withBlank)).toBe(true);
  });

  it("detects real changes, including widget order", () => {
    const a = getDefaultRoom();
    expect(roomsEqual(a, roomWith((r) => (r.title = "changed")))).toBe(false);
    expect(roomsEqual(a, roomWith((r) => r.layout.widgets.reverse()))).toBe(false);
  });
});
