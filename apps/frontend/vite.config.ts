import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

/** SWC en lugar de Babel: evita Browserslist (a veces lee env corrupta del SO en workers de dev). */
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "../..");
  const env = { ...loadEnv(mode, repoRoot, ""), ...loadEnv(mode, __dirname, "") };
  const vitePrefixed = { ...loadEnv(mode, repoRoot, "VITE_"), ...loadEnv(mode, __dirname, "VITE_") };
  const siteUrl = vitePrefixed.VITE_SITE_URL ?? "";
  const apiProxyTarget = env.VITE_PROXY_TARGET || "http://localhost:3000";
  const profeDevTarget = env.VITE_PROFE_DEV_SERVER?.trim() || "http://127.0.0.1:5175";
  return {
    plugins: [
      react(),
      {
        name: "profe-slash-redirect",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const u = req.url ?? "";
            if (u === "/profe" || (u.startsWith("/profe?") && !u.startsWith("/profe/"))) {
              const q = u.includes("?") ? u.slice(u.indexOf("?")) : "";
              res.statusCode = 302;
              res.setHeader("Location", `/profe/${q}`);
              res.end();
              return;
            }
            next();
          });
        },
      },
      /* Sustituye %VITE_SITE_URL% en index.html sin exigir .env (evita warning y rutas rotas en dev). */
      {
        name: "html-vite-site-url",
        enforce: "pre",
        transformIndexHtml(html: string) {
          return html.replaceAll("%VITE_SITE_URL%", siteUrl);
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      /** Misma familia de direcciones que `VITE_PROFE_DEV_SERVER` (127.0.0.1) para que el proxy no falle en Windows. */
      host: "127.0.0.1",
      port: Number(env.VITE_DEV_PORT || 5173),
      strictPort: false,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/profe": {
          target: profeDevTarget,
          changeOrigin: true,
          ws: true,
          /** Evita cierres prematuros al cargar muchos chunks a través del proxy. */
          timeout: 120_000,
          proxyTimeout: 120_000,
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
        "/profe": {
          target: profeDevTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
