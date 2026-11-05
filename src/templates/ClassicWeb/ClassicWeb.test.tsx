import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import exampleRoom from "../../data/example-room.json";
import type { RoomConfig } from "../../types/room";
import { ClassicWeb } from "./ClassicWeb";

const baseRoom = exampleRoom as RoomConfig;

function renderRoom(overrides: Partial<RoomConfig> = {}) {
  return render(<ClassicWeb room={{ ...baseRoom, ...overrides }} />);
}

describe("ClassicWeb", () => {
  it("renders the example room successfully", () => {
    renderRoom();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /my little corner of the internet/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Internetrooms")).toBeInTheDocument();
  });

  it("shows the room title and owner information", () => {
    renderRoom();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: baseRoom.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(baseRoom.owner.displayName)).toBeInTheDocument();
    expect(screen.getByText(baseRoom.owner.bio)).toBeInTheDocument();
  });

  it("renders enabled sections", () => {
    renderRoom();

    expect(
      screen.getByRole("heading", { name: "About Me" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Art Gallery" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Favourite Links" }),
    ).toBeInTheDocument();
  });

  it("does not render disabled sections", () => {
    renderRoom({
      widgets: {
        about: false,
        gallery: false,
        music: false,
        links: false,
        guestbook: false,
      },
    });

    expect(
      screen.queryByRole("heading", { name: "About Me" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Art Gallery" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Music" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Favourite Links" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
  });

  it("handles an empty artwork array", () => {
    renderRoom({ artwork: [] });

    expect(
      screen.getByText(/The gallery is empty for now/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: /Abstract geometric shapes/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("handles a null music configuration", () => {
    renderRoom({ music: null });

    expect(
      screen.getByText(/Nothing queued right now/i),
    ).toBeInTheDocument();
  });

  it("renders links with labels and safe attributes", () => {
    renderRoom();

    const link = screen.getByRole("link", { name: "Internet Archive" });
    expect(link).toHaveAttribute("href", "https://archive.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not imply guestbook submission even when the flag is true", () => {
    renderRoom({
      widgets: {
        ...baseRoom.widgets,
        guestbook: true,
      },
    });

    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows an empty links state", () => {
    renderRoom({ links: [] });

    const linksSection = screen.getByRole("region", {
      name: "Favourite Links",
    });
    expect(
      within(linksSection).getByText(/No links yet/i),
    ).toBeInTheDocument();
  });
});
