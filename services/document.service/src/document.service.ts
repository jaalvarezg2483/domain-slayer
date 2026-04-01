import { Errors } from "moleculer";
import type { ServiceSchema } from "moleculer";
import type { SqlUnitOfWork } from "@domain-slayer/infrastructure";
import { DocumentService } from "@domain-slayer/application";

export function createDocumentService(getUow: () => SqlUnitOfWork): ServiceSchema {
  return {
    name: "documents",
    actions: {
      "docs.list": {
        params: { siteId: "string" },
        async handler(ctx: { params: { siteId: string } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          return svc.listBySite(ctx.params.siteId);
        },
      },
      "docs.libraryList": {
        params: {
          limit: { type: "number", optional: true, convert: true },
          offset: { type: "number", optional: true, convert: true },
        },
        async handler(ctx: { params: { limit?: number; offset?: number } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          return svc.listLibrary({ limit: ctx.params.limit, offset: ctx.params.offset });
        },
      },
      "docs.get": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          const doc = await svc.getById(ctx.params.id);
          if (!doc) {
            throw new Errors.MoleculerError("Documento no encontrado", 404, "NOT_FOUND");
          }
          return doc;
        },
      },
      "docs.create": {
        params: { payload: "object" },
        async handler(ctx: { params: { payload: unknown } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          return svc.create(ctx.params.payload);
        },
      },
      "docs.update": {
        params: { id: "string", payload: "object" },
        async handler(ctx: { params: { id: string; payload: unknown } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          return svc.update(ctx.params.id, ctx.params.payload);
        },
      },
      "docs.delete": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          await svc.delete(ctx.params.id);
          return { ok: true };
        },
      },
      "docs.search": {
        params: {
          q: { type: "string", optional: true },
          limit: { type: "number", optional: true, convert: true },
          offset: { type: "number", optional: true, convert: true },
          match: { type: "string", optional: true, enum: ["all", "any"] },
        },
        async handler(ctx: {
          params: { q?: string; limit?: number; offset?: number; match?: "all" | "any" };
        }) {
          const uow = getUow();
          const svc = new DocumentService(uow.documents, uow.sites);
          return svc.searchLibrary(ctx.params.q ?? "", {
            limit: ctx.params.limit,
            offset: ctx.params.offset,
            match: ctx.params.match,
          });
        },
      },
    },
  };
}
