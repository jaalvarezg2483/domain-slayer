import type { Alert } from "@domain-slayer/domain";
import type { AlertEntity } from "../entities/alert.entity.js";

export function mapAlertEntityToDomain(e: AlertEntity): Alert {
  return {
    id: e.id,
    siteId: e.siteId,
    alertType: e.alertType as Alert["alertType"],
    severity: e.severity as Alert["severity"],
    message: e.message,
    createdAt: e.createdAt,
    isRead: e.isRead,
    isResolved: e.isResolved,
  };
}
