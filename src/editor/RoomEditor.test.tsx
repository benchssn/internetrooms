import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { getDefaultRoom } from "../data/defaultRoom";
import { STORAGE_KEY } from "../storage/roomStorage";
import type { RoomConfig } from "../types/room";

const defaults = getDefaultRoom();

function setup() {
  const user = userEvent.setup();
  const utils = render(<App />);
  return { user, ...utils };
}

function preview() {
  return screen.getByRole("region", { name: /live preview/i });
}

function controls() {
  return screen.getByRole("region", { name: /customise your room/i });
}

function section(name: RegExp) {
  return within(controls()).getByRole("region", { name });
}

function storedRoom(): RoomConfig {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}

function previewPage() {
  return within(preview()).getByTestId("classic-web-page");
}

describe("Room editor", () => {
  it("loads the bundled default room", () => {
    setup();
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(
      within(preview()).getByRole("heading", { level: 1, name: defaults.title }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-state")).toHaveTextContent(
      "All changes saved",
    );
  });

  it("updates the preview as the title is edited and marks it unsaved", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "starlight lounge");

    expect(
      within(preview()).getByRole("heading", { level: 1, name: "starlight lounge" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-state")).toHaveTextContent("Unsaved changes");
    expect(title).toHaveAccessibleDescription("16 / 80 characters");
  });

  it("updates identity and biography in the preview", async () => {
    const { user } = setup();
    const name = screen.getByLabelText(/display name/i);
    await user.clear(name);
    await user.type(name, "pixel pal");
    const bio = screen.getByLabelText(/biography/i);
    await user.clear(bio);
    await user.type(bio, "hello from the web");
    const tagline = screen.getByLabelText(/tagline/i);
    await user.clear(tagline);
    await user.type(tagline, "a new tagline");

    expect(within(preview()).getByText("pixel pal")).toBeInTheDocument();
    expect(within(preview()).getByText("hello from the web")).toBeInTheDocument();
    expect(within(preview()).getByText("a new tagline")).toBeInTheDocument();
  });

  it("applies valid hex colours to the renderer and ignores invalid ones", async () => {
    const { user } = setup();
    const hex = screen.getByRole("textbox", { name: /background colour hex/i });

    await user.clear(hex);
    await user.type(hex, "#ff00aa");
    expect(previewPage().style.getPropertyValue("--room-bg")).toBe("#FF00AA");

    await user.clear(hex);
    await user.type(hex, "nope");
    expect(hex).toHaveAttribute("aria-invalid", "true");
    expect(previewPage().style.getPropertyValue("--room-bg")).toBe("#FF00AA");
    expect(screen.getByText(/not a valid colour yet/i)).toBeInTheDocument();
  });

  it("updates colours from the native colour picker and restores template colours", async () => {
    const { user } = setup();
    const picker = screen.getByLabelText("Accent colour", {
      selector: 'input[type="color"]',
    });
    // user-event can't drive native colour pickers; dispatch a change.
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(picker, "#00ff00");
      picker.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(previewPage().style.getPropertyValue("--room-accent")).toBe("#00FF00");
    expect(
      screen.getByRole("textbox", { name: /accent colour hex/i }),
    ).toHaveValue("#00FF00");

    await user.click(screen.getByRole("button", { name: /restore template colours/i }));
    expect(previewPage().style.getPropertyValue("--room-accent")).toBe(
      defaults.theme.accentColor,
    );
  });

  it("changes the background pattern", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: /checkerboard/i }));
    expect(previewPage()).toHaveAttribute("data-pattern", "checkerboard");
  });

  it("hides widgets without deleting their content", async () => {
    const { user } = setup();
    const toggle = screen.getByRole("switch", { name: /show art gallery/i });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(
      within(preview()).queryByRole("heading", { name: "Art Gallery" }),
    ).not.toBeInTheDocument();
    // The artwork is still editable.
    expect(within(section(/gallery/i)).getByLabelText(/^title/i)).toHaveValue(
      defaults.artwork[0].title,
    );

    await user.click(toggle);
    expect(
      within(preview()).getByRole("img", { name: defaults.artwork[0].alt }),
    ).toBeInTheDocument();
  });

  it("adds, edits, reorders and removes artwork", async () => {
    const { user } = setup();
    const gallery = section(/gallery/i);

    await user.click(within(gallery).getByRole("button", { name: /add artwork/i }));
    const titles = within(gallery).getAllByLabelText(/^title/i);
    expect(titles).toHaveLength(2);
    // Focus moves to the new entry.
    expect(titles[1]).toHaveFocus();

    await user.type(titles[1], "Neon Night");
    await user.type(
      within(gallery).getAllByLabelText(/image url/i)[1],
      "https://example.com/neon.png",
    );
    await user.type(
      within(gallery).getAllByLabelText(/alternative text/i)[1],
      "A neon city at night",
    );

    const captions = () =>
      within(preview())
        .getAllByRole("listitem")
        .map((li) => li.textContent)
        .filter((t) => t === "Digital Dreams" || t === "Neon Night");
    expect(captions()).toEqual(["Digital Dreams", "Neon Night"]);

    const moveUp = within(gallery).getByRole("button", {
      name: /move up: neon night/i,
    });
    await user.click(moveUp);
    expect(captions()).toEqual(["Neon Night", "Digital Dreams"]);
    expect(
      within(gallery).getByRole("button", { name: /move up: neon night, item 1 of 2/i }),
    ).toBeDisabled();

    await user.click(
      within(gallery).getByRole("button", { name: /move down: neon night/i }),
    );
    expect(captions()).toEqual(["Digital Dreams", "Neon Night"]);

    await user.click(
      within(gallery).getByRole("button", { name: /remove: digital dreams/i }),
    );
    expect(captions()).toEqual(["Neon Night"]);
    expect(within(gallery).getAllByLabelText(/^title/i)).toHaveLength(1);
  });

  it("limits the gallery to 12 entries", async () => {
    const { user } = setup();
    const gallery = section(/gallery/i);
    for (let i = 0; i < 11; i++) {
      await user.click(within(gallery).getByRole("button", { name: /add artwork/i }));
    }
    expect(within(gallery).getAllByLabelText(/^title/i)).toHaveLength(12);
    expect(
      within(gallery).getByRole("button", { name: /gallery is full/i }),
    ).toBeDisabled();
  });

  it("adds, edits, reorders and removes links", async () => {
    const { user } = setup();
    const links = section(/^links/i);

    await user.click(within(links).getByRole("button", { name: /add link/i }));
    await user.type(within(links).getAllByLabelText(/^label/i)[1], "My Zine");
    await user.type(
      within(links).getAllByLabelText(/^url/i)[1],
      "https://zine.example.com",
    );

    const linkNames = () =>
      within(preview())
        .getAllByRole("link")
        .map((a) => a.textContent);
    expect(linkNames()).toEqual(["Internet Archive", "My Zine"]);
    expect(within(preview()).getByRole("link", { name: "My Zine" })).toHaveAttribute(
      "href",
      "https://zine.example.com",
    );

    await user.click(within(links).getByRole("button", { name: /move up: my zine/i }));
    expect(linkNames()).toEqual(["My Zine", "Internet Archive"]);

    await user.click(
      within(links).getByRole("button", { name: /remove: internet archive/i }),
    );
    expect(linkNames()).toEqual(["My Zine"]);
  });

  it("edits music information", async () => {
    const { user } = setup();
    const music = section(/^music/i);
    const title = within(music).getByLabelText(/track title/i);
    await user.clear(title);
    await user.type(title, "Midnight Modem");
    expect(within(preview()).getByText("Midnight Modem")).toBeInTheDocument();

    await user.click(
      within(music).getByRole("button", { name: /remove track details/i }),
    );
    expect(within(preview()).getByText(/nothing queued right now/i)).toBeInTheDocument();
    await user.click(within(music).getByRole("button", { name: /add track details/i }));
    expect(within(music).getByLabelText(/track title/i)).toHaveValue("");
  });

  it("rejects unsafe link URLs", async () => {
    const { user } = setup();
    const links = section(/^links/i);
    const url = within(links).getByLabelText(/^url/i);
    await user.clear(url);
    await user.type(url, "javascript:alert(1)");
    await user.tab();

    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(url).toHaveAccessibleDescription(/must start with https:\/\//i);
    // The preview never renders it as a clickable link.
    expect(
      within(preview()).queryByRole("link", { name: "Internet Archive" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/not saved yet/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects data: and non-https image URLs", async () => {
    const { user } = setup();
    const gallery = section(/gallery/i);
    const url = within(gallery).getByLabelText(/image url/i);
    await user.clear(url);
    await user.type(url, "data:image/png;base64,AAAA");
    await user.tab();
    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(
      within(preview()).getByRole("img", { name: /image unavailable/i }),
    ).toBeInTheDocument();
  });

  it("shows required errors only after a save attempt", async () => {
    const { user } = setup();
    const links = section(/^links/i);
    await user.click(within(links).getByRole("button", { name: /add link/i }));
    expect(within(links).queryByText(/link label is required/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(within(links).getByText(/link label is required/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/2 fields need attention/i);
  });

  it("saves a valid draft to localStorage", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "saved room");
    await user.click(screen.getByRole("radio", { name: /retro grid/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(storedRoom().title).toBe("saved room");
    expect(storedRoom().theme.backgroundPattern).toBe("grid");
    expect(screen.getByText(/room saved/i)).toBeInTheDocument();
    expect(screen.getByTestId("save-state")).toHaveTextContent("All changes saved");
  });

  it("restores the saved configuration on refresh", async () => {
    const { user, unmount } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "come back later");
    await user.click(screen.getByRole("button", { name: "Save" }));
    unmount();

    render(<App />);
    expect(screen.getByLabelText(/room title/i)).toHaveValue("come back later");
    expect(screen.getByTestId("save-state")).toHaveTextContent("All changes saved");
  });

  it("loads a saved Milestone 1 room without a background pattern", () => {
    const legacy = getDefaultRoom();
    delete legacy.theme.backgroundPattern;
    legacy.title = "legacy room";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    setup();
    expect(screen.getByLabelText(/room title/i)).toHaveValue("legacy room");
    expect(screen.getByRole("radio", { name: /pixel stars/i })).toBeChecked();
    expect(screen.getByTestId("save-state")).toHaveTextContent("All changes saved");
  });

  it("falls back safely when saved data is corrupted", async () => {
    localStorage.setItem(STORAGE_KEY, "{definitely not json");
    const { user } = setup();

    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /saved room couldn't be loaded/i,
    );
    // The bad data is preserved until the user chooses to overwrite it.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{definitely not json");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(storedRoom().title).toBe(defaults.title);
  });

  it("falls back when saved data contains unsafe values", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...defaults,
        links: [{ id: "x", label: "evil", url: "javascript:alert(1)" }],
      }),
    );
    setup();
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't be loaded/i);
    expect(within(preview()).queryByText("evil")).not.toBeInTheDocument();
  });

  it("does not report success when saving fails", async () => {
    const { user } = setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const title = screen.getByLabelText(/room title/i);
    await user.type(title, "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save your room/i);
    expect(screen.queryByText(/room saved/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("save-state")).toHaveTextContent("Unsaved changes");
  });

  it("resets to the bundled defaults after confirmation", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "temporary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/room title/i)).toHaveValue("temporary");

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(
      within(preview()).getByRole("heading", { level: 1, name: defaults.title }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("save-state")).toHaveTextContent("All changes saved");
  });

  it("preview mode hides editor controls and can return to editing", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "preview me");

    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "preview me" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

    const back = screen.getByRole("button", { name: /back to editing/i });
    expect(back).toHaveFocus();
    await user.click(back);

    expect(screen.getByLabelText(/room title/i)).toHaveValue("preview me");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveFocus();
  });

  it("leaves preview mode with Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("warns before leaving with unsaved changes", async () => {
    const { user } = setup();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText(/room title/i), "!");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
