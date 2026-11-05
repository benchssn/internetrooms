import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { getDefaultRoom } from "../data/defaultRoom";
import { listAssets, putAsset } from "../storage/assetStore";
import { imageProcessor } from "../storage/imageUpload";
import { BACKUP_KEY, STORAGE_KEY } from "../storage/roomStorage";
import { fakeImageFile, legacyRoomV1, widgetOf } from "../test/rooms";
import type { RoomConfig } from "../types/room";

const defaults = getDefaultRoom();

function setup() {
  // The editor lives at /edit since Milestone 3.
  window.history.replaceState(null, "", "/edit");
  const user = userEvent.setup();
  const utils = render(<App />);
  return { user, ...utils };
}

const preview = () => screen.getByRole("region", { name: /live preview/i });
const controls = () => screen.getByRole("region", { name: /customise your room/i });
const section = (name: RegExp) => within(controls()).getByRole("region", { name });
const layout = () => section(/layout & widgets/i);
const previewPage = () => within(preview()).getByTestId("room-page");
const storedRoom = (): RoomConfig => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
const saveState = () => screen.getByTestId("save-state");

/** Opens a widget's content editor from the layout list and returns it. */
async function openWidget(user: ReturnType<typeof userEvent.setup>, name: string) {
  const button = within(layout()).queryByRole("button", { name: `Edit ${name}` });
  if (button) await user.click(button);
  return within(layout()).getByRole("group", { name: `${name} content` });
}

/** Widget types in the order the live preview shows them. */
function previewOrder() {
  return Array.from(preview().querySelectorAll("[data-widget-type]")).map((el) =>
    el.getAttribute("data-widget-type"),
  );
}

/** Rows of the layout list, in order. */
function layoutRows() {
  return Array.from(layout().querySelectorAll("ol > li")) as HTMLElement[];
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("Room editor — basics", () => {
  it("loads the bundled default room", () => {
    setup();
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(
      within(preview()).getByRole("heading", { level: 1, name: defaults.title }),
    ).toBeInTheDocument();
    expect(saveState()).toHaveTextContent("All changes saved");
    expect(previewOrder()).toEqual(["about", "music", "gallery", "links"]);
  });

  it("updates the preview as the title is edited and marks it unsaved", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "starlight lounge");

    expect(
      within(preview()).getByRole("heading", { level: 1, name: "starlight lounge" }),
    ).toBeInTheDocument();
    expect(saveState()).toHaveTextContent("Unsaved changes");
    expect(title).toHaveAccessibleDescription("16 / 80 characters");
  });

  it("edits About Me inside its widget", async () => {
    const { user } = setup();
    const about = await openWidget(user, "About Me");
    const name = within(about).getByLabelText(/display name/i);
    await user.clear(name);
    await user.type(name, "pixel pal");
    const bio = within(about).getByLabelText(/biography/i);
    await user.clear(bio);
    await user.type(bio, "hello from the web");

    expect(within(preview()).getByText("pixel pal")).toBeInTheDocument();
    expect(within(preview()).getByText("hello from the web")).toBeInTheDocument();
  });

  it("applies valid hex colours and ignores invalid ones", async () => {
    const { user } = setup();
    const hex = screen.getByRole("textbox", { name: /background colour hex/i });
    await user.clear(hex);
    await user.type(hex, "#ff00aa");
    expect(previewPage().style.getPropertyValue("--room-bg")).toBe("#FF00AA");

    await user.clear(hex);
    await user.type(hex, "nope");
    expect(hex).toHaveAttribute("aria-invalid", "true");
    expect(previewPage().style.getPropertyValue("--room-bg")).toBe("#FF00AA");
  });

  it("restores the template's colours", async () => {
    const { user } = setup();
    const hex = screen.getByRole("textbox", { name: /accent colour hex/i });
    await user.clear(hex);
    await user.type(hex, "#00ff00");
    expect(previewPage().style.getPropertyValue("--room-accent")).toBe("#00FF00");
    await user.click(screen.getByRole("button", { name: /restore classic web colours/i }));
    expect(previewPage().style.getPropertyValue("--room-accent")).toBe(defaults.theme.accentColor);
  });
});

