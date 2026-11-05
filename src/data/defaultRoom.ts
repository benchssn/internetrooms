import type { RoomConfig } from "../types/room";
import exampleRoom from "./example-room.json";

/**
 * The bundled Classic Web example room. Returned as a fresh deep copy each
 * time so editor state can never mutate the shared JSON module.
 */
export function getDefaultRoom(): RoomConfig {
  return structuredClone(exampleRoom as RoomConfig);
}
