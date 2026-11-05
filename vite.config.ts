/// <reference types="vitest/config" />
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Copies dist/index.html to dist/404.html after a build. Static hosts such
 * as GitHub Pages serve 404.html for unknown paths, which lets the client
 * router handle deep links like /edit on a refresh. (Hosts with rewrite
 * support use public/_redirects or vercel.json instead.)
 */
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "internetrooms-spa-fallback",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallback()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
