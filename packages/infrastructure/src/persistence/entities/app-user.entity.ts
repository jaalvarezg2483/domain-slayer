import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "app_users" })
export class AppUserEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ type: "varchar", length: 320, unique: true })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 512 })
  passwordHash!: string;

  /** Nombre para mostrar en la interfaz (opcional). */
  @Column({ name: "display_name", type: "varchar", length: 200, nullable: true })
  displayName!: string | null;

  /** `admin` | `viewer` (visor: solo lectura salvo rutas explícitas). */
  @Column({ type: "varchar", length: 20, default: "admin" })
  role!: string;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
