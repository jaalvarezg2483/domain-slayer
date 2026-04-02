import { Column, Entity, PrimaryColumn } from "typeorm";

/** Tipos portables (SQLite + SQL Server) vía TypeORM */
@Entity({ name: "sites" })
export class SiteEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ name: "site_name", type: "varchar", length: 500 })
  siteName!: string;

  @Column({ name: "business_unit", type: "varchar", length: 200, nullable: true })
  businessUnit!: string | null;

  @Column({ type: "varchar", length: 253 })
  domain!: string;

  @Column({ type: "varchar", length: 2048 })
  url!: string;

  @Column({ type: "varchar", length: 20 })
  environment!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  provider!: string | null;

  @Column({ name: "hosting_provider", type: "varchar", length: 200, nullable: true })
  hostingProvider!: string | null;

  @Column({ name: "dns_provider", type: "varchar", length: 200, nullable: true })
  dnsProvider!: string | null;

  @Column({ name: "ssl_provider", type: "varchar", length: 200, nullable: true })
  sslProvider!: string | null;

  @Column({ name: "registrar_provider", type: "varchar", length: 200, nullable: true })
  registrarProvider!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  owner!: string | null;

  @Column({ name: "technical_owner", type: "varchar", length: 200, nullable: true })
  technicalOwner!: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 320, nullable: true })
  contactEmail!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ name: "ssl_resolution_notes", type: "text", nullable: true })
  sslResolutionNotes!: string | null;

  @Column({ name: "domain_resolution_notes", type: "text", nullable: true })
  domainResolutionNotes!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;

  @Column({ name: "domain_expiry_auto", type: "datetime", nullable: true })
  domainExpiryAuto!: Date | null;

  @Column({ name: "domain_expiry_manual", type: "datetime", nullable: true })
  domainExpiryManual!: Date | null;

  @Column({ name: "domain_expiry_final", type: "datetime", nullable: true })
  domainExpiryFinal!: Date | null;

  @Column({ name: "domain_expiry_source", type: "varchar", length: 20 })
  domainExpirySource!: string;

  @Column({ name: "domain_expiry_status", type: "varchar", length: 20 })
  domainExpiryStatus!: string;

  @Column({ name: "domain_status", type: "varchar", length: 20 })
  domainStatus!: string;

  @Column({ name: "dns_status", type: "varchar", length: 20 })
  dnsStatus!: string;

  @Column({ name: "nameservers_json", type: "text", nullable: true })
  nameserversJson!: string | null;

  @Column({ name: "a_records_json", type: "text", nullable: true })
  aRecordsJson!: string | null;

  @Column({ name: "aaaa_records_json", type: "text", nullable: true })
  aaaaRecordsJson!: string | null;

  @Column({ name: "cname_records_json", type: "text", nullable: true })
  cnameRecordsJson!: string | null;

  @Column({ name: "mx_records_json", type: "text", nullable: true })
  mxRecordsJson!: string | null;

  @Column({ name: "soa_record_json", type: "text", nullable: true })
  soaRecordJson!: string | null;

  @Column({ name: "http_status", type: "varchar", length: 20 })
  httpStatus!: string;

  @Column({ name: "https_status", type: "varchar", length: 20 })
  httpsStatus!: string;

  @Column({ name: "ssl_subject", type: "varchar", length: 2000, nullable: true })
  sslSubject!: string | null;

  @Column({ name: "ssl_issuer", type: "varchar", length: 2000, nullable: true })
  sslIssuer!: string | null;

  @Column({ name: "ssl_valid_from", type: "datetime", nullable: true })
  sslValidFrom!: Date | null;

  @Column({ name: "ssl_valid_to", type: "datetime", nullable: true })
  sslValidTo!: Date | null;

  @Column({ name: "ssl_valid_to_manual", type: "datetime", nullable: true })
  sslValidToManual!: Date | null;

  @Column({ name: "ssl_expiry_source", type: "varchar", length: 20, nullable: true })
  sslExpirySource!: string | null;

  @Column({ name: "ssl_valid_to_final", type: "datetime", nullable: true })
  sslValidToFinal!: Date | null;

  @Column({ name: "ssl_serial_number", type: "varchar", length: 256, nullable: true })
  sslSerialNumber!: string | null;

  @Column({ name: "ssl_status", type: "varchar", length: 30 })
  sslStatus!: string;

  @Column({ name: "ssl_hostname_match", type: "boolean", nullable: true })
  sslHostnameMatch!: boolean | null;

  @Column({ name: "last_checked_at", type: "datetime", nullable: true })
  lastCheckedAt!: Date | null;

  @Column({ name: "check_status", type: "varchar", length: 20 })
  checkStatus!: string;

  @Column({ name: "health_status", type: "varchar", length: 20 })
  healthStatus!: string;
}
