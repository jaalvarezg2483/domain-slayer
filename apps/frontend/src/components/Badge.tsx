import type { ReactNode } from "react";
import {
  labelCheckStatus,
  labelDnsStatus,
  labelDomainStatus,
  labelHealthStatus,
  labelSeverity,
  labelSslStatus,
} from "../lib/status-labels";

const map: Record<string, string> = {
  healthy: "badge badge-ok",
  warning: "badge badge-warn",
  critical: "badge badge-bad",
  unknown: "badge badge-muted",
  valid: "badge badge-ok",
  expiring_soon: "badge badge-warn",
  expired: "badge badge-bad",
  tls_error: "badge badge-bad",
  hostname_mismatch: "badge badge-bad",
  ok: "badge badge-ok",
  error: "badge badge-bad",
  info: "badge badge-info",
};

export type BadgeVariant = "health" | "ssl" | "dns" | "domain" | "severity" | "check";

function defaultLabel(kind: string, variant: BadgeVariant): string {
  switch (variant) {
    case "health":
      return labelHealthStatus(kind);
    case "ssl":
      return labelSslStatus(kind);
    case "dns":
      return labelDnsStatus(kind);
    case "domain":
      return labelDomainStatus(kind);
    case "severity":
      return labelSeverity(kind);
    case "check":
      return labelCheckStatus(kind);
    default:
      return kind;
  }
}

export function Badge({
  kind,
  variant = "health",
  children,
}: {
  kind: string;
  variant?: BadgeVariant;
  children?: ReactNode;
}) {
  const cls = map[kind] ?? "badge badge-muted";
  const text = children ?? defaultLabel(kind, variant);
  return <span className={cls}>{text}</span>;
}
