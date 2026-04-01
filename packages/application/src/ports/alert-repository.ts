import type { Alert } from "@domain-slayer/domain";

export interface AlertListFilter {
  siteId?: string;
  isResolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface AlertRepository {
  create(input: Omit<Alert, "id" | "createdAt">): Promise<Alert>;
  list(filter: AlertListFilter): Promise<{ items: Alert[]; total: number }>;
  markRead(id: string): Promise<void>;
  resolve(id: string): Promise<void>;
  /** Marca como resueltas todas las alertas aún abiertas. */
  resolveAllOpen(): Promise<{ count: number }>;
  /**
   * Marca resueltas alertas abiertas del sitio con uno de los tipos indicados.
   * Tras un chequeo se usa para sustituir avisos de vencimiento SSL/dominio sin duplicar filas.
   */
  resolveOpenForSiteAndTypes(siteId: string, alertTypes: readonly string[]): Promise<{ count: number }>;
}
