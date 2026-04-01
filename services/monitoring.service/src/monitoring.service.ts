import { Errors } from "moleculer";
import type { ServiceSchema } from "moleculer";
import type { SqlUnitOfWork } from "@domain-slayer/infrastructure";
import {
  MonitoringRunner,
  monitoringResultToOperationalPatch,
  buildAlertsFromCheck,
} from "@domain-slayer/application";
import {
  SslInspectorNode,
  DnsInspectorNode,
  HttpConnectivityNode,
  RdapDomainExpiryProvider,
} from "@domain-slayer/infrastructure";
import { DEFAULT_ALERT_DAY_THRESHOLDS } from "@domain-slayer/shared";

export interface MonitoringServiceOptions {
  sslTimeoutMs: number;
  httpTimeoutMs: number;
  alertDays: readonly number[];
}

export function createMonitoringService(
  getUow: () => SqlUnitOfWork,
  opts: MonitoringServiceOptions
): ServiceSchema {
  const ssl = new SslInspectorNode(opts.sslTimeoutMs);
  const dns = new DnsInspectorNode();
  const http = new HttpConnectivityNode(opts.httpTimeoutMs);
  const domainExpiry = new RdapDomainExpiryProvider();
  const thresholds = opts.alertDays.length ? opts.alertDays : DEFAULT_ALERT_DAY_THRESHOLDS;
  const runner = new MonitoringRunner({
    ssl,
    dns,
    http,
    domainExpiry,
    sslAlertDays: thresholds,
  });

  async function runCheck(uow: SqlUnitOfWork, siteId: string) {
    const site = await uow.sites.findById(siteId);
    if (!site) {
      throw new Errors.MoleculerError("Sitio no encontrado", 404, "NOT_FOUND");
    }
    if (!site.isActive) {
      throw new Errors.MoleculerError("Sitio inactivo", 400, "INACTIVE");
    }
    const result = await runner.run(site);
    const patch = monitoringResultToOperationalPatch(site, result);
    await uow.sites.updateOperationalFields(site.id, patch);
    const updated = await uow.sites.findById(site.id);
    if (!updated) {
      throw new Errors.MoleculerError("Sitio inconsistente", 500, "DATA");
    }
    await uow.checkHistory.append({
      siteId: site.id,
      checkedAt: new Date(),
      domainStatus: result.domainStatus as (typeof site)["domainStatus"],
      domainExpiryAuto: result.domainExpiryAuto,
      domainExpirySource: result.domainExpirySource,
      domainExpiryStatus: result.domainExpiryStatus as (typeof site)["domainExpiryStatus"],
      dnsStatus: result.dnsStatus as (typeof site)["dnsStatus"],
      httpStatus: result.httpStatus as (typeof site)["httpStatus"],
      httpsStatus: result.httpsStatus as (typeof site)["httpsStatus"],
      sslStatus: result.sslStatus as (typeof site)["sslStatus"],
      sslValidFrom: result.sslValidFrom,
      sslValidTo: result.sslValidTo,
      sslIssuer: result.sslIssuer,
      sslSubject: result.sslSubject,
      sslHostnameMatch: result.sslHostnameMatch,
      errorMessage: result.errorMessage,
      rawResultJson: JSON.stringify(result),
      durationMs: result.durationMs,
    });
    await uow.alerts.resolveOpenForSiteAndTypes(site.id, ["ssl_expiring", "domain_expiring"]);
    const alerts = buildAlertsFromCheck(updated, result, thresholds);
    for (const a of alerts) {
      await uow.alerts.create(a);
    }
    return { site: updated, result };
  }

  return {
    name: "monitoring",
    actions: {
      "check.runOne": {
        params: { siteId: "string" },
        async handler(ctx: { params: { siteId: string } }) {
          const uow = getUow();
          return runCheck(uow, ctx.params.siteId);
        },
      },
      "check.runAll": {
        async handler(ctx: { broker: { call: (a: string, p: object) => Promise<unknown> } }) {
          const uow = getUow();
          const { items } = await uow.sites.list({ isActive: true, limit: 500, offset: 0 });
          const out: unknown[] = [];
          for (const s of items) {
            const r = await ctx.broker.call("monitoring.check.runOne", { siteId: s.id });
            out.push(r);
          }
          return { count: out.length };
        },
      },
    },
  };
}
