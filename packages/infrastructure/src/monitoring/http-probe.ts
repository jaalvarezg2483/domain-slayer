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
      return {
        httpOk: false,
        httpsOk: false,
        httpStatus: "error",
        httpsStatus: "error",
      };
    }
    const [httpOk, httpsOk] = await Promise.all([headOrGet(httpUrl, ms), headOrGet(httpsUrl, ms)]);
    return {
      httpOk,
      httpsOk,
      httpStatus: httpOk ? "ok" : "error",
      httpsStatus: httpsOk ? "ok" : "error",
    };
  }
}
