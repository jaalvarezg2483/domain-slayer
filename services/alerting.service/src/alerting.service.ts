import type { ServiceSchema } from "moleculer";
import type { SqlUnitOfWork } from "@domain-slayer/infrastructure";
import { AlertService } from "@domain-slayer/application";

export function createAlertingService(getUow: () => SqlUnitOfWork): ServiceSchema {
  return {
    name: "alerting",
    actions: {
      "alerts.list": {
        params: {
          siteId: { type: "string", optional: true },
          isResolved: { type: "boolean", optional: true, convert: true },
          limit: { type: "number", optional: true, convert: true },
          offset: { type: "number", optional: true, convert: true },
        },
        async handler(ctx: { params: Record<string, unknown> }) {
          const uow = getUow();
          const svc = new AlertService(uow.alerts);
          return svc.list(ctx.params as Parameters<AlertService["list"]>[0]);
        },
      },
      "alerts.read": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new AlertService(uow.alerts);
          await svc.markRead(ctx.params.id);
          return { ok: true };
        },
      },
      "alerts.resolve": {
        params: { id: "string" },
        async handler(ctx: { params: { id: string } }) {
          const uow = getUow();
          const svc = new AlertService(uow.alerts);
          await svc.resolve(ctx.params.id);
          return { ok: true };
        },
      },
      "alerts.resolveAllOpen": {
        async handler() {
          const uow = getUow();
          const svc = new AlertService(uow.alerts);
          return svc.resolveAllOpen();
        },
      },
    },
  };
}
