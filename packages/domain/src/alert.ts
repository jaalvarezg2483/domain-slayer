import type { AlertSeverity, AlertType } from "./enums.js";

export interface Alert {
  id: string;
  siteId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: Date;
  isRead: boolean;
  isResolved: boolean;
}
