import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@astrelune/validation": path.resolve(rootDir, "../../packages/validation/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: {
      "/auth": "http://127.0.0.1:4000",
      "/api": "http://127.0.0.1:4000",
      "/projects": "http://127.0.0.1:4000",
      "/worlds": "http://127.0.0.1:4000",
      "/goals": "http://127.0.0.1:4000",
      "/preferences": "http://127.0.0.1:4000",
    },
  },
});
