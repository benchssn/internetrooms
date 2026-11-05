import { useEffect } from "react";

const SITE_NAME = "internetrooms";

/** Sets the browser tab title for the current page. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
