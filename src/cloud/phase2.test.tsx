import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import profilesMigration from "../../supabase/migrations/20261105170000_profiles.sql?raw";
import App from "../App";
import { resetAuthExchangesForTests } from "../auth/callbackExchanges";
import { getDefaultRoom } from "../data/defaultRoom";
import { STORAGE_KEY } from "../storage/roomStorage";
import { createFakeAuth, type FakeAuth } from "../test/fakeAuth";
import { createFakeCloud, type FakeCloud } from "../test/fakeCloud";
import { roomWith, widgetOf } from "../test/rooms";
import type { RoomConfig } from "../types/room";
import {
  mapImageSources,
  publishDraft,
  publishStatus,
  readPublishState,
  roomFingerprint,
  writePublishState,
} from "./publishing";
import { RESERVED_USERNAMES, validateUsername } from "./usernames";

const fakes = vi.hoisted(() => ({
  auth: null as null | { auth: unknown },
  cloud: null as null | { api: unknown },
}));

vi.mock("../auth/authClient", () => ({
  loadAuthClient: async () => fakes.auth?.auth ?? null,
  authRedirectUrl: () => "https://internetrooms.net/auth/callback",
}));

vi.mock("./cloudClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cloudClient")>()),
  loadCloudApi: async () => fakes.cloud?.api ?? null,
}));

const ALICE = "alice@example.com";
const ALICE_ID = `user-${ALICE}`;

let auth: FakeAuth;
let cloud: FakeCloud;

function setup(options: { signedInAs?: string; username?: string; displayName?: string } = {}) {
  auth = createFakeAuth({ sessionEmail: options.signedInAs });
  cloud = createFakeCloud();
  fakes.auth = auth;
  fakes.cloud = cloud;
  if (options.signedInAs) cloud.state.viewerId = `user-${options.signedInAs}`;
  if (options.signedInAs && options.username) {
    cloud.profiles.set(`user-${options.signedInAs}`, {
      id: `user-${options.signedInAs}`,
      username: options.username,
      displayName: options.displayName ?? null,
      bio: null,
      avatarPath: null,
    });
  }
}

function renderAt(path: string) {
  window.history.replaceState(null, "", path);
  return { user: userEvent.setup(), ...render(<App />) };
}

/** Publishes a room for alice directly in the fake backend. */
async function seedPublishedRoom(room: RoomConfig, visibility: "public" | "unlisted" | "private" = "public") {
  await cloud.api.ensureOwnRoom(ALICE_ID);
  return cloud.api.saveOwnRoom(ALICE_ID, { configuration: room, visibility, published: true });
}

const publishState = () => screen.getByTestId("publish-state");
const publishSection = () => screen.getByRole("region", { name: /publish/i });

beforeEach(() => {
  resetAuthExchangesForTests();
  sessionStorage.clear();
  setup();
});

/* ------------------------------------------------------------------ */

describe("usernames", () => {
  it("validates format, length and reserved names", () => {
    expect(validateUsername("")).toMatch(/choose a username/i);
    expect(validateUsername("ab")).toMatch(/at least 3/i);
    expect(validateUsername("a".repeat(25))).toMatch(/24 characters or fewer/i);
    expect(validateUsername("bob smith")).toMatch(/spaces/i);
    expect(validateUsername("bob.smith")).toMatch(/only letters/i);
    expect(validateUsername("admin")).toMatch(/reserved/i);
    expect(validateUsername("Settings")).toMatch(/reserved/i);
    expect(validateUsername("  Pixel_Pal-99 ")).toBeUndefined();
  });

  it("uses exactly the same reserved names as the database", () => {
    const block = profilesMigration.match(/array\[([\s\S]*?)\]/)?.[1] ?? "";
    const fromSql = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(fromSql.length).toBeGreaterThan(20);
    expect([...RESERVED_USERNAMES].sort()).toEqual(fromSql);
  });
});

