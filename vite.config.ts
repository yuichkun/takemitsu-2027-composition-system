import { defineConfig, type Plugin } from "vite-plus";

import { previewMiddleware } from "./src/preview/server.ts";

/** Score list, MusicXML, renders and change events for the preview (src/preview/server.ts). */
function preview(): Plugin {
  return {
    name: "score-preview",
    configureServer(server) {
      server.middlewares.use(previewMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [preview()],
  server: {
    // Renders write here; reloading the page on every render would reset playback.
    watch: {
      ignored: [
        "**/.local/**",
        "**/native/**",
        "**/examples/**",
        "**/scores/**",
        "**/sketches/**",
        "**/samples/**",
      ],
    },
  },
  optimizeDeps: { exclude: ["verovio"] },
  build: { target: "es2023" },
  lint: {
    ignorePatterns: ["native/**", ".local/**", "artifacts/**"],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: [
      "native/**",
      ".local/**",
      "artifacts/**",
      "docs/**",
      "**/*.md",
      ".vscode/**",
      "src/libraries/bbcso/inventory.json",
      // Written by the sketch scripts.
      "sketches/*.json",
    ],
  },
});
