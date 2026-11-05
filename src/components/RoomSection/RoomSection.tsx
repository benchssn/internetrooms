import type { ReactNode } from "react";
import { Window } from "../Window/Window";

export interface RoomSectionProps {
  title: string;
  children: ReactNode;
}

export function RoomSection({ title, children }: RoomSectionProps) {
  return <Window title={title}>{children}</Window>;
}
