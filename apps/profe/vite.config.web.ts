import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Build SPA para el monorepo DomainSlayer: sirve bajo `/profe/` (Railway, proxy dev en 5173).
 * La app de escritorio usa `vite.config.electron.ts`.
 */
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "../..");
  const env = { ...loadEnv(mode, repoRoot, ""), ...loadEnv(mode, __dirname, "") };
  const apiProxyTarget = env.VITE_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/electron": path.resolve(__dirname, "./electron"),
      },
    },
    base: "/profe/",
    server: {
      /** Mismo host que el proxy del inventario (`127.0.0.1`) para evitar ECONNREFUSED en Windows (::1 vs 127.0.0.1). */
      host: "127.0.0.1",
      port: Number(env.VITE_PROFE_PORT || 5175),
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: Number(env.VITE_PROFE_PORT || 5175),
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
