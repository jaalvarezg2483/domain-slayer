import { Column, Entity, PrimaryColumn } from "typeorm";

/** Institución educativa (módulo Inventario Profe); aislada por `owner_user_id` (JWT `sub`). */
@Entity({ name: "profe_schools" })
export class ProfeSchoolEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ name: "owner_user_id", type: "varchar", length: 36 })
  ownerUserId!: string;

  @Column({ type: "varchar", length: 500 })
  name!: string;

  /** Ruta en disco (Electron) o data URL / texto (web). */
  @Column({ name: "logo_path", type: "text", nullable: true })
  logoPath!: string | null;

  @Column({ name: "report_header", type: "text", nullable: true })
  reportHeader!: string | null;

  @Column({ name: "report_footer", type: "text", nullable: true })
  reportFooter!: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}
