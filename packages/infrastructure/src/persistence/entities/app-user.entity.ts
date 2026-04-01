import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "app_users" })
export class AppUserEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ type: "varchar", length: 320, unique: true })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 512 })
  passwordHash!: string;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
