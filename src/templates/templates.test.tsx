import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import { putAsset } from "../storage/assetStore";
import { roomWith, setAllVisible, textWidget, widgetOf } from "../test/rooms";
import { TEMPLATE_IDS, type RoomConfig, type TemplateId } from "../types/room";
import { validateRoomConfig } from "../validation/roomValidation";
import { applyTemplate } from "./applyTemplate";
import { RoomRenderer } from "./RoomRenderer";
import { WIDGET_HEADINGS } from "./shared/roomContent";
import { FONT_STACKS } from "./shared/typography";
import { getTemplate, TEMPLATE_REGISTRY, TEMPLATES } from "./templateRegistry";

function roomFor(id: TemplateId, edit?: (r: RoomConfig) => void): RoomConfig {
  const room = applyTemplate(getDefaultRoom(), id);
  edit?.(room);
  return room;
}

/** A room using every widget type, in a deliberate order. */
function richRoom(id: TemplateId): RoomConfig {
  return roomFor(id, (r) => {
    r.layout.widgets.unshift(textWidget("t1", "Diary", "First paragraph.\n\nSecond paragraph."));
    r.layout.widgets.push(
      {
        id: "i1",
        type: "image",
        visible: true,
        width: "full",
        content: { image: { kind: "url", url: "https://example.com/cat.png" }, alt: "a sleepy cat", caption: "Mochi" },
      },
      {
        id: "c1",
        type: "link-collection",
        visible: true,
        width: "half",
        content: { title: "Zines I love", links: [{ id: "z", label: "Paper Zine", url: "https://zine.example" }] },
      },
    );
  });
}

function widgetOrder() {
  return Array.from(document.querySelectorAll("[data-widget-type]")).map((el) =>
    el.getAttribute("data-widget-type"),
  );
}

describe("template registry", () => {
  it("has exactly one entry per template id, in order", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    for (const id of TEMPLATE_IDS) expect(TEMPLATE_REGISTRY[id].id).toBe(id);
  });

  it("matches the bundled example room's colours for Classic Web", () => {
    const { theme } = getDefaultRoom();
    expect(TEMPLATE_REGISTRY["classic-web"].defaultTheme).toEqual({
      backgroundColor: theme.backgroundColor,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      textColor: theme.textColor,
      backgroundPattern: theme.backgroundPattern,
    });
  });

  it("only offers default themes that pass validation", () => {
    for (const template of TEMPLATES) {
      expect(validateRoomConfig(roomFor(template.id)).ok).toBe(true);
    }
  });

  it("does not resolve unknown or inherited ids", () => {
    expect(getTemplate("nope")).toBeUndefined();
    expect(getTemplate("toString")).toBeUndefined();
  });
});

describe("applyTemplate", () => {
  it("changes colours and pattern but keeps widgets, typography and decorations", () => {
    const room = richRoom("classic-web");
    room.theme.typography.headingFont = "serif";
    room.theme.background = {
      mode: "gradient",
      gradient: { from: "#000000", to: "#FFFFFF", direction: "to right" },
      image: { source: { kind: "url", url: "https://example.com/bg.png" }, fit: "tile" },
    };
    room.layout.widgets[1].width = "full";
    room.layout.widgets[2].visible = false;

    const switched = applyTemplate(room, "dream-room");
    const dream = TEMPLATE_REGISTRY["dream-room"].defaultTheme;

    expect(switched.template).toBe("dream-room");
    expect(switched.theme.backgroundColor).toBe(dream.backgroundColor);
    expect(switched.theme.backgroundPattern).toBe(dream.backgroundPattern);
    expect(switched.theme.background.mode).toBe("pattern");
    // Remembered so switching back to a gradient/image is one click.
    expect(switched.theme.background.gradient).toEqual(room.theme.background.gradient);
    expect(switched.theme.background.image).toEqual(room.theme.background.image);
    expect(switched.theme.typography).toEqual(room.theme.typography);
    expect(switched.layout).toEqual(room.layout);
    expect(switched.decorations).toEqual(room.decorations);
    expect(switched.title).toBe(room.title);
    expect(room.template).toBe("classic-web");
  });
});