describe("Room editor — layout", () => {
  it("hides widgets without deleting their content", async () => {
    const { user } = setup();
    const toggle = screen.getByRole("switch", { name: /show art gallery/i });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(within(preview()).queryByRole("heading", { name: "Art Gallery" })).not.toBeInTheDocument();

    const gallery = await openWidget(user, "Art Gallery");
    expect(within(gallery).getByLabelText(/^title/i)).toHaveValue(
      widgetOf(defaults, "gallery").content.artwork[0].title,
    );

    await user.click(toggle);
    expect(within(preview()).getByRole("heading", { name: "Art Gallery" })).toBeInTheDocument();
  });

  it("reorders widgets with Move Up / Move Down, keeping focus on the control", async () => {
    const { user } = setup();
    const up = within(layout()).getByRole("button", { name: "Move up: Art Gallery" });
    await user.click(up);
    expect(previewOrder()).toEqual(["about", "gallery", "music", "links"]);
    expect(within(layout()).getByRole("button", { name: "Move up: Art Gallery" })).toHaveFocus();

    await user.click(within(layout()).getByRole("button", { name: "Move down: About Me" }));
    expect(previewOrder()).toEqual(["gallery", "about", "music", "links"]);
    expect(within(layout()).getByRole("button", { name: "Move up: Art Gallery" })).toBeDisabled();
  });

  it("reorders widgets with the arrow keys on the drag handle", async () => {
    const { user } = setup();
    const handle = within(layout()).getByRole("button", { name: /reorder favourite links/i });
    handle.focus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(previewOrder()).toEqual(["about", "links", "music", "gallery"]);
    expect(within(layout()).getByRole("button", { name: /reorder favourite links/i })).toHaveFocus();
  });

  it("reorders widgets by dragging the handle", () => {
    setup();
    layoutRows().forEach((row, i) => {
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        top: i * 100,
        bottom: i * 100 + 90,
        height: 90,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: i * 100,
        toJSON: () => ({}),
      });
    });
    const handle = within(layout()).getByRole("button", { name: /reorder about me/i });
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 10, pointerType: "mouse" });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250, pointerType: "mouse" });
    expect(layoutRows()[2]).toHaveAttribute("data-drop", "after");
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 250, pointerType: "mouse" });
    expect(previewOrder()).toEqual(["music", "gallery", "about", "links"]);
  });

  it("changes widget widths in the layout", async () => {
    const { user } = setup();
    const widthGroup = within(layout()).getByRole("group", { name: "Width of Art Gallery" });
    await user.click(within(widthGroup).getByRole("radio", { name: "Half" }));
    expect(preview().querySelector('[data-widget-type="gallery"]')).toHaveAttribute("data-width", "half");
    await user.click(within(widthGroup).getByRole("radio", { name: "Full" }));
    expect(preview().querySelector('[data-widget-type="gallery"]')).toHaveAttribute("data-width", "full");
  });

  it("adds, duplicates and deletes new widgets", async () => {
    const { user } = setup();
    await user.click(within(layout()).getByRole("button", { name: /^text block$/i }));
    const editor = within(layout()).getByRole("group", { name: "Text block content" });
    const heading = within(editor).getByLabelText(/^heading/i);
    expect(heading).toHaveFocus();
    await user.type(heading, "Diary");
    await user.type(within(layout()).getByRole("textbox", { name: /^text/i }), "Today was good.");

    expect(within(preview()).getByRole("region", { name: "Diary" })).toHaveTextContent("Today was good.");

    await user.click(within(layout()).getByRole("button", { name: "Duplicate: Diary" }));
    expect(within(preview()).getAllByRole("region", { name: "Diary" })).toHaveLength(2);
    expect(previewOrder()).toEqual(["about", "music", "gallery", "links", "text", "text"]);

    await user.click(within(layout()).getAllByRole("button", { name: "Delete: Diary" })[0]);
    expect(within(preview()).getAllByRole("region", { name: "Diary" })).toHaveLength(1);
    // The original widgets can't be duplicated or deleted, only hidden.
    expect(within(layout()).queryByRole("button", { name: "Delete: About Me" })).not.toBeInTheDocument();
  });

  it("restores a deleted widget from the undo notice", async () => {
    const { user } = setup();
    await user.click(within(layout()).getByRole("button", { name: /^link collection$/i }));
    await user.type(within(layout()).getByLabelText(/^heading/i), "Zines");
    await user.click(within(layout()).getByRole("button", { name: "Delete: Zines" }));
    expect(within(preview()).queryByRole("region", { name: "Zines" })).not.toBeInTheDocument();

    const notice = screen.getByText(/deleted zines/i).closest("div")!;
    await user.click(within(notice).getByRole("button", { name: "Undo" }));
    expect(within(preview()).getByRole("region", { name: "Zines" })).toBeInTheDocument();
  });

  it("adds an image block from a web link", async () => {
    const { user } = setup();
    await user.click(within(layout()).getByRole("button", { name: /^image block$/i }));
    const editor = within(layout()).getByRole("group", { name: "Image block content" });
    await user.type(within(editor).getByLabelText(/image url/i), "https://example.com/cat.png");
    await user.type(within(editor).getByLabelText(/alternative text/i), "a sleepy cat");
    await user.type(within(editor).getByLabelText(/caption/i), "Mochi");
    const region = within(preview()).getByRole("region", { name: "Mochi" });
    expect(within(region).getByRole("img", { name: "a sleepy cat" })).toHaveAttribute(
      "src",
      "https://example.com/cat.png",
    );
  });

  it("resets widget positions and widths but keeps content", async () => {
    const { user } = setup();
    await user.click(within(layout()).getByRole("button", { name: "Move down: About Me" }));
    await user.click(
      within(within(layout()).getByRole("group", { name: "Width of Art Gallery" })).getByRole("radio", {
        name: "Half",
      }),
    );
    await user.click(within(layout()).getByRole("button", { name: /reset widget positions/i }));
    expect(previewOrder()).toEqual(["about", "music", "gallery", "links"]);
    expect(preview().querySelector('[data-widget-type="gallery"]')).toHaveAttribute("data-width", "full");
  });
});

