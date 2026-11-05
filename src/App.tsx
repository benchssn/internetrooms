import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { RoomDraftProvider } from "./hooks/RoomDraftProvider";
import { EditPage } from "./pages/EditPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RoomPage } from "./pages/RoomPage";
import { TemplatesPage } from "./pages/TemplatesPage";

// TEMPORARY: Supabase connectivity diagnostic. Loaded on demand so it adds
// nothing to the main bundle. Remove once the connection is confirmed.
const SupabaseTestPage = lazy(() =>
  import("./pages/SupabaseTestPage").then((m) => ({ default: m.SupabaseTestPage })),
);

/** Router base, so the app also works if Vite's `base` is a sub-path. */
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

/**
 * On client-side navigation, start the new page at the top and move focus
 * to its main heading so screen-reader users hear where they've arrived.
 */
function RouteFocus() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo(0, 0);
    const heading = document.querySelector<HTMLElement>("h1");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/templates" element={<TemplatesPage />} />
      <Route path="/edit" element={<EditPage />} />
      <Route path="/room" element={<RoomPage />} />
      <Route
        path="/supabase-test"
        element={
          <Suspense fallback={null}>
            <SupabaseTestPage />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <RoomDraftProvider>
        <RouteFocus />
        <AppRoutes />
      </RoomDraftProvider>
    </BrowserRouter>
  );
}
