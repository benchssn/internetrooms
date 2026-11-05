import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { getDefaultRoom } from "./data/defaultRoom";
import { STORAGE_KEY } from "./storage/roomStorage";
import { TEMPLATE_REGISTRY } from "./templates/templateRegistry";
import type { RoomConfig } from "./types/room";

function renderAt(path: string) {
  window.history.replaceState(null, "", path);
  const user = userEvent.setup();
  return { user, ...render(<App />) };
}

function saveToStorage(room: RoomConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
}

function storedRaw() {
  return localStorage.getItem(STORAGE_KEY);
}

function livePreview() {
  return screen.getByRole("region", { name: /live preview/i });
}

describe("routes", () => {
  it("/ renders the homepage, not the editor", () => {
    renderAt("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "internetrooms" }),
    ).toBeInTheDocument();
    expect(screen.getByText("a place to get lost, not stuck.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your room" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(screen.getByRole("link", { name: "Edit your room" })).toHaveAttribute(
      "href",
      "/edit",
    );
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(document.title).toBe("internetrooms");
  });

  it("/ previews all three templates", () => {
    renderAt("/");
    for (const name of ["Classic Web", "Cyber Room", "Dream Room"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("/edit renders the editor", () => {
    renderAt("/edit");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByLabelText(/room title/i)).toBeInTheDocument();
    expect(livePreview()).toBeInTheDocument();
  });

  it("/templates renders all three templates", () => {
    renderAt("/templates");
    expect(
      screen.getByRole("heading", { level: 1, name: /choose your room template/i }),
    ).toBeInTheDocument();
    for (const name of ["Classic Web", "Cyber Room", "Dream Room"]) {
      expect(screen.getByRole("article", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Keep Classic Web" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Cyber Room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Dream Room" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      /changes your colours and background pattern/i,
    );
  });

  it("unknown routes render the 404 page", () => {
    renderAt("/no/such/room");
    expect(
      screen.getByRole("heading", { level: 1, name: /this room doesn't exist/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("/no/such/room")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to the homepage/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("marks the current page in the main navigation", () => {
    renderAt("/templates");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Templates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("/room", () => {
  it("renders the saved room without editor controls", () => {
    const room = getDefaultRoom();
    room.title = "my saved hideout";
    room.template = "cyber-room";
    saveToStorage(room);

    renderAt("/room");
    expect(
      screen.getByRole("heading", { level: 1, name: "my saved hideout" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("room-page")).toHaveAttribute(
      "data-template",
      "cyber-room",
    );
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to site" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText(/saved in this browser only/i)).toBeInTheDocument();
  });

  it("explains when nothing has been saved yet", () => {
    renderAt("/room");
    expect(
      screen.getByRole("heading", { level: 1, name: /no saved room yet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("room-page")).not.toBeInTheDocument();
  });

  it("explains when saved data is damaged", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    renderAt("/room");
    expect(
      screen.getByRole("heading", { level: 1, name: /couldn't be opened/i }),
    ).toBeInTheDocument();
    expect(storedRaw()).toBe("{broken");
  });

  it("reads legacy Milestone 1 rooms (no pattern, classic template)", () => {
    const legacy = getDefaultRoom();
    delete legacy.theme.backgroundPattern;
    legacy.title = "legacy room";
    saveToStorage(legacy);

    renderAt("/room");
    const page = screen.getByTestId("room-page");
    expect(page).toHaveAttribute("data-template", "classic-web");
    expect(page).toHaveAttribute("data-pattern", "stars");
    expect(
      screen.getByRole("heading", { level: 1, name: "legacy room" }),
    ).toBeInTheDocument();
  });

  it("shows the last save, not unsaved edits", async () => {
    const room = getDefaultRoom();
    room.title = "saved version";
    saveToStorage(room);
    const { user } = renderAt("/edit");

    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "draft version");
    await user.click(screen.getByRole("link", { name: "My room" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "saved version" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/you have unsaved edits/i)).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("navigates with links and supports back/forward", async () => {
    const { user } = renderAt("/");

    await user.click(screen.getByRole("link", { name: "Create your room" }));
    expect(window.location.pathname).toBe("/templates");
    expect(
      screen.getByRole("heading", { level: 1, name: /choose your room template/i }),
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Edit room" }));
    expect(window.location.pathname).toBe("/edit");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe("/templates"));
    expect(
      await screen.findByRole("heading", { level: 1, name: /choose your room template/i }),
    ).toBeInTheDocument();

    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(
      await screen.findByRole("heading", { level: 1, name: "internetrooms" }),
    ).toBeInTheDocument();

    act(() => window.history.forward());
    await waitFor(() => expect(window.location.pathname).toBe("/templates"));
    expect(
      await screen.findByRole("heading", { level: 1, name: /choose your room template/i }),
    ).toBeInTheDocument();
  });

  it("keeps unsaved editor changes when moving between pages", async () => {
    const { user } = renderAt("/edit");
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "still here");

    await user.click(screen.getByRole("link", { name: "Templates" }));
    expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep Classic Web" }));

    expect(screen.getByLabelText(/room title/i)).toHaveValue("still here");
    expect(screen.getByTestId("save-state")).toHaveTextContent("Unsaved changes");
  });
});

describe("template selection", () => {
  it("updates the editor draft and opens /edit", async () => {
    const { user } = renderAt("/templates");
    await user.click(screen.getByRole("button", { name: "Use Cyber Room" }));

    expect(window.location.pathname).toBe("/edit");
    const page = within(livePreview()).getByTestId("room-page");
    expect(page).toHaveAttribute("data-template", "cyber-room");
    const cyberTheme = TEMPLATE_REGISTRY["cyber-room"].defaultTheme;
    expect(page.style.getPropertyValue("--room-bg")).toBe(cyberTheme.backgroundColor);
    expect(page).toHaveAttribute("data-pattern", cyberTheme.backgroundPattern);

    expect(screen.getByText(/switched to cyber room/i)).toBeInTheDocument();
    expect(screen.getByText(/current template:/i).closest("p")).toHaveTextContent(
      "Cyber Room",
    );
    expect(screen.getByTestId("save-state")).toHaveTextContent("Unsaved changes");
    expect(
      screen.getByRole("button", { name: /restore cyber room colours/i }),
    ).toBeInTheDocument();
  });

  it("does not overwrite saved data before Save", async () => {
    const saved = getDefaultRoom();
    saved.title = "my saved classic room";
    saveToStorage(saved);
    const before = storedRaw();

    const { user } = renderAt("/templates");
    await user.click(screen.getByRole("button", { name: "Use Dream Room" }));
    expect(storedRaw()).toBe(before);

    // Viewing the saved room still shows the old template.
    await user.click(screen.getByRole("link", { name: "My room" }));
    expect(screen.getByTestId("room-page")).toHaveAttribute(
      "data-template",
      "classic-web",
    );

    // Saving in the editor commits the new template.
    await user.click(screen.getByRole("link", { name: "Edit room" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const stored = JSON.parse(storedRaw()!) as RoomConfig;
    expect(stored.template).toBe("dream-room");
    expect(stored.title).toBe("my saved classic room");
  });

  it("preserves room content when switching templates", async () => {
    const room = getDefaultRoom();
    room.owner.bio = "a bio worth keeping";
    room.music = { title: "Night Drive", artist: "Modem", description: "vibes" };
    room.links.push({ id: "l2", label: "Zine", url: "https://zine.example.com" });
    room.artwork.push({
      id: "a2",
      title: "Second Piece",
      imageUrl: "https://example.com/two.png",
      alt: "a second piece",
    });
    room.widgets.links = false;
    saveToStorage(room);

    const { user } = renderAt("/templates");
    await user.click(screen.getByRole("button", { name: "Use Dream Room" }));
    await user.click(screen.getByRole("link", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: "Use Cyber Room" }));

    expect(screen.getByLabelText(/biography/i)).toHaveValue("a bio worth keeping");
    expect(screen.getByLabelText(/track title/i)).toHaveValue("Night Drive");
    expect(screen.getAllByLabelText(/^label/i).map((el) => (el as HTMLInputElement).value)).toEqual([
      "Internet Archive",
      "Zine",
    ]);
    expect(screen.getAllByLabelText(/alternative text/i)).toHaveLength(2);
    expect(screen.getByRole("switch", { name: /show favourite links/i })).not.toBeChecked();

    const preview = livePreview();
    expect(within(preview).getByText("a bio worth keeping")).toBeInTheDocument();
    expect(within(preview).getByText("Night Drive")).toBeInTheDocument();
    expect(
      within(preview).queryByRole("region", { name: "Favourite Links" }),
    ).not.toBeInTheDocument();
  });
});
