import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDefaultRoom } from "../data/defaultRoom";
import { TEMPLATE_IDS, type RoomConfig, type TemplateId } from "../types/room";
import { validateRoomConfig } from "../validation/roomValidation";
import { applyTemplate } from "./applyTemplate";
import { RoomRenderer } from "./RoomRenderer";
import { TEMPLATE_REGISTRY, TEMPLATES, getTemplate } from "./templateRegistry";
import { WIDGET_HEADINGS } from "./shared/roomContent";

function roomFor(id: TemplateId, overrides: Partial<RoomConfig> = {}): RoomConfig {
  return { ...applyTemplate(getDefaultRoom(), id), ...overrides };
}

describe("template registry", () => {
  it("has exactly one entry per template id, in order", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    for (const id of TEMPLATE_IDS) {
      expect(TEMPLATE_REGISTRY[id].id).toBe(id);
    }
  });

  it("matches the bundled example room's theme for Classic Web", () => {
    expect(TEMPLATE_REGISTRY["classic-web"].defaultTheme).toEqual(
      getDefaultRoom().theme,
    );
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
  it("switches template and theme but preserves all content", () => {
    const room = getDefaultRoom();
    room.owner.bio = "my bio";
    room.widgets.music = false;
    room.links.push({ id: "l2", label: "Zine", url: "https://zine.example" });

    const switched = applyTemplate(room, "dream-room");

    expect(switched.template).toBe("dream-room");
    expect(switched.theme).toEqual(TEMPLATE_REGISTRY["dream-room"].defaultTheme);
    expect(switched.title).toBe(room.title);
    expect(switched.tagline).toBe(room.tagline);
    expect(switched.owner).toEqual(room.owner);
    expect(switched.artwork).toEqual(room.artwork);
    expect(switched.music).toEqual(room.music);
    expect(switched.links).toEqual(room.links);
    expect(switched.widgets).toEqual(room.widgets);
    // The original object is left untouched.
    expect(room.template).toBe("classic-web");
  });
});

describe.each(TEMPLATE_IDS)("%s template", (id) => {
  it("renders the room identity and every supported widget", () => {
    const room = roomFor(id);
    render(<RoomRenderer room={room} />);

    const page = screen.getByTestId("room-page");
    expect(page).toHaveAttribute("data-template", id);
    expect(
      screen.getByRole("heading", { level: 1, name: room.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(room.tagline)).toBeInTheDocument();

    for (const heading of Object.values(WIDGET_HEADINGS)) {
      expect(screen.getByRole("region", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(room.owner.displayName)).toBeInTheDocument();
    expect(screen.getByText(room.owner.bio)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: room.artwork[0].alt }),
    ).toBeInTheDocument();
    expect(screen.getByText(room.artwork[0].title)).toBeInTheDocument();
    expect(screen.getByText(room.music!.title)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: room.links[0].label });
    expect(link).toHaveAttribute("href", room.links[0].url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("respects widget visibility", () => {
    render(
      <RoomRenderer
        room={roomFor(id, {
          widgets: {
            about: false,
            gallery: false,
            music: false,
            links: false,
            guestbook: true,
          },
        })}
      />,
    );
    for (const heading of Object.values(WIDGET_HEADINGS)) {
      expect(screen.queryByRole("region", { name: heading })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
  });

  it("handles empty content", () => {
    const room = roomFor(id, { artwork: [], links: [], music: null });
    room.owner.bio = "";
    render(<RoomRenderer room={room} />);
    for (const heading of Object.values(WIDGET_HEADINGS)) {
      const region = screen.getByRole("region", { name: heading });
      expect(region.textContent?.length).toBeGreaterThan(heading.length);
    }
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("applies theme colours and background patterns", () => {
    const room = roomFor(id);
    room.theme = { ...room.theme, backgroundColor: "#123456", backgroundPattern: "checkerboard" };
    render(<RoomRenderer room={room} />);
    const page = screen.getByTestId("room-page");
    expect(page.style.getPropertyValue("--room-bg")).toBe("#123456");
    expect(page).toHaveAttribute("data-pattern", "checkerboard");
  });

  it("never renders unsafe links as links", () => {
    render(
      <RoomRenderer
        room={roomFor(id, {
          links: [{ id: "x", label: "Sneaky", url: "javascript:alert(1)" }],
        })}
      />,
    );
    const links = screen.getByRole("region", { name: WIDGET_HEADINGS.links });
    expect(within(links).getByText("Sneaky")).toBeInTheDocument();
    expect(within(links).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("RoomRenderer", () => {
  it("falls back to Classic Web for an unknown template id", () => {
    const room = { ...getDefaultRoom(), template: "space-station" } as unknown as RoomConfig;
    render(<RoomRenderer room={room} />);
    expect(screen.getByTestId("room-page")).toHaveAttribute(
      "data-template",
      "classic-web",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: room.title }),
    ).toBeInTheDocument();
  });
});
