import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // jsdom doesn't implement scrolling; App calls it when switching modes.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.localStorage.clear();
  // Every test starts at the homepage unless it navigates elsewhere.
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
