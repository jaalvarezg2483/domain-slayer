import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

/** SWC en lugar de Babel: evita Browserslist (a veces lee env corrupta del SO en workers de dev). */
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "../..");
  const env = { ...loadEnv(mode, repoRoot, ""), ...loadEnv(mode, __dirname, "") };
  const apiProxyTarget = env.VITE_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      strictPort: false,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    /** Sin esto, `vite preview` sirve dist/ pero /api no se reenvía → 404 al subir documentos. */
    preview: {
      port: 4173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
