import type { HttpConnectivityProbe, HttpProbeResult } from "@domain-slayer/application";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PROBE_USER_AGENT = "DomainSlayer-HttpProbe/1.0";

async function headOrGet(url: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    return res.ok || (res.status >= 200 && res.status < 400);
  } catch {
    try {
      const res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow" });
      return res.ok || (res.status >= 200 && res.status < 400);
    } catch {
      return false;
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET siguiendo redirecciones sin exigir cadena TLS verificada en cada salto.
 *
 * `fetch` de Node puede fallar en el **apex** con «unable to verify the first certificate» (cadena incompleta)
 * y **no aplicar el 301 a `www`**; el inspector SSL ya usa `rejectUnauthorized: false`. Aquí hacemos lo mismo
 * solo para descubrir la URL final y alinear el probe con el navegador.
 */
function httpsGetFollowRedirects(
  startUrl: string,
  timeoutMs: number,
  maxHops = 20
): Promise<{ ok: boolean; finalUrl: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    let currentUrl = startUrl;
    let hop = 0;

    const run = (): void => {
      if (hop++ > maxHops) {
        reject(new Error("Demasiadas redirecciones HTTPS"));
        return;
      }
      let u: URL;
      try {
        u = new URL(currentUrl);
      } catch {
        reject(new Error("URL HTTPS inválida"));
        return;
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        reject(new Error("Solo http(s)"));
        return;
      }
      const isHttps = u.protocol === "https:";
      const lib = isHttps ? https : http;
      const port = u.port ? Number(u.port) : isHttps ? 443 : 80;
      const req = lib.request(
        {
          hostname: u.hostname,
          port,
          path: `${u.pathname}${u.search}` || "/",
          method: "GET",
          timeout: timeoutMs,
          /** Algunos orígenes (p. ej. tras Cloudflare) envían cabeceras que el parser estricto de Node rechaza; el navegador las acepta. */
          insecureHTTPParser: true,
          ...(isHttps ? { rejectUnauthorized: false } : {}),
          headers: {
            "User-Agent": PROBE_USER_AGENT,
            Accept: "*/*",
          },
        },
        (res) => {
          const code = res.statusCode ?? 0;
          const rawLoc = res.headers.location;
          const loc = typeof rawLoc === "string" ? rawLoc : Array.isArray(rawLoc) ? rawLoc[0] : undefined;
          if (code >= 300 && code < 400 && loc) {
            res.resume();
            try {
              currentUrl = new URL(loc, currentUrl).href;
            } catch {
              resolve({ ok: false, finalUrl: currentUrl, statusCode: code });
              return;
            }
            run();
            return;
          }
          const ok = code >= 200 && code < 400;
          res.resume();
          resolve({ ok, finalUrl: currentUrl, statusCode: code });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout HTTP(S)"));
      });
      req.end();
    };

    run();
  });
}

/**
 * Sigue redirecciones HTTPS como el navegador. **GET primero**: muchos orígenes responden 200 en HEAD en el apex
 * sin redirigir y solo envían 301/302 a `www` en GET; así `finalUrl` coincide con la página que abre el usuario.
 */
async function httpsFollow(httpsUrl: string, timeoutMs: number): Promise<{ ok: boolean; finalUrl: string }> {
  try {
    const { ok, finalUrl } = await httpsGetFollowRedirects(httpsUrl, timeoutMs);
    return { ok, finalUrl };
  } catch {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(httpsUrl, { method: "GET", signal: ctrl.signal, redirect: "follow" });
      return { ok: res.ok || (res.status >= 200 && res.status < 400), finalUrl: res.url };
    } catch {
      try {
        const res = await fetch(httpsUrl, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
        return { ok: res.ok || (res.status >= 200 && res.status < 400), finalUrl: res.url };
      } catch {
        return { ok: false, finalUrl: httpsUrl };
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HttpConnectivityNode implements HttpConnectivityProbe {
  constructor(private readonly defaultTimeout: number) {}

  async probe(url: string, timeoutMs: number): Promise<HttpProbeResult> {
    const ms = timeoutMs || this.defaultTimeout;
    let httpUrl: string;
    let httpsUrl: string;
    try {
      const u = new URL(url);
      const host = u.hostname;
      const path = u.pathname + u.search || "/";
      httpUrl = `http://${host}${path}`;
      httpsUrl = url.startsWith("https:") ? url : `https://${host}${path}`;
    } catch {
      let fallbackHttps = "https://invalid.invalid/";
      try {
        fallbackHttps = new URL(url).href;
      } catch {
        /* url ilegible */
      }
      return {
        httpOk: false,
        httpsOk: false,
        httpStatus: "error",
        httpsStatus: "error",
        httpsEffectiveUrl: fallbackHttps,
      };
    }
    const [httpOk, httpsProbe] = await Promise.all([headOrGet(httpUrl, ms), httpsFollow(httpsUrl, ms)]);
    return {
      httpOk,
      httpsOk: httpsProbe.ok,
      httpStatus: httpOk ? "ok" : "error",
      httpsStatus: httpsProbe.ok ? "ok" : "error",
      httpsEffectiveUrl: httpsProbe.finalUrl,
    };
  }
}
