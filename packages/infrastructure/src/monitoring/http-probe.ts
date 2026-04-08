import type { HttpConnectivityProbe, HttpProbeResult } from "@domain-slayer/application";

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
 * Sigue redirecciones HTTPS como el navegador. **GET primero**: muchos orígenes responden 200 en HEAD en el apex
 * sin redirigir y solo envían 301/302 a `www` en GET; así `finalUrl` coincide con la página que abre el usuario.
 */
async function httpsFollow(httpsUrl: string, timeoutMs: number): Promise<{ ok: boolean; finalUrl: string }> {
  const tryOnce = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(httpsUrl, { method, signal: ctrl.signal, redirect: "follow" });
      return { ok: res.ok || (res.status >= 200 && res.status < 400), finalUrl: res.url };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await tryOnce("GET");
  } catch {
    try {
      return await tryOnce("HEAD");
    } catch {
      return { ok: false, finalUrl: httpsUrl };
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
