# Internetrooms

Internetrooms is an experimental creative web platform inspired by early personal websites. Milestone 1 delivers one Classic Web room template — a nostalgic, responsive personal page driven by local JSON configuration.

## Milestone 1 includes

- React + TypeScript + Vite app
- Classic Web personal room template
- Strongly typed room configuration schema
- One example room (`src/data/example-room.json`)
- Reusable Window, RoomHeader, and RoomSection components
- Responsive desktop and mobile layouts
- Basic accessibility support
- Vitest + React Testing Library coverage

## Intentionally excluded

User accounts, databases, room editing, uploads, guestbook submissions, messaging, multiplayer, avatars, neighbourhoods, AI integrations, social feeds, monetisation, arbitrary user HTML/CSS/JS, and third-party media embeds.

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

## Editing room content

Room content lives in `src/data/example-room.json`.

You can change:

- title, tagline, and owner bio
- theme colours
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
- Room data is a trusted bundled JSON fixture (no runtime schema validation yet).
- Guestbook visibility exists in the schema but is not rendered.
- Music is informational only — no audio playback.
- No room editor, accounts, or persistence beyond the local JSON file.
