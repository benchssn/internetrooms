import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDefaultRoom } from "../../data/defaultRoom";
import { roomWith, setAllVisible, widgetOf } from "../../test/rooms";
import type { RoomConfig } from "../../types/room";
import { ClassicWeb } from "./ClassicWeb";

const baseRoom = getDefaultRoom();

function renderRoom(room: RoomConfig = baseRoom) {
  return render(<ClassicWeb room={room} />);
}

describe("ClassicWeb", () => {
  it("renders the example room successfully", () => {
    renderRoom();
    expect(
      screen.getByRole("heading", { level: 1, name: /my little corner of the internet/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Internetrooms")).toBeInTheDocument();
  });

  it("shows the room title and owner information", () => {
    renderRoom();
    const about = widgetOf(baseRoom, "about").content;
    expect(screen.getByRole("heading", { level: 1, name: baseRoom.title })).toBeInTheDocument();
    expect(screen.getByText(about.displayName)).toBeInTheDocument();
    expect(screen.getByText(about.bio)).toBeInTheDocument();
  });

  it("renders enabled sections", () => {
    renderRoom();
    for (const name of ["About Me", "Art Gallery", "Music", "Favourite Links"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("does not render hidden sections", () => {
    renderRoom(roomWith((r) => setAllVisible(r, false)));
    for (const name of ["About Me", "Art Gallery", "Music", "Favourite Links"]) {
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
  });

  it("handles an empty artwork array", () => {
    renderRoom(roomWith((r) => (widgetOf(r, "gallery").content.artwork = [])));
    expect(screen.getByText(/The gallery is empty for now/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Abstract geometric shapes/i })).not.toBeInTheDocument();
  });

  it("handles a null music configuration", () => {
    renderRoom(roomWith((r) => (widgetOf(r, "music").content.music = null)));
    expect(screen.getByText(/Nothing queued right now/i)).toBeInTheDocument();
  });

  it("renders links with labels and safe attributes", () => {
    renderRoom();
    const link = screen.getByRole("link", { name: "Internet Archive" });
    expect(link).toHaveAttribute("href", "https://archive.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never implies a guestbook", () => {
    renderRoom();
    expect(screen.queryByText(/guestbook/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows an empty links state", () => {
    renderRoom(roomWith((r) => (widgetOf(r, "links").content.links = [])));
    const linksSection = screen.getByRole("region", { name: "Favourite Links" });
    expect(within(linksSection).getByText(/No links yet/i)).toBeInTheDocument();
  });

  it("applies the background pattern", () => {
    renderRoom(roomWith((r) => (r.theme.backgroundPattern = "grid")));
    expect(screen.getByTestId("room-page")).toHaveAttribute("data-pattern", "grid");
  });

  it("exposes theme colours as CSS variables", () => {
    renderRoom();
    expect(screen.getByTestId("room-page").style.getPropertyValue("--room-bg")).toBe(
      baseRoom.theme.backgroundColor,
    );
  });

  it("renders unsafe link URLs as plain text, not links", () => {
    renderRoom(
      roomWith(
        (r) => (widgetOf(r, "links").content.links = [{ id: "bad", label: "Sneaky", url: "javascript:alert(1)" }]),
      ),
    );
    expect(screen.queryByRole("link", { name: "Sneaky" })).not.toBeInTheDocument();
    expect(screen.getByText("Sneaky")).toBeInTheDocument();
  });

  it("shows a fallback for disallowed image URLs", () => {
    renderRoom(
      roomWith(
        (r) =>
          (widgetOf(r, "gallery").content.artwork = [
            { id: "a", title: "Bad", alt: "a cat", image: { kind: "url", url: "data:image/png;base64,AA" } },
          ]),
      ),
    );
    expect(screen.getByRole("img", { name: "Image unavailable: a cat" })).toBeInTheDocument();
    expect(document.querySelector("img[src^='data:']")).toBeNull();
  });

  it("shows a fallback when an image fails to load", () => {
    renderRoom();
    const alt = widgetOf(baseRoom, "gallery").content.artwork[0].alt;
    fireEvent.error(screen.getByRole("img", { name: alt }));
    expect(screen.getByRole("img", { name: `Image unavailable: ${alt}` })).toBeInTheDocument();
  });

  it("skips links that don't have a label yet", () => {
    renderRoom(
      roomWith((r) => (widgetOf(r, "links").content.links = [{ id: "blank", label: "  ", url: "https://a.com" }])),
    );
    expect(screen.getByText(/No links yet/i)).toBeInTheDocument();
  });
});
