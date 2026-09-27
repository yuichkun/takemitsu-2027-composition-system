import { defineConfig } from "vite-plus";

export default defineConfig({
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
    ],
  },
});
