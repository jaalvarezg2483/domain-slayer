import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "check_history" })
export class CheckHistoryEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ name: "site_id", type: "varchar", length: 36 })
  siteId!: string;

  @Column({ name: "checked_at", type: "datetime" })
  checkedAt!: Date;

  @Column({ name: "domain_status", type: "varchar", length: 20 })
  domainStatus!: string;

  @Column({ name: "domain_expiry_auto", type: "datetime", nullable: true })
  domainExpiryAuto!: Date | null;

  @Column({ name: "domain_expiry_source", type: "varchar", length: 20 })
  domainExpirySource!: string;

  @Column({ name: "domain_expiry_status", type: "varchar", length: 20 })
  domainExpiryStatus!: string;

  @Column({ name: "dns_status", type: "varchar", length: 20 })
  dnsStatus!: string;

  @Column({ name: "http_status", type: "varchar", length: 20 })
  httpStatus!: string;

  @Column({ name: "https_status", type: "varchar", length: 20 })
  httpsStatus!: string;

  @Column({ name: "ssl_status", type: "varchar", length: 30 })
  sslStatus!: string;

  @Column({ name: "ssl_valid_from", type: "datetime", nullable: true })
  sslValidFrom!: Date | null;

  @Column({ name: "ssl_valid_to", type: "datetime", nullable: true })
  sslValidTo!: Date | null;

  @Column({ name: "ssl_issuer", type: "varchar", length: 2000, nullable: true })
  sslIssuer!: string | null;

  @Column({ name: "ssl_subject", type: "varchar", length: 2000, nullable: true })
  sslSubject!: string | null;

  @Column({ name: "ssl_hostname_match", type: "boolean", nullable: true })
  sslHostnameMatch!: boolean | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "raw_result_json", type: "text", nullable: true })
  rawResultJson!: string | null;

  @Column({ name: "duration_ms", type: "int" })
  durationMs!: number;
}
