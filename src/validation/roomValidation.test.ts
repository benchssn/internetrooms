import { describe, expect, it } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import {
  getFieldErrors,
  isSafeImageUrl,
  isSafeLinkUrl,
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

describe("validateRoomConfig", () => {
  it("accepts the bundled example room", () => {
    const result = validateRoomConfig(getDefaultRoom());
    expect(result.ok).toBe(true);
  });

  it("accepts Milestone 1 rooms without a background pattern", () => {
    const room = getDefaultRoom();
    delete room.theme.backgroundPattern;
    const result = validateRoomConfig(room);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.room.theme.backgroundPattern).toBeUndefined();
  });

  it("strips unknown fields", () => {
    const input = { ...getDefaultRoom(), injected: "<script>" };
    const result = validateRoomConfig(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect("injected" in result.room).toBe(false);
  });

  it.each([
    ["non-object", "hello"],
    ["null", null],
    ["wrong schema version", { ...getDefaultRoom(), schemaVersion: 2 }],
    ["unknown template", { ...getDefaultRoom(), template: "other" }],
    ["overlong title", { ...getDefaultRoom(), title: "x".repeat(81) }],
    ["empty title", { ...getDefaultRoom(), title: "  " }],
    [
      "bad colour",
      { ...getDefaultRoom(), theme: { ...getDefaultRoom().theme, textColor: "red" } },
    ],
    [
      "unknown pattern",
      {
        ...getDefaultRoom(),
        theme: { ...getDefaultRoom().theme, backgroundPattern: "lava" },
      },
    ],
    [
      "non-boolean widget",
      { ...getDefaultRoom(), widgets: { ...getDefaultRoom().widgets, about: "yes" } },
    ],
    [
      "javascript link",
      {
        ...getDefaultRoom(),
        links: [{ id: "l1", label: "x", url: "javascript:alert(1)" }],
      },
    ],
    [
      "data image",
      {
        ...getDefaultRoom(),
        artwork: [
          { id: "a1", title: "x", alt: "x", imageUrl: "data:image/png;base64,AA" },
        ],
      },
    ],
    [
      "duplicate ids",
      {
        ...getDefaultRoom(),
        links: [
          { id: "same", label: "a", url: "https://a.com" },
          { id: "same", label: "b", url: "https://b.com" },
        ],
      },
    ],
    [
      "too many links",
      {
        ...getDefaultRoom(),
        links: Array.from({ length: 21 }, (_, i) => ({
          id: `l${i}`,
          label: "x",
          url: "https://a.com",
        })),
      },
    ],
    [
      "too many artworks",
      {
        ...getDefaultRoom(),
        artwork: Array.from({ length: 13 }, (_, i) => ({
          id: `a${i}`,
          title: "x",
          alt: "x",
          imageUrl: "https://a.com/a.png",
        })),
      },
    ],
  ])("rejects %s", (_name, input) => {
    expect(validateRoomConfig(input).ok).toBe(false);
  });
});

describe("getFieldErrors", () => {
  it("returns no errors for the default room", () => {
    expect(getFieldErrors(getDefaultRoom())).toEqual({});
  });

  it("flags required and format problems", () => {
    const room = getDefaultRoom();
    room.title = "";
    room.links = [{ id: "l1", label: "Bad", url: "javascript:alert(1)" }];
    const errors = getFieldErrors(room);
    expect(errors.title?.kind).toBe("required");
    expect(errors["links.l1.url"]?.kind).toBe("format");
  });
});

describe("roomsEqual", () => {
  it("treats a missing pattern and colour case as equivalent", () => {
    const a = getDefaultRoom();
    const b = getDefaultRoom();
    delete b.theme.backgroundPattern;
    b.theme.backgroundColor = b.theme.backgroundColor.toLowerCase();
    expect(roomsEqual(a, b)).toBe(true);
  });

  it("detects real changes", () => {
    const a = getDefaultRoom();
    const b = getDefaultRoom();
    b.title = "changed";
    expect(roomsEqual(a, b)).toBe(false);
  });
});
