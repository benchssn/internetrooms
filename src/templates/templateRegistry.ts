import type { ComponentType } from "react";
import { TEMPLATE_IDS, type RoomTheme, type TemplateId } from "../types/room";
import { ClassicWeb } from "./ClassicWeb/ClassicWeb";
import { CyberRoom } from "./CyberRoom/CyberRoom";
import { DreamRoom } from "./DreamRoom/DreamRoom";
import type { TemplateProps } from "./shared/roomContent";

/** The parts of a theme a template provides: colours and pattern. */
export type TemplateTheme = Pick<
  RoomTheme,
  | "backgroundColor"
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "textColor"
  | "backgroundPattern"
>;

export interface TemplateDefinition {
  id: TemplateId;
  /** Display name, e.g. "Cyber Room". */
  name: string;
  /** One-line mood shown on cards. */
  tagline: string;
  /** A sentence or two describing the look. */
  description: string;
  /** Applied when a user switches to this template. */
  defaultTheme: TemplateTheme;
  /** Renders a RoomConfig in this template's style. */
  component: ComponentType<TemplateProps>;
}

/**
 * The single source of truth for available templates. Typed as a Record
 * over TemplateId, so adding an id without a registry entry is a type error.
 */
export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateDefinition> = {
  "classic-web": {
    id: "classic-web",
    name: "Classic Web",
    tagline: "your first homepage, lovingly restored",
    description:
      "Colourful panels, chunky retro window borders and twinkling pixel stars — the early personal web at its most sincere.",
    defaultTheme: {
      backgroundColor: "#263F88",
      primaryColor: "#D8DCF1",
      secondaryColor: "#A6B5E7",
      accentColor: "#FFDF68",
      textColor: "#202039",
      backgroundPattern: "stars",
    },
    component: ClassicWeb,
  },
  "cyber-room": {
    id: "cyber-room",
    name: "Cyber Room",
    tagline: "neon after-hours for your digital self",
    description:
      "Dark chrome-framed panels, electric blue and violet glow, and a humming now-playing deck — underground club flyers meet a Y2K desktop.",
    defaultTheme: {
      backgroundColor: "#07081A",
      primaryColor: "#12142E",
      secondaryColor: "#5B3FD9",
      accentColor: "#2FE6FF",
      textColor: "#E4E9FF",
      backgroundPattern: "grid",
    },
    component: CyberRoom,
  },
  "dream-room": {
    id: "dream-room",
    name: "Dream Room",
    tagline: "a soft place to drift and reflect",
    description:
      "Lavender skies, pastel gradients and drifting clouds and petals — a calm, digital-nature hideaway for slow thoughts.",
    defaultTheme: {
      backgroundColor: "#E7DDFB",
      primaryColor: "#FCF8FF",
      secondaryColor: "#C9E9DF",
      accentColor: "#F4B6D2",
      textColor: "#463A63",
      backgroundPattern: "stars",
    },
    component: DreamRoom,
  },
};

/** Templates in display order. */
export const TEMPLATES: readonly TemplateDefinition[] = TEMPLATE_IDS.map(
  (id) => TEMPLATE_REGISTRY[id],
);

/** Used when a room names a template this build doesn't know. */
export const FALLBACK_TEMPLATE_ID: TemplateId = "classic-web";

export function getTemplate(id: string): TemplateDefinition | undefined {
  return Object.hasOwn(TEMPLATE_REGISTRY, id)
    ? TEMPLATE_REGISTRY[id as TemplateId]
    : undefined;
}
