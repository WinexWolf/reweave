import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Relative base so the built site works from a GitHub Pages project subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      // Use the library source directly — no build step needed for the demo.
      "reweave/yaml": fileURLToPath(
        new URL("../src/yaml/index.ts", import.meta.url),
      ),
      reweave: fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
});
