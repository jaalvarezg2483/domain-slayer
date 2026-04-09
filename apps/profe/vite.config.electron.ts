import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

/** App de escritorio (Electron + SQLite local). No usar para el deploy web en DomainSlayer. */
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            target: "node18",
            rollupOptions: {
              external: ["better-sqlite3", "electron"],
              output: {
                format: "es",
                entryFileNames: "[name].js",
                preserveModules: false,
              },
            },
            commonjsOptions: {
              transformMixedEsModules: false,
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/electron": path.resolve(__dirname, "./electron"),
    },
  },
  base: "./",
  server: {
    port: 5173,
  },
});