describe("Room editor — content widgets", () => {
  it("adds, edits, reorders and removes artwork", async () => {
    const { user } = setup();
    const gallery = await openWidget(user, "Art Gallery");

    await user.click(within(gallery).getByRole("button", { name: /add artwork/i }));
    const titles = within(gallery).getAllByLabelText(/^title/i);
    expect(titles[1]).toHaveFocus();
    await user.type(titles[1], "Neon Night");
    await user.type(within(gallery).getAllByLabelText(/image url/i)[1], "https://example.com/neon.png");
    await user.type(within(gallery).getAllByLabelText(/alternative text/i)[1], "A neon city");

    const captions = () =>
      Array.from(preview().querySelectorAll("figcaption")).map((f) => f.textContent);
    expect(captions()).toEqual(["Digital Dreams", "Neon Night"]);

    await user.click(within(gallery).getByRole("button", { name: /move up: neon night/i }));
    expect(captions()).toEqual(["Neon Night", "Digital Dreams"]);

    await user.click(within(gallery).getByRole("button", { name: /remove: digital dreams/i }));
    expect(captions()).toEqual(["Neon Night"]);
  });

  it("adds, edits, reorders and removes links", async () => {
    const { user } = setup();
    const links = await openWidget(user, "Favourite Links");
    await user.click(within(links).getByRole("button", { name: /add link/i }));
    await user.type(within(links).getAllByLabelText(/^label/i)[1], "My Zine");
    await user.type(within(links).getAllByLabelText(/^url/i)[1], "https://zine.example.com");

    const names = () => within(preview()).getAllByRole("link").map((a) => a.textContent);
    expect(names()).toEqual(["Internet Archive", "My Zine"]);
    await user.click(within(links).getByRole("button", { name: /move up: my zine/i }));
    expect(names()).toEqual(["My Zine", "Internet Archive"]);
    await user.click(within(links).getByRole("button", { name: /remove: internet archive/i }));
    expect(names()).toEqual(["My Zine"]);
  });

  it("edits music information", async () => {
    const { user } = setup();
    const music = await openWidget(user, "Music");
    const title = within(music).getByLabelText(/track title/i);
    await user.clear(title);
    await user.type(title, "Midnight Modem");
    expect(within(preview()).getByText("Midnight Modem")).toBeInTheDocument();
    await user.click(within(music).getByRole("button", { name: /remove track details/i }));
    expect(within(preview()).getByText(/nothing queued right now/i)).toBeInTheDocument();
  });

  it("rejects unsafe link URLs", async () => {
    const { user } = setup();
    const links = await openWidget(user, "Favourite Links");
    const url = within(links).getByLabelText(/^url/i);
    await user.clear(url);
    await user.type(url, "javascript:alert(1)");
    await user.tab();

    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(url).toHaveAccessibleDescription(/must start with https:\/\//i);
    expect(within(preview()).queryByRole("link", { name: "Internet Archive" })).not.toBeInTheDocument();

    await save(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/not saved yet/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects data: image URLs", async () => {
    const { user } = setup();
    const gallery = await openWidget(user, "Art Gallery");
    const url = within(gallery).getByLabelText(/image url/i);
    await user.clear(url);
    await user.type(url, "data:image/png;base64,AAAA");
    await user.tab();
    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(within(preview()).getByRole("img", { name: /image unavailable/i })).toBeInTheDocument();
  });

  it("opens widgets with problems after a failed save", async () => {
    const { user } = setup();
    await user.click(within(layout()).getByRole("button", { name: /^text block$/i }));
    await user.click(within(layout()).getByRole("button", { name: "Close Text block" }));
    expect(within(layout()).queryByText(/text is required/i)).not.toBeInTheDocument();

    await save(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/1 field needs attention/i);
    expect(within(layout()).getByText(/text is required/i)).toBeInTheDocument();
    expect(within(layout()).getByText(/needs attention/i)).toBeInTheDocument();
  });

  it("uploads an image, uses it, and rejects invalid files", async () => {
    const { user } = setup();

    await user.click(within(layout()).getByRole("button", { name: /^image block$/i }));
    const editor = within(layout()).getByRole("group", { name: "Image block content" });
    await user.click(within(editor).getByRole("radio", { name: /upload/i }));

    const fileInput = editor.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute("accept", "image/png,image/jpeg,image/gif,image/webp");

    const svg = new File(['<svg onload="alert(1)"/>'], "evil.svg", { type: "image/svg+xml" });
    // Someone can still pick "All files" in the OS dialog, bypassing accept.
    fireEvent.change(fileInput, { target: { files: [svg] } });
    expect(await within(editor).findByRole("alert")).toHaveTextContent(/SVG/);
    expect(await listAssets()).toHaveLength(0);
  });
});

describe("Room editor — style", () => {
  it("changes typography in the preview", async () => {
    const { user } = setup();
    const typography = section(/typography/i);
    await user.selectOptions(within(typography).getByLabelText("Heading font"), "serif");
    await user.click(within(typography).getByRole("radio", { name: /huge/i }));
    await user.click(within(typography).getByRole("radio", { name: /centred/i }));
    const page = previewPage();
    expect(page.style.getPropertyValue("--room-font-heading")).toMatch(/Georgia/);
    expect(page.style.getPropertyValue("--room-heading-scale")).toBe("1.55");
    expect(page.style.getPropertyValue("--room-align")).toBe("center");
  });

  it("switches to a gradient background and back", async () => {
    const { user } = setup();
    const background = section(/^▦?\s*background$/i);
    await user.click(within(background).getByRole("radio", { name: /gradient/i }));
    await user.click(within(background).getByRole("button", { name: /ocean/i }));
    expect(previewPage()).toHaveAttribute("data-background", "gradient");
    expect(previewPage().style.getPropertyValue("--room-bg-layer")).toMatch(/#0B3D5C/);

    await user.click(within(background).getByRole("radio", { name: /colour & pattern/i }));
    await user.click(within(background).getByRole("radio", { name: /checkerboard/i }));
    expect(previewPage()).toHaveAttribute("data-background", "pattern");
    expect(previewPage()).toHaveAttribute("data-pattern", "checkerboard");
  });

  it("uses a previously uploaded image as the background", async () => {
    await putAsset({
      id: "asset-bg1",
      blob: new Blob([new Uint8Array([1])], { type: "image/webp" }),
      type: "image/webp",
      width: 800,
      height: 600,
      size: 1,
      createdAt: new Date().toISOString(),
    });
    const { user } = setup();
    const background = section(/^▦?\s*background$/i);
    await user.click(within(background).getByRole("radio", { name: /^image$/i }));
    await user.click(within(background).getByRole("radio", { name: /upload/i }));
    await user.click(await within(background).findByRole("button", { name: /use uploaded image 1/i }));
    await waitFor(() => expect(previewPage()).toHaveAttribute("data-background", "image"));

    await save(user);
    expect(storedRoom().theme.background.image.source).toEqual({ kind: "asset", assetId: "asset-bg1" });
  });

  it("adds, moves and removes decorations", async () => {
    const { user } = setup();
    const decorations = section(/decorations/i);
    await user.selectOptions(within(decorations).getByLabelText("New decoration"), "heart");
    await user.selectOptions(within(decorations).getByLabelText("Where"), "footer");
    await user.click(within(decorations).getByRole("button", { name: /add decoration/i }));
    expect(preview().querySelector('[data-slot="footer"] [data-kind="heart"]')).not.toBeNull();

    await user.selectOptions(within(decorations).getAllByLabelText(/position of pixel heart/i)[0], "below-header");
    expect(preview().querySelector('[data-slot="below-header"] [data-kind="heart"]')).not.toBeNull();

    await user.click(within(decorations).getByRole("button", { name: /remove: pixel heart/i }));
    expect(preview().querySelector('[data-kind="heart"]')).toBeNull();
  });
});

describe("Room editor — undo, redo and preview", () => {
  it("undoes and redoes changes, grouping typing into one step", async () => {
    const { user } = setup();
    const undo = screen.getByRole("button", { name: /undo/i });
    const redo = screen.getByRole("button", { name: /redo/i });
    expect(undo).toBeDisabled();

    await user.type(screen.getByLabelText(/room title/i), " forever");
    await user.click(screen.getByRole("switch", { name: /show music/i }));

    await user.click(undo);
    expect(screen.getByRole("switch", { name: /show music/i })).toBeChecked();
    expect(screen.getByLabelText(/room title/i)).toHaveValue(`${defaults.title} forever`);

    await user.click(undo);
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(saveState()).toHaveTextContent("All changes saved");

    await user.click(redo);
    expect(screen.getByLabelText(/room title/i)).toHaveValue(`${defaults.title} forever`);
  });

  it("supports Ctrl+Z / Ctrl+Shift+Z outside text fields", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("switch", { name: /show music/i }));
    expect(within(preview()).queryByRole("heading", { name: "Music" })).not.toBeInTheDocument();

    screen.getByRole("button", { name: "Preview" }).focus();
    await user.keyboard("{Control>}z{/Control}");
    expect(within(preview()).getByRole("heading", { name: "Music" })).toBeInTheDocument();
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(within(preview()).queryByRole("heading", { name: "Music" })).not.toBeInTheDocument();
  });

  it("keeps at most 30 undo steps", async () => {
    const { user } = setup();
    const toggle = screen.getByRole("switch", { name: /show music/i });
    for (let i = 0; i < 35; i++) await user.click(toggle);
    const undo = screen.getByRole("button", { name: /undo/i });
    for (let i = 0; i < 30; i++) await user.click(undo);
    expect(undo).toBeDisabled();
  });

  it("toggles between desktop and mobile preview", async () => {
    const { user } = setup();
    const mobile = screen.getByRole("button", { name: /mobile/i });
    await user.click(mobile);
    expect(mobile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("preview-viewport").parentElement).toHaveAttribute("data-device", "mobile");
    await user.click(screen.getByRole("button", { name: /desktop/i }));
    expect(screen.getByTestId("preview-viewport").parentElement).toHaveAttribute("data-device", "desktop");
  });

  it("preview mode hides editor controls and can return to editing", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const back = screen.getByRole("button", { name: /back to editing/i });
    expect(back).toHaveFocus();
    await user.click(back);
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

describe("Room editor — saving and loading", () => {
  it("saves widget order, widths and settings, and restores them on reload", async () => {
    const { user, unmount } = setup();
    await user.click(within(layout()).getByRole("button", { name: "Move up: Art Gallery" }));
    await user.click(
      within(within(layout()).getByRole("group", { name: "Width of Art Gallery" })).getByRole("radio", {
        name: "Half",
      }),
    );
    await user.click(within(layout()).getByRole("button", { name: /^text block$/i }));
    await user.type(within(layout()).getByRole("textbox", { name: /^text/i }), "hello");
    await user.selectOptions(within(section(/typography/i)).getByLabelText("Body font"), "typewriter");
    await save(user);

    expect(screen.getByText(/room saved/i)).toBeInTheDocument();
    expect(saveState()).toHaveTextContent("All changes saved");
    const stored = storedRoom();
    expect(stored.schemaVersion).toBe(2);
    expect(stored.layout.widgets.map((w) => w.type)).toEqual(["about", "gallery", "music", "links", "text"]);
    expect(widgetOf(stored, "gallery").width).toBe("half");
    expect(stored.theme.typography.bodyFont).toBe("typewriter");

    unmount();
    setup();
    expect(previewOrder()).toEqual(["about", "gallery", "music", "links", "text"]);
    expect(saveState()).toHaveTextContent("All changes saved");
    expect(within(preview()).getByText("hello")).toBeInTheDocument();
  });

  it("migrates a saved Milestone 1–3 room without losing content", () => {
    const v1 = legacyRoomV1();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    setup();

    expect(screen.getByText(/upgraded to the new room format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/room title/i)).toHaveValue("my old room");
    expect(within(preview()).getByText("old friend")).toBeInTheDocument();
    expect(within(preview()).getByText("Old Song")).toBeInTheDocument();
    expect(within(preview()).getByRole("link", { name: "Second" })).toBeInTheDocument();
    // Gallery was hidden in v1, so it stays hidden — but its content is kept.
    expect(within(preview()).queryByRole("region", { name: "Art Gallery" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /show art gallery/i })).not.toBeChecked();
    expect(saveState()).toHaveTextContent("All changes saved");
    expect(localStorage.getItem(BACKUP_KEY)).toContain("my old room");
  });

  it("falls back safely when saved data is corrupted, offering a download", async () => {
    localStorage.setItem(STORAGE_KEY, "{definitely not json");
    const { user } = setup();
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/saved room couldn't be loaded/i);
    expect(within(alert).getByRole("button", { name: /download saved data/i })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{definitely not json");

    await save(user);
    expect(storedRoom().title).toBe(defaults.title);
    expect(localStorage.getItem(BACKUP_KEY)).toContain("definitely not json");
  });

  it("does not report success when saving fails", async () => {
    const { user } = setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await user.type(screen.getByLabelText(/room title/i), "!");
    await save(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save your room/i);
    expect(screen.queryByText(/room saved/i)).not.toBeInTheDocument();
    expect(saveState()).toHaveTextContent("Unsaved changes");
  });

  it("resets to the bundled defaults after confirmation", async () => {
    const { user } = setup();
    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "temporary");
    await save(user);

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/room title/i)).toHaveValue("temporary");

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText(/room title/i)).toHaveValue(defaults.title);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(saveState()).toHaveTextContent("All changes saved");
  });

  it("keeps uploaded images when their widget is hidden", async () => {
    await putAsset({
      id: "asset-keep",
      blob: new Blob([new Uint8Array([1])]),
      type: "image/webp",
      width: 1,
      height: 1,
      size: 1,
      createdAt: new Date().toISOString(),
    });
    const { user } = setup();
    await user.click(screen.getByRole("switch", { name: /show art gallery/i }));
    await act(async () => {});
    expect((await listAssets()).map((a) => a.id)).toEqual(["asset-keep"]);
  });

  it("uploads an image through the full pipeline", async () => {
    const { user } = setup();
    // jsdom can't decode images; stand in for the browser's decoder.
    vi.spyOn(imageProcessor, "process").mockResolvedValue({
      blob: new Blob([new Uint8Array([1])], { type: "image/webp" }),
      width: 32,
      height: 32,
    });
    await user.click(within(layout()).getByRole("button", { name: /^image block$/i }));
    const editor = within(layout()).getByRole("group", { name: "Image block content" });
    await user.click(within(editor).getByRole("radio", { name: /upload/i }));
    await user.upload(editor.querySelector('input[type="file"]') as HTMLInputElement, fakeImageFile());
    await waitFor(async () => expect(await listAssets()).toHaveLength(1));
    expect(await within(editor).findByRole("button", { name: /use uploaded image 1/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