describe("first-login profile setup", () => {
  it("sends people without a username to setup after logging in", async () => {
    setup();
    cloud.state.viewerId = ALICE_ID;
    const { user } = renderAt("/login?next=/edit");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), ALICE);
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "choose your username" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings");

    await user.type(screen.getByLabelText("Username"), "Alice_99");
    expect(screen.getByLabelText("Username")).toHaveValue("alice_99");
    expect(screen.getByText("https://internetrooms.net/u/alice_99")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Display name"), "Alice");
    await user.click(screen.getByRole("button", { name: "Create profile" }));

    expect(await screen.findByText(/welcome, @alice_99/i)).toBeInTheDocument();
    expect(cloud.profiles.get(ALICE_ID)).toMatchObject({ username: "alice_99", displayName: "Alice" });
    expect(within(screen.getByRole("group", { name: "Account" })).getByRole("link", { name: /@alice_99/ })).toBeInTheDocument();
  });

  it("goes straight to the requested page when a profile exists", async () => {
    setup();
    cloud.profiles.set(ALICE_ID, { id: ALICE_ID, username: "alice", displayName: null, bio: null, avatarPath: null });
    const { user } = renderAt("/login?next=/templates");
    await screen.findByRole("group", { name: "Account" });
    await user.type(screen.getByLabelText("Email address"), ALICE);
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(window.location.pathname).toBe("/templates"));
  });

  it("shows a 'Choose a username' link in the navigation until set", async () => {
    setup({ signedInAs: ALICE });
    renderAt("/");
    const nav = await screen.findByRole("group", { name: "Account" });
    expect(await within(nav).findByRole("link", { name: "Choose a username" })).toHaveAttribute("href", "/settings");
  });

  it("rejects taken and invalid usernames with a field error", async () => {
    setup({ signedInAs: ALICE });
    cloud.profiles.set("someone-else", { id: "someone-else", username: "taken", displayName: null, bio: null, avatarPath: null });
    const { user } = renderAt("/settings");
    const field = await screen.findByLabelText("Username");

    await user.type(field, "admin");
    await user.click(screen.getByRole("button", { name: "Create profile" }));
    expect(field).toHaveAccessibleDescription(/reserved/i);
    expect(cloud.api.createProfile).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, "taken");
    await user.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});

describe("profile editing", () => {
  it("edits display name and bio", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    const { user } = renderAt("/settings");
    const name = await screen.findByLabelText("Display name");
    await user.type(name, "Alice in Rooms");
    await user.type(screen.getByLabelText("Bio"), "I collect tiny websites.");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(cloud.profiles.get(ALICE_ID)).toMatchObject({ displayName: "Alice in Rooms", bio: "I collect tiny websites." });
  });

  it("warns that changing the username changes the room address", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(getDefaultRoom());
    const { user } = renderAt("/settings");
    const field = await screen.findByLabelText("Username");
    await user.clear(field);
    await user.type(field, "alice-new");
    expect(screen.getByRole("alert")).toHaveTextContent(/links you've already shared with the old address will stop working/i);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Account" })).getByRole("link", { name: /@alice-new/ })).toBeInTheDocument();
  });

  it("requires signing in", async () => {
    setup();
    renderAt("/settings");
    const main = await screen.findByRole("main");
    expect(await within(main).findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Fsettings");
  });
});

