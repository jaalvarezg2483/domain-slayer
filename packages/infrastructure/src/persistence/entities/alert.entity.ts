import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "alerts" })
export class AlertEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ name: "site_id", type: "varchar", length: 36 })
  siteId!: string;

  @Column({ name: "alert_type", type: "varchar", length: 40 })
  alertType!: string;

  @Column({ type: "varchar", length: 20 })
  severity!: string;

  @Column({ type: "varchar", length: 2000 })
  message!: string;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ name: "is_resolved", type: "boolean", default: false })
  isResolved!: boolean;
}
