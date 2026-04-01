import type { DomainExpirySource } from "@domain-slayer/domain";

export function resolveDomainExpirySource(
  manual: Date | null,
  explicit?: DomainExpirySource
): DomainExpirySource {
  if (explicit === "manual" || manual) return "manual";
  if (explicit === "unavailable") return "unavailable";
  return explicit ?? "unavailable";
}

export function computeDomainExpiryFinal(
  auto: Date | null,
  manual: Date | null,
  source: DomainExpirySource
): Date | null {
  if (source === "manual" && manual) return manual;
  if (source === "auto" && auto) return auto;
  if (manual) return manual;
  if (auto) return auto;
  return null;
}