describe("publishing from the editor", () => {
  it("asks visitors to log in before publishing", async () => {
    setup();
    renderAt("/edit");
    expect(await within(publishSection()).findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Fedit");
  });

  it("asks for a username before publishing", async () => {
    setup({ signedInAs: ALICE });
    renderAt("/edit");
    expect(await within(publishSection()).findByRole("link", { name: "Choose a username" })).toBeInTheDocument();
  });

  it("publishes explicitly, shows the share link, and leaves the local draft alone", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    const { user } = renderAt("/edit");
    expect(await screen.findByText("Not published")).toBeInTheDocument();
    expect(cloud.rooms.size).toBe(0);
    const before = localStorage.getItem(STORAGE_KEY);

    await user.click(within(publishSection()).getByRole("radio", { name: /unlisted/i }));
    await user.click(within(publishSection()).getByRole("radio", { name: /public/i }));
    await user.click(screen.getByRole("button", { name: "Publish room" }));

    expect(await within(publishSection()).findByText("Published successfully")).toBeInTheDocument();
    const saved = cloud.rooms.get(ALICE_ID)!;
    expect(saved.visibility).toBe("public");
    expect((saved.configuration as RoomConfig).title).toBe(getDefaultRoom().title);
    expect(within(publishSection()).getByDisplayValue("https://internetrooms.net/u/alice")).toBeInTheDocument();
    expect(within(publishSection()).getByRole("link", { name: "View room" })).toHaveAttribute("href", "/u/alice");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("tracks unpublished changes and updates the published room", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    const { user } = renderAt("/edit");
    await user.click(await screen.findByRole("button", { name: "Publish room" }));
    await within(publishSection()).findByText("Published successfully");

    const title = screen.getByLabelText(/room title/i);
    await user.clear(title);
    await user.type(title, "brand new title");
    expect(publishState()).toHaveTextContent("Unpublished changes");
    expect((cloud.rooms.get(ALICE_ID)!.configuration as RoomConfig).title).toBe(getDefaultRoom().title);

    await user.click(screen.getByRole("button", { name: "Update published room" }));
    expect(await within(publishSection()).findByText("Published successfully")).toBeInTheDocument();
    expect((cloud.rooms.get(ALICE_ID)!.configuration as RoomConfig).title).toBe("brand new title");
  });

  it("fails safely when an image upload fails", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    cloud.state.failUploads = true;
    const room = roomWith((r) => {
      r.layout.widgets.push({
        id: "w-img",
        type: "image",
        visible: true,
        width: "half",
        content: { image: { kind: "asset", assetId: "asset-local1" }, alt: "my cat", caption: "" },
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
    const { putAsset } = await import("../storage/assetStore");
    await putAsset({
      id: "asset-local1",
      blob: new Blob([new Uint8Array([1])], { type: "image/webp" }),
      type: "image/webp",
      width: 1,
      height: 1,
      size: 1,
      createdAt: new Date().toISOString(),
    });

    const { user } = renderAt("/edit");
    await user.click(await screen.findByRole("button", { name: "Publish room" }));
    expect(await within(publishSection()).findByText("Publish failed")).toBeInTheDocument();
    expect(within(publishSection()).getByRole("alert")).toHaveTextContent(/couldn't be uploaded.*nothing was published/i);
    expect(cloud.rooms.get(ALICE_ID)?.publishedAt ?? null).toBeNull();
  });

  it("refuses to publish an incomplete room", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    const { user } = renderAt("/edit");
    const publish = await screen.findByRole("button", { name: "Publish room" });
    await user.clear(screen.getByLabelText(/room title/i));
    await user.click(publish);
    expect(await within(publishSection()).findByRole("alert")).toHaveTextContent(/needs attention/i);
    expect(cloud.rooms.size).toBe(0);
  });

  it("doesn't pretend another device's room is synced, and loads it only on request", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(roomWith((r) => (r.title = "published on my laptop")));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderAt("/edit");

    expect(await within(publishSection()).findByText("Published from somewhere else")).toBeInTheDocument();
    expect(screen.getByLabelText(/room title/i)).toHaveValue(getDefaultRoom().title);

    await user.click(screen.getByRole("button", { name: "Load published room into editor" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/room title/i)).toHaveValue("published on my laptop");
    expect(publishState()).toHaveTextContent("Published");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // And it can be undone.
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(screen.getByLabelText(/room title/i)).toHaveValue(getDefaultRoom().title);
  });

  it("asks before replacing a room published elsewhere", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(roomWith((r) => (r.title = "published on my laptop")));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const { user } = renderAt("/edit");
    await user.click(await screen.findByRole("button", { name: /publish this editor's room instead/i }));
    expect(confirm).toHaveBeenCalled();
    expect((cloud.rooms.get(ALICE_ID)!.configuration as RoomConfig).title).toBe("published on my laptop");
  });
});

describe("publishDraft", () => {
  const blob = new Blob([new Uint8Array([1, 2])], { type: "image/webp" });

  function roomWithImages(): RoomConfig {
    return roomWith((r) => {
      widgetOf(r, "gallery").content.artwork[0].image = { kind: "asset", assetId: "asset-a" };
      r.layout.widgets.push({
        id: "w-img",
        type: "image",
        visible: false,
        width: "half",
        content: { image: { kind: "asset", assetId: "asset-a" }, alt: "same image twice", caption: "" },
      });
      r.theme.background.image.source = { kind: "asset", assetId: "asset-b" };
    });
  }

  it("uploads local images once and publishes stored references", async () => {
    setup();
    const readAsset = vi.fn(async () => blob);
    const draft = roomWithImages();
    const result = await publishDraft({ cloud: cloud.api, userId: ALICE_ID, draft, visibility: "public", readAsset });
    expect(result.ok).toBe(true);
    expect(cloud.uploads).toHaveLength(2);

    const published = cloud.rooms.get(ALICE_ID)!.configuration as RoomConfig;
    const kinds: string[] = [];
    mapImageSources(published, (s) => {
      kinds.push(s.kind);
      return s;
    });
    expect(kinds.every((k) => k === "stored" || k === "url")).toBe(true);
    expect(JSON.stringify(published)).not.toContain("asset-a");
    // The draft itself still points at the local images.
    expect(widgetOf(draft, "gallery").content.artwork[0].image).toEqual({ kind: "asset", assetId: "asset-a" });

    // Republishing reuses the uploads.
    await publishDraft({ cloud: cloud.api, userId: ALICE_ID, draft, visibility: "public", readAsset });
    expect(cloud.uploads).toHaveLength(2);
  });

  it("stops before saving if a local image is missing", async () => {
    setup();
    const result = await publishDraft({
      cloud: cloud.api,
      userId: ALICE_ID,
      draft: roomWithImages(),
      visibility: "public",
      readAsset: async () => null,
    });
    expect(result).toMatchObject({ ok: false, code: "missing_image" });
    expect(cloud.api.saveOwnRoom).not.toHaveBeenCalled();
  });

  it("refuses images that belong to another room's folder", async () => {
    setup();
    const draft = roomWith((r) => {
      widgetOf(r, "gallery").content.artwork[0].image = {
        kind: "stored",
        path: "99999999-9999-4999-8999-999999999999/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp",
      };
    });
    const result = await publishDraft({ cloud: cloud.api, userId: ALICE_ID, draft, visibility: "public" });
    expect(result).toMatchObject({ ok: false, code: "foreign_image" });
  });

  it("computes publish status from what this browser published", () => {
    const draft = getDefaultRoom();
    const remote = {
      visibility: "public" as const,
      published: true,
      publishedAt: "t",
      updatedAt: "v1",
      assetFolder: "f",
      configuration: {},
    };
    expect(publishStatus(null, null, draft)).toBe("not-published");
    expect(publishStatus({ ...remote, published: false }, null, draft)).toBe("not-published");
    expect(publishStatus(remote, null, draft)).toBe("changed-elsewhere");
    writePublishState("u", { fingerprint: roomFingerprint(draft), updatedAt: "v1" });
    expect(publishStatus(remote, readPublishState("u"), draft)).toBe("published");
    expect(publishStatus(remote, readPublishState("u"), roomWith((r) => (r.title = "x")))).toBe("unpublished-changes");
    expect(publishStatus({ ...remote, updatedAt: "v2" }, readPublishState("u"), draft)).toBe("changed-elsewhere");
  });
});

describe("public room pages", () => {
  it("renders a public room for visitors with the shared renderer and no editing controls", async () => {
    setup();
    cloud.profiles.set(ALICE_ID, { id: ALICE_ID, username: "alice", displayName: "Alice", bio: "hi there", avatarPath: null });
    await seedPublishedRoom(
      roomWith((r) => {
        r.title = "alice's corner";
        r.template = "dream-room";
        widgetOf(r, "gallery").content.artwork[0].image = {
          kind: "stored",
          path: "f0f0f0f0-0000-4000-8000-000000000000/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp",
        };
      }),
    );
    renderAt("/u/Alice");

    expect(await screen.findByRole("heading", { level: 1, name: "alice's corner" })).toBeInTheDocument();
    expect(screen.getByTestId("room-page")).toHaveAttribute("data-template", "dream-room");
    expect(screen.getByRole("complementary", { name: "About the owner" })).toHaveTextContent(/Alice\s*@alice/);
    expect(screen.getByText("hi there")).toBeInTheDocument();
    const alt = widgetOf(getDefaultRoom(), "gallery").content.artwork[0].alt;
    await waitFor(() =>
      expect(screen.getByRole("img", { name: alt })).toHaveAttribute(
        "src",
        expect.stringMatching(/^https:\/\/storage\.test\/signed\//),
      ),
    );
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit room" })).not.toBeInTheDocument();
    expect(screen.queryByText(ALICE)).not.toBeInTheDocument();
  });

  it("gives the owner an Edit Room link", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(getDefaultRoom());
    renderAt("/u/alice");
    expect(await screen.findByRole("link", { name: "Edit room" })).toHaveAttribute("href", "/edit");
  });

  it("hides private rooms from visitors but shows them to the owner", async () => {
    setup();
    cloud.profiles.set(ALICE_ID, { id: ALICE_ID, username: "alice", displayName: null, bio: null, avatarPath: null });
    await seedPublishedRoom(getDefaultRoom(), "private");
    const { unmount } = renderAt("/u/alice");
    expect(await screen.findByRole("heading", { level: 1, name: "this room isn't available" })).toBeInTheDocument();
    expect(screen.queryByTestId("room-page")).not.toBeInTheDocument();
    unmount();

    cloud.state.viewerId = ALICE_ID;
    fakes.auth = createFakeAuth({ sessionEmail: ALICE });
    renderAt("/u/alice");
    expect(await screen.findByText(/only you can see this — your room is private/i)).toBeInTheDocument();
    expect(screen.getByTestId("room-page")).toBeInTheDocument();
  });

  it("shows unlisted rooms only with the key", async () => {
    setup();
    cloud.profiles.set(ALICE_ID, { id: ALICE_ID, username: "alice", displayName: null, bio: null, avatarPath: null });
    await seedPublishedRoom(getDefaultRoom(), "unlisted");
    const { unmount } = renderAt("/u/alice");
    expect(await screen.findByRole("heading", { level: 1, name: "this room isn't available" })).toBeInTheDocument();
    unmount();

    renderAt(`/u/alice?key=${cloud.rooms.get(ALICE_ID)!.token}`);
    expect(await screen.findByTestId("room-page")).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  it("explains unknown usernames and rooms that can't be displayed", async () => {
    setup();
    const { unmount } = renderAt("/u/nobody");
    expect(await screen.findByRole("heading", { level: 1, name: /nobody lives here/i })).toBeInTheDocument();
    unmount();

    cloud.profiles.set(ALICE_ID, { id: ALICE_ID, username: "alice", displayName: null, bio: null, avatarPath: null });
    await seedPublishedRoom({ schemaVersion: 2, broken: true } as unknown as RoomConfig);
    renderAt("/u/alice");
    expect(await screen.findByText(/couldn't be displayed/i)).toBeInTheDocument();
  });

  it("follows username changes", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(getDefaultRoom());
    await cloud.api.updateProfile(ALICE_ID, { username: "alice-renamed" });
    cloud.state.viewerId = null;
    const { unmount } = renderAt("/u/alice");
    expect(await screen.findByRole("heading", { level: 1, name: /nobody lives here/i })).toBeInTheDocument();
    unmount();
    renderAt("/u/alice-renamed");
    expect(await screen.findByTestId("room-page")).toBeInTheDocument();
  });
});

describe("room settings", () => {
  it("changes visibility, unpublishes with confirmation, and keeps the local draft", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(getDefaultRoom());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getDefaultRoom()));
    const draftBefore = localStorage.getItem(STORAGE_KEY);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderAt("/settings");

    const room = await screen.findByRole("region", { name: "Room" });
    expect(await within(room).findByText(/published · public/i)).toBeInTheDocument();
    expect(within(room).getByDisplayValue("https://internetrooms.net/u/alice")).toBeInTheDocument();

    await user.click(within(room).getByRole("radio", { name: /unlisted/i }));
    expect(await within(room).findByText(/visibility changed to unlisted/i)).toBeInTheDocument();
    expect(within(room).getByDisplayValue(/https:\/\/internetrooms\.net\/u\/alice\?key=token-/)).toBeInTheDocument();

    await user.click(within(room).getByRole("button", { name: "Unpublish room" }));
    expect(confirm).toHaveBeenCalled();
    expect(await within(room).findByText(/not published \(saved, but hidden\)/i)).toBeInTheDocument();
    expect(cloud.rooms.get(ALICE_ID)!.configuration).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(draftBefore);

    await user.click(within(room).getByRole("button", { name: "Publish again" }));
    expect(await within(room).findByText(/published · unlisted/i)).toBeInTheDocument();
  });

  it("does nothing if unpublishing isn't confirmed", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    await seedPublishedRoom(getDefaultRoom());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user } = renderAt("/settings");
    const room = await screen.findByRole("region", { name: "Room" });
    await user.click(await within(room).findByRole("button", { name: "Unpublish room" }));
    expect(cloud.rooms.get(ALICE_ID)!.publishedAt).not.toBeNull();
  });

  it("points new users to the editor", async () => {
    setup({ signedInAs: ALICE, username: "alice" });
    renderAt("/settings");
    const room = await screen.findByRole("region", { name: "Room" });
    expect(await within(room).findByRole("link", { name: "Open the editor" })).toHaveAttribute("href", "/edit");
  });
});
