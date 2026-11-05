import type { CSSProperties, ReactNode } from "react";
import { SiteFooter } from "../SiteFooter/SiteFooter";
import { SiteHeader } from "../SiteHeader/SiteHeader";
import styles from "./SiteLayout.module.css";

/**
 * The site's monochrome palette. Applied inline (as well as through the
 * stylesheet's custom properties) so the white/near-black contract holds
 * even if a room theme has set colours higher up the page.
 */
const SITE_PALETTE = {
  paper: "#FFFFFF",
  ink: "#111111",
} as const;

const siteStyle = {
  backgroundColor: SITE_PALETTE.paper,
  color: SITE_PALETTE.ink,
  ["--site-paper" as string]: SITE_PALETTE.paper,
  ["--site-ink" as string]: SITE_PALETTE.ink,
} satisfies CSSProperties;

/** Header + main + footer chrome for the non-room pages. */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.site} style={siteStyle} data-theme="monochrome">
      <SiteHeader />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
