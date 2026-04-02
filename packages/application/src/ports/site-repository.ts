import type { Site, SiteCreateInput, SiteUpdateInput } from "@domain-slayer/domain";

export interface SiteListFilter {
  search?: string;
  /** Por defecto cualquier término basta (OR). Con «all», deben cumplirse todos los términos (AND). */
  searchMatch?: "any" | "all";
  /**
   * Si no queda ningún término tras stopwords y la cadena no está vacía, no usar fallback LIKE de la frase completa
   * (devuelve 0 filas). Útil para el asistente de biblioteca con preguntas en lenguaje natural.
   */
  strictTextSearch?: boolean;
  environment?: Site["environment"];
  isActive?: boolean;
  healthStatus?: Site["healthStatus"];
  limit?: number;
  offset?: number;
}

export interface SiteRepository {
  create(input: SiteCreateInput): Promise<Site>;
  update(id: string, input: SiteUpdateInput): Promise<Site | null>;
  findById(id: string): Promise<Site | null>;
  findByDomain(domain: string): Promise<Site | null>;
  list(filter: SiteListFilter): Promise<{ items: Site[]; total: number }>;
  delete(id: string): Promise<boolean>;
  /** Actualización masiva de campos operativos tras un chequeo */
  updateOperationalFields(
    id: string,
    fields: Partial<
      Pick<
        Site,
        | "domainExpiryAuto"
        | "domainExpiryManual"
        | "domainExpirySource"
        | "domainExpiryFinal"
        | "domainExpiryStatus"
        | "domainStatus"
        | "dnsStatus"
        | "nameserversJson"
        | "aRecordsJson"
        | "aaaaRecordsJson"
        | "cnameRecordsJson"
        | "mxRecordsJson"
        | "soaRecordJson"
        | "httpStatus"
        | "httpsStatus"
        | "sslSubject"
        | "sslIssuer"
        | "sslValidFrom"
        | "sslValidTo"
        | "sslValidToManual"
        | "sslExpirySource"
        | "sslValidToFinal"
        | "sslSerialNumber"
        | "sslStatus"
        | "sslHostnameMatch"
        | "lastCheckedAt"
        | "checkStatus"
        | "healthStatus"
        | "registrarProvider"
      >
    >
  ): Promise<void>;
}
