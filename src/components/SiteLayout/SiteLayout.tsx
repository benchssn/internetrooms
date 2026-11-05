import type { ReactNode } from "react";
import { SiteFooter } from "../SiteFooter/SiteFooter";
import { SiteHeader } from "../SiteHeader/SiteHeader";
import styles from "./SiteLayout.module.css";

/** Header + main + footer chrome for the non-room pages. */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.site}>
      <SiteHeader />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
