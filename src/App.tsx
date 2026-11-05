import exampleRoom from "./data/example-room.json";
import { ClassicWeb } from "./templates/ClassicWeb/ClassicWeb";
import type { RoomConfig } from "./types/room";

const room = exampleRoom as RoomConfig;

export default function App() {
  return <ClassicWeb room={room} />;
}
