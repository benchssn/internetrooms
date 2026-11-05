import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Development only: report whether Supabase is configured and reachable.
// This branch (and the module it loads) is removed from production builds.
if (import.meta.env.DEV) {
  void import("./supabase/devConnectionCheck").then((m) => m.runDevConnectionCheck());
}