describe.each(TEMPLATE_IDS)("%s template", (id) => {
  it("renders the room identity and every widget type", () => {
    const room = richRoom(id);
    render(<RoomRenderer room={room} />);

    expect(screen.getByTestId("room-page")).toHaveAttribute("data-template", id);
    expect(screen.getByRole("heading", { level: 1, name: room.title })).toBeInTheDocument();

    for (const heading of Object.values(WIDGET_HEADINGS)) {
      expect(screen.getByRole("region", { name: heading })).toBeInTheDocument();
    }
    const about = widgetOf(room, "about").content;
    expect(screen.getByText(about.displayName)).toBeInTheDocument();
    expect(screen.getByText(widgetOf(room, "music").content.music!.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Internet Archive" })).toHaveAttribute("rel", "noopener noreferrer");

    const diary = screen.getByRole("region", { name: "Diary" });
    expect(within(diary).getByText("First paragraph.")).toBeInTheDocument();
    expect(within(diary).getByText("Second paragraph.")).toBeInTheDocument();

    const image = screen.getByRole("region", { name: "Mochi" });
    expect(within(image).getByRole("img", { name: "a sleepy cat" })).toBeInTheDocument();
    expect(within(image).getByText("Mochi")).toBeInTheDocument();

    const zines = screen.getByRole("region", { name: "Zines I love" });
    expect(within(zines).getByRole("link", { name: "Paper Zine" })).toHaveAttribute("href", "https://zine.example");
  });

  it("renders widgets in the configured order with their widths", () => {
    render(<RoomRenderer room={richRoom(id)} />);
    expect(widgetOrder()).toEqual(["text", "about", "music", "gallery", "links", "image", "link-collection"]);
    const cell = (type: string) => document.querySelector(`[data-widget-type="${type}"]`);
    expect(cell("text")).toHaveAttribute("data-width", "half");
    expect(cell("gallery")).toHaveAttribute("data-width", "full");
  });

  it("respects widget visibility", () => {
    render(<RoomRenderer room={roomFor(id, (r) => setAllVisible(r, false))} />);
    for (const heading of Object.values(WIDGET_HEADINGS)) {
      expect(screen.queryByRole("region", { name: heading })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
  });

  it("handles empty content", () => {
    const room = roomFor(id, (r) => {
      widgetOf(r, "gallery").content.artwork = [];
      widgetOf(r, "links").content.links = [];
      widgetOf(r, "music").content.music = null;
      widgetOf(r, "about").content.bio = "";
    });
    render(<RoomRenderer room={room} />);
    for (const heading of Object.values(WIDGET_HEADINGS)) {
      const region = screen.getByRole("region", { name: heading });
      expect(region.textContent?.length).toBeGreaterThan(heading.length);
    }
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("applies theme colours, patterns and typography", () => {
    const room = roomFor(id, (r) => {
      r.theme.backgroundColor = "#123456";
      r.theme.backgroundPattern = "checkerboard";
      r.theme.typography = { headingFont: "serif", bodyFont: "typewriter", headingSize: "huge", align: "center" };
    });
    render(<RoomRenderer room={room} />);
    const page = screen.getByTestId("room-page");
    expect(page.style.getPropertyValue("--room-bg")).toBe("#123456");
    expect(page).toHaveAttribute("data-pattern", "checkerboard");
    expect(page.style.getPropertyValue("--room-font-heading")).toBe(FONT_STACKS.serif);
    expect(page.style.getPropertyValue("--room-font-body")).toBe(FONT_STACKS.typewriter);
    expect(page.style.getPropertyValue("--room-heading-scale")).toBe("1.55");
    expect(page.style.getPropertyValue("--room-align")).toBe("center");
  });

  it("leaves template fonts alone by default", () => {
    render(<RoomRenderer room={roomFor(id)} />);
    expect(screen.getByTestId("room-page").style.getPropertyValue("--room-font-heading")).toBe("");
  });

  it("paints gradient backgrounds", () => {
    const room = roomFor(id, (r) => {
      r.theme.background.mode = "gradient";
      r.theme.background.gradient = { from: "#000000", to: "#FF00FF", direction: "to right" };
    });
    render(<RoomRenderer room={room} />);
    const page = screen.getByTestId("room-page");
    expect(page).toHaveAttribute("data-background", "gradient");
    expect(page.style.getPropertyValue("--room-bg-layer")).toBe("linear-gradient(to right, #000000, #FF00FF)");
  });

  it("paints uploaded background images from IndexedDB", async () => {
    await putAsset({
      id: "asset-bg1",
      blob: new Blob([new Uint8Array([1])], { type: "image/webp" }),
      type: "image/webp",
      width: 10,
      height: 10,
      size: 1,
      createdAt: new Date().toISOString(),
    });
    const room = roomFor(id, (r) => {
      r.theme.background.mode = "image";
      r.theme.background.image = { source: { kind: "asset", assetId: "asset-bg1" }, fit: "cover" };
    });
    render(<RoomRenderer room={room} />);
    const page = screen.getByTestId("room-page");
    await waitFor(() => expect(page).toHaveAttribute("data-background", "image"));
    expect(page.style.getPropertyValue("--room-bg-layer")).toMatch(/^url\("blob:/);
  });

  it("places decorations in their slots, hidden from assistive technology", () => {
    const room = roomFor(id, (r) => {
      r.decorations = [
        { id: "d1", kind: "heart", slot: "header-end" },
        { id: "d2", kind: "divider-stars", slot: "below-widgets" },
        { id: "d3", kind: "badge-construction", slot: "footer" },
      ];
    });
    render(<RoomRenderer room={room} />);
    for (const slot of ["header-end", "below-widgets", "footer"]) {
      const el = document.querySelector(`[data-slot="${slot}"]`);
      expect(el).not.toBeNull();
      expect(el).toHaveAttribute("aria-hidden", "true");
    }
    expect(document.querySelector('[data-slot="header-start"]')).toBeNull();
  });

  it("never renders unsafe links as links", () => {
    const room = roomFor(id, (r) => {
      widgetOf(r, "links").content.links = [{ id: "x", label: "Sneaky", url: "javascript:alert(1)" }];
    });
    render(<RoomRenderer room={room} />);
    const links = screen.getByRole("region", { name: WIDGET_HEADINGS.links });
    expect(within(links).getByText("Sneaky")).toBeInTheDocument();
    expect(within(links).queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders text as text, never as HTML", () => {
    const room = roomFor(id, (r) => r.layout.widgets.push(textWidget("t", "x", '<img src=x onerror="alert(1)">')));
    render(<RoomRenderer room={room} />);
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});

describe("template switching", () => {
  it("keeps the same widget order and visibility in every template", () => {
    const base = richRoom("classic-web");
    base.layout.widgets[2].visible = false;
    const orders = TEMPLATE_IDS.map((id) => {
      const { unmount } = render(<RoomRenderer room={applyTemplate(base, id)} />);
      const order = widgetOrder();
      unmount();
      return order;
    });
    expect(orders[1]).toEqual(orders[0]);
    expect(orders[2]).toEqual(orders[0]);
    expect(orders[0]).not.toContain(base.layout.widgets[2].type);
  });
});

describe("RoomRenderer", () => {
  it("falls back to Classic Web for an unknown template id", () => {
    const room = { ...getDefaultRoom(), template: "space-station" } as unknown as RoomConfig;
    render(<RoomRenderer room={room} />);
    expect(screen.getByTestId("room-page")).toHaveAttribute("data-template", "classic-web");
  });

  it("wraps rooms in a size container so layouts follow the room's width", () => {
    const { container } = render(<RoomRenderer room={roomWith(() => {})} />);
    expect(container.firstElementChild?.className).toMatch(/container/);
  });
});
