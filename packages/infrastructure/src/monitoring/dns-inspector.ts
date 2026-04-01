import dns from "node:dns/promises";
import type { MxRecord, SoaRecord } from "node:dns";
import type { DnsInspectionResult, DnsInspector } from "@domain-slayer/application";

export class DnsInspectorNode implements DnsInspector {
  async inspect(domain: string): Promise<DnsInspectionResult> {
    const d = domain.toLowerCase();
    try {
      const [nsSettled, aSettled, aaaaSettled, mxSettled, cnameSettled, soaSettled] = await Promise.allSettled([
        dns.resolveNs(d),
        dns.resolve4(d).catch(() => [] as string[]),
        dns.resolve6(d).catch(() => [] as string[]),
        dns.resolveMx(d).catch(() => [] as MxRecord[]),
        dns.resolveCname(d).catch(() => [] as string[]),
        dns.resolveSoa(d).catch(() => null as SoaRecord | null),
      ]);

      const nameservers = nsSettled.status === "fulfilled" ? nsSettled.value : [];
      const aRecords = aSettled.status === "fulfilled" ? aSettled.value : [];
      const aaaaRecords = aaaaSettled.status === "fulfilled" ? aaaaSettled.value : [];
      const mxRecords =
        mxSettled.status === "fulfilled" ? mxSettled.value.map((m) => `${m.priority} ${m.exchange}`) : [];
      const cnameRecords = cnameSettled.status === "fulfilled" ? cnameSettled.value : [];
      let soa: Record<string, string> | null = null;
      if (soaSettled.status === "fulfilled" && soaSettled.value) {
        const s = soaSettled.value;
        soa = {
          nsname: s.nsname,
          hostmaster: s.hostmaster,
          serial: String(s.serial),
          refresh: String(s.refresh),
          retry: String(s.retry),
          expire: String(s.expire),
          minttl: String(s.minttl),
        };
      }

      const dnsFailed =
        nsSettled.status === "rejected" &&
        aSettled.status === "rejected" &&
        aaaaSettled.status === "rejected" &&
        cnameSettled.status === "rejected";

      const errMsg = dnsFailed
        ? String(nsSettled.status === "rejected" ? nsSettled.reason : "DNS sin respuesta")
        : null;

      return {
        nameservers,
        aRecords,
        aaaaRecords,
        cnameRecords,
        mxRecords,
        soa,
        status: dnsFailed ? "error" : "ok",
        errorMessage: errMsg,
      };
    } catch (e) {
      return {
        nameservers: [],
        aRecords: [],
        aaaaRecords: [],
        cnameRecords: [],
        mxRecords: [],
        soa: null,
        status: "error",
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
