# Internetrooms

Internetrooms is an experimental creative web platform inspired by early personal websites. Milestone 1 delivered one Classic Web room template — a nostalgic, responsive personal page driven by local JSON configuration. Milestone 2 adds a visual editor so anyone can personalise that room without touching code. Milestone 3 turns it into a small multi-page site with a homepage, a template library (Classic Web, Cyber Room, Dream Room) and a separate saved-room viewer.

## Routes (Milestone 3)

| Route | What it shows |
| --- | --- |
| `/` | The Internetrooms homepage |
| `/templates` | The template library — pick Classic Web, Cyber Room or Dream Room |
| `/edit` | The visual room editor (with live preview and Preview mode) |
| `/room` | Your most recently **saved** room, as a visitor would see it |
| anything else | A friendly 404 page |

Routing uses [React Router](https://reactrouter.com/) with real URLs, so back/forward, bookmarks and refreshes all work. Unsaved editor changes are kept in memory while you move between pages (they're lost only if you close or reload the tab — the browser warns you first).

### Hosting the production build

Every route is served by the same `index.html`, so the host must fall back to it for unknown paths. `npm run dev` and `npm run preview` already do this. For production, the build includes:

- `public/_redirects` → copied to `dist/_redirects` (Netlify, Cloudflare Pages)
- `vercel.json` (Vercel)
- `dist/404.html`, a copy of `index.html` created after each build (GitHub Pages and similar static hosts; deep links work, though the first response carries a 404 status)

The app assumes it is served from the domain root. If you host it under a sub-path (e.g. `username.github.io/internetrooms/`), set `base` in `vite.config.ts` — the router picks it up automatically — but bundled asset paths in room data such as `/assets/images/…` would also need updating.

## Templates (Milestone 3)

| Template | Mood |
| --- | --- |
| **Classic Web** | Colourful panels, chunky retro windows, pixel stars — the early personal web |
| **Cyber Room** | Dark chrome-framed HUD panels, electric blue and violet glow, a now-playing equaliser |
| **Dream Room** | Lavender and pastel gradients, rounded translucent cards, drifting clouds and petals |

All three read the **same `RoomConfig`**, render the same widgets (About Me, Art Gallery, Music, Favourite Links), respect widget visibility, use the five theme colours and the four background patterns (each interpreted in the template's own style), handle empty content, and are responsive. Decorative motion (Cyber's equaliser, Dream's drifting shapes) stops when the visitor prefers reduced motion.

**Switching templates** (from `/templates`) changes only the draft: it sets `template`, applies that template's default colours and pattern, keeps every piece of content and every widget toggle, then opens `/edit`. Nothing is written to storage until you press **Save**. Choosing the template you're already using simply opens the editor and keeps your custom colours. In the editor, "Restore … colours" restores the current template's defaults.

### How templates fit together

```text
src/templates/
├── templateRegistry.ts   # single source of truth: id, name, tagline, description, default theme, component
├── RoomRenderer.tsx      # resolves room.template via the registry (unknown ids fall back to Classic Web)
├── applyTemplate.ts      # pure "switch template, keep content" function
├── shared/               # theme CSS variables, visible-link filter, SafeLink, shared widget headings
├── ClassicWeb/
├── CyberRoom/
└── DreamRoom/
```

`RoomRenderer` is used by the editor's live preview, Preview mode, `/room`, and the miniature previews on the homepage and `/templates` — there is no other rendering path.

**Adding a template:** add its id to `TEMPLATE_IDS` in `src/types/room.ts` (TypeScript will then insist on a registry entry), create a component that accepts `TemplateProps`, and register it with a default theme. The editor, validation, template library and renderer pick it up automatically.

### Schema

`TemplateId` is now `"classic-web" | "cyber-room" | "dream-room"`. This is an additive change, so `schemaVersion` stays `1` and Milestone 1 and 2 rooms load unchanged.

### `/room` is private to your browser

The saved room lives in this browser's `localStorage`. `/room` is **not** a public, shareable profile — someone else opening `/room` sees their own saved room (or an empty state), never yours. Public publishing needs a backend and is planned for a later milestone.

## Milestone 1 includes

- React + TypeScript + Vite app
- Classic Web personal room template
- Strongly typed room configuration schema
- One example room (`src/data/example-room.json`)
- Reusable Window, RoomHeader, and RoomSection components
- Responsive desktop and mobile layouts
- Basic accessibility support
- Vitest + React Testing Library coverage

## Milestone 2 — Visual Room Editor

Open `/edit` (or choose **Edit your room** on the homepage) for the editor: customisation controls on the left, a live preview of your Classic Web room on the right (stacked on screens narrower than 1024px).

**What you can change**

| Section | What it does |
| --- | --- |
| Template | Shows the current template, with a link to the template library |
| Room identity | Room title and tagline, with character counts |
| Theme colours | Background, primary, secondary, accent and text colours — native colour picker plus an editable hex value. Invalid hex values are never applied. "Restore template colours" brings back the originals. A gentle warning appears if text/panel contrast drops below 4.5:1 |
| Background | Plain, Pixel stars, Checkerboard or Retro grid (all CSS-generated) |
| About me | Display name and biography (line breaks are kept) |
| Gallery | Up to 12 artworks: title, image URL, alt text, move up/down, remove |
| Music | Track title, artist and description (text only, no playback) |
| Links | Up to 20 links: label, https:// URL, move up/down, remove |
| Widget visibility | Show/hide About Me, Gallery, Music and Links. Hidden widgets keep their content |

**Saving**

- Changes appear in the preview immediately but are only stored when you click **Save**.
- The toolbar shows **All changes saved** or **Unsaved changes**, and the browser warns before you leave with unsaved changes.
- The room is stored in `localStorage` under `internetrooms:room:room-001:v2` and restored next time you open the app in the same browser.
- Save is only reported as successful once the browser confirms the write. Storage errors (full, blocked, private mode) show an error and keep your changes in the editor.
- If a field needs attention, Save is blocked and the field shows a ⚠ message.
- **Reset** (after confirmation) restores the bundled example room and clears the saved copy.
- If saved data is damaged or fails validation, the default room is shown with a warning. The damaged data is left untouched until you choose to Save or Reset.

**Preview mode**

**Preview** shows the room exactly as visitors would see it, using the same `ClassicWeb` renderer with the editor hidden. Use **Back to editing** or press `Esc` to return.

### How it fits together

```text
src/
├── App.tsx                  # router + routes; shares one room draft across pages
├── pages/                   # HomePage, TemplatesPage, EditPage (editor ↔ preview mode), RoomPage, NotFoundPage
├── hooks/useRoomDraft.ts    # savedRoom + draftRoom, dirty state, save/reset, beforeunload
├── storage/roomStorage.ts   # localStorage load/save/clear with read-back confirmation
├── validation/roomValidation.ts  # limits, URL/colour checks, runtime schema validation
├── data/defaultRoom.ts      # fresh copy of the bundled example room
├── editor/
│   ├── RoomEditor.tsx       # toolbar, messages, two-panel layout
│   ├── PreviewMode.tsx      # visitor view + "Back to editing" bar
│   ├── EditorField.tsx      # labelled text/textarea/colour/toggle fields
│   ├── ListItemControls.tsx # move up/down/remove buttons
│   ├── editorUtils.ts       # ids, list helpers, contrast, focus helper
│   └── sections/            # one component per editor section
├── components/ArtworkImage/ # image with safe-URL check and error fallback
├── components/SiteHeader, SiteFooter, SiteLayout, TemplatePreview
└── templates/               # see "How templates fit together" above
```

### Schema change

`RoomTheme` gains an optional `backgroundPattern` (`"plain" | "stars" | "checkerboard" | "grid"`). `schemaVersion` stays `1`: rooms without the field still load and render the original Milestone 1 starfield.

### Validation and safety

- All stored data is treated as untrusted and validated on load (types, lengths, colours, patterns, widget flags, array limits, unique ids, URL schemes). Unknown fields are dropped.
- Links must be `https://` URLs. `javascript:`, `data:`, `http:`, relative and credential-bearing URLs are rejected.
- Artwork images must be `https://` URLs or bundled paths under `/assets/` (no data URLs, local filesystem paths or traversal).
- The renderer double-checks URLs too: an unsafe link is shown as plain text and an unsafe or broken image shows a placeholder.
- All room content is rendered as text; `dangerouslySetInnerHTML` is never used.
- No analytics or tracking.

| Field | Max length |
| --- | ---: |
| Room title | 80 |
| Tagline | 160 |
| Display name | 40 |
| Biography | 1,000 |
| Artwork title | 100 |
| Artwork alt text | 250 |
| Link label | 80 |
| Track title / artist | 100 |
| Music description | 300 |
| URL | 2,048 |
| Gallery items | 12 |
| Links | 20 |

### Accessibility

Every control has a visible label, errors are linked to their inputs with `aria-describedby`, saved/unsaved state uses text and icons (not only colour), save results use live regions, reorder buttons have descriptive labels and keep focus on the moved item, and reduced-motion preferences are respected. The editor uses its own fixed colour palette so it stays readable whatever room colours you pick.

## Intentionally excluded

User accounts, databases, uploads, guestbook submissions, messaging, multiplayer, avatars, neighbourhoods, AI integrations, social feeds, monetisation, arbitrary user HTML/CSS/JS, and third-party media embeds.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Typecheck and create a production build |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Run the test suite |
| `npm run preview` | Preview the production build |

## Editing the default room

The default room (used on first visit and after Reset) lives in `src/data/example-room.json`. Most people should use the in-app editor instead.

You can change:

- title, tagline, and owner bio
- theme colours and background pattern
- which widgets are visible (`widgets`)
- artwork, music info, and links

The Classic Web template reads that configuration and renders the page. No backend is required.

Artwork files referenced by `imageUrl` should live under `public/` (for example `public/assets/images/`).

## Known limitations

- `/room` is local to your browser and is not a public page; there is no publishing or sharing yet.
- Switching templates replaces your custom colours with the new template's defaults (your content is kept, and nothing is saved until you press Save).
- Template typography uses system font stacks (no web fonts), so headings look slightly different across operating systems.
- Rooms are saved only in this browser's `localStorage`. Clearing site data, private browsing, or a different browser/device means a different (or empty) save. There is no export/import yet.
- Only one room (`room-001`) is supported.
- Remote artwork images are loaded directly from their host, which can see a visitor's IP address. That's fine for a local prototype but must be revisited before any public publishing (e.g. proxying or uploading images).
- No image uploads, drag-and-drop, or arbitrary background images.
- Guestbook visibility exists in the schema but is not rendered or editable.
- Music is informational only — no audio playback or embeds.
- The "unsaved changes" warning on leaving relies on the browser's `beforeunload` support (some mobile browsers ignore it).
- No undo/redo beyond Reset.
