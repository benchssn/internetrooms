import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, vi } from "vitest";
import { resetAssetStoreForTests } from "./storage/assetStore";

let blobCounter = 0;

beforeEach(() => {
  // jsdom doesn't implement scrolling; App calls it when switching pages.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.localStorage.clear();
  // Every test starts at the homepage unless it navigates elsewhere.
  window.history.replaceState(null, "", "/");
  // A fresh, empty IndexedDB for each test.
  globalThis.indexedDB = new IDBFactory();
  resetAssetStoreForTests();
  // jsdom has no blob: URLs; hand out unique fake ones.
  URL.createObjectURL = vi.fn(() => `blob:test/${++blobCounter}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
