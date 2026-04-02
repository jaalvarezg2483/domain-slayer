import type { DomainExpirySource } from "@domain-slayer/domain";
import { computeDomainExpiryFinal, resolveDomainExpirySource } from "./site-domain-expiry.js";

/** Misma semántica que dominio: manual / auto / unavailable. */
export function resolveSslExpirySource(
  manual: Date | null,
  explicit?: DomainExpirySource
): DomainExpirySource {
  return resolveDomainExpirySource(manual, explicit);
}

export function computeSslExpiryFinal(
  auto: Date | null,
  manual: Date | null,
  source: DomainExpirySource
): Date | null {
  return computeDomainExpiryFinal(auto, manual, source);
}
