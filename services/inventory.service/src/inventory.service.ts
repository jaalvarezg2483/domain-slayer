import { Errors } from "moleculer";
import type { Context, ServiceSchema } from "moleculer";
import type { SqlUnitOfWork } from "@domain-slayer/infrastructure";
import { SiteService } from "@domain-slayer/application";

export function createInventoryService(getUow: () => SqlUnitOfWork): ServiceSchema {
  return {
    name: "inventory",
    actions: {
      "sites.list": {
        params: {
          search: { type: "string", optional: true },
          searchMatch: { type: "enum", values: ["any", "all"], optional: true },
          strictTextSearch: { type: "boolean", optional: true, convert: true },
          environment: { type: "string", optional: true },
          isActive: { type: "boolean", optional: true },
          healthStatus: { type: "string", optional: true },
          limit: { type: "number", optional: true, convert: true },
          offset: { type: "number", optional: true, convert: true },
          sortBy: { type: "enum", values: ["proximity", "updated_at"], optional: true },
        },
        async handler(ctx: { params: Record<string, unknown> }) {
          const uow = getUow();
          const svc = new SiteService(uow.sites);
          return svc.list(ctx.params as Parameters<SiteService["list"]>[0]);
        },
      },
      "sites.get": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new SiteService(uow.sites);
          const site = await svc.getById(ctx.params.id);
          if (!site) {
            throw new Errors.MoleculerError("Sitio no encontrado", 404, "NOT_FOUND");
          }
          const links = await uow.siteDocumentLinks.listBySiteId(ctx.params.id);
          const linkedDocuments: { id: string; title: string }[] = [];
          for (const l of links) {
            const d = await uow.documents.findById(l.documentId);
            if (d) linkedDocuments.push({ id: d.id, title: d.title });
          }
          return { ...site, linkedDocuments };
        },
      },
      "sites.documentLinks.add": {
        params: { siteId: "string", documentId: "string" },
        async handler(ctx: { params: { siteId: string; documentId: string } }) {
          const uow = getUow();
          const site = await uow.sites.findById(ctx.params.siteId);
          if (!site) throw new Errors.MoleculerError("Sitio no encontrado", 404, "NOT_FOUND");
          const doc = await uow.documents.findById(ctx.params.documentId);
          if (!doc) throw new Errors.MoleculerError("Documento no encontrado", 404, "NOT_FOUND");
          const existing = await uow.siteDocumentLinks.listBySiteId(ctx.params.siteId);
          if (existing.some((x) => x.documentId === ctx.params.documentId)) {
            return { ok: true, alreadyLinked: true };
          }
          await uow.siteDocumentLinks.add(ctx.params.siteId, ctx.params.documentId);
          return { ok: true };
        },
      },
      "sites.documentLinks.remove": {
        params: { siteId: "string", documentId: "string" },
        async handler(ctx: { params: { siteId: string; documentId: string } }) {
          const uow = getUow();
          const ok = await uow.siteDocumentLinks.remove(ctx.params.siteId, ctx.params.documentId);
          if (!ok) throw new Errors.MoleculerError("Vínculo no encontrado", 404, "NOT_FOUND");
          return { ok: true };
        },
      },
      "sites.create": {
        params: { payload: "object" },
        async handler(ctx: Context<{ payload: unknown }>) {
          const uow = getUow();
          const svc = new SiteService(uow.sites);
          const site = await svc.create(ctx.params.payload);
          try {
            await ctx.broker.call("monitoring.check.runOne", { siteId: site.id });
          } catch (e) {
            ctx.broker.logger.warn(
              `[inventory] Chequeo automático tras alta falló para ${site.id}:`,
              e instanceof Error ? e.message : e
            );
          }
          const fresh = await svc.getById(site.id);
          return fresh ?? site;
        },
      },
      "sites.update": {
        params: { id: "string", payload: "object" },
        async handler(ctx: { params: { id: string; payload: unknown } }) {
          const uow = getUow();
          const svc = new SiteService(uow.sites);
          return svc.update(ctx.params.id, ctx.params.payload);
        },
      },
      "sites.delete": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new SiteService(uow.sites);
          await svc.delete(ctx.params.id);
          return { ok: true };
        },
      },
      "sites.history": {
        async handler(ctx: { params: { siteId: string; limit?: number; offset?: number } }) {
          const uow = getUow();
          const limit = Number(ctx.params.limit ?? 50);
          const offset = Number(ctx.params.offset ?? 0);
          return uow.checkHistory.listBySiteId(ctx.params.siteId, limit, offset);
        },
      },
    },
  };
}
