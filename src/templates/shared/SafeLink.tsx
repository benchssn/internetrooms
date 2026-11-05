import type { RoomLink } from "../../types/room";
import { isSafeLinkUrl } from "../../validation/roomValidation";

export interface SafeLinkProps {
  link: RoomLink;
  className?: string;
}

/**
 * Renders a room link that opens in a new tab. Unsafe or unfinished URLs
 * are shown as plain text instead of a clickable link.
 */
export function SafeLink({ link, className }: SafeLinkProps) {
  if (!isSafeLinkUrl(link.url)) {
    return <span className={className}>{link.label}</span>;
  }
  return (
    <a
      className={className}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {link.label}
    </a>
  );
}
