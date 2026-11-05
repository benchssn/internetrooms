# Internetrooms

Internetrooms is an experimental creative web platform inspired by early personal websites. Milestone 1 delivered one Classic Web room template — a nostalgic, responsive personal page driven by local JSON configuration. Milestone 2 adds a visual editor so anyone can personalise that room without touching code.

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

Open the app and you land in the editor: customisation controls on the left, a live preview of your Classic Web room on the right (stacked on screens narrower than 1024px).

**What you can change**

| Section | What it does |
| --- | --- |
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
├── App.tsx                  # switches between editor and preview mode
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
└── templates/ClassicWeb/    # unchanged visitor-facing renderer (+ patterns)
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

## Adding a new visual template later

1. Add a new template id to `TemplateId` in `src/types/room.ts`.
2. Create a template component under `src/templates/`.
3. Point `App.tsx` (or a future template switch) at the new component based on `room.template`.

Keep templates presentational and pass room data in as props.

## Known limitations

- Only the Classic Web template is implemented.
- Rooms are saved only in this browser's `localStorage`. Clearing site data, private browsing, or a different browser/device means a different (or empty) save. There is no export/import yet.
- Only one room (`room-001`) is supported.
- Remote artwork images are loaded directly from their host, which can see a visitor's IP address. That's fine for a local prototype but must be revisited before any public publishing (e.g. proxying or uploading images).
- No image uploads, drag-and-drop, or arbitrary background images.
- Guestbook visibility exists in the schema but is not rendered or editable.
- Music is informational only — no audio playback or embeds.
- The "unsaved changes" warning on leaving relies on the browser's `beforeunload` support (some mobile browsers ignore it).
- No undo/redo beyond Reset.
