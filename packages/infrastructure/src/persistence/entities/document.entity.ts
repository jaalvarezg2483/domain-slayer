import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "documents" })
export class DocumentEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ name: "site_id", type: "varchar", length: 36, nullable: true })
  siteId!: string | null;

  @Column({ name: "document_type", type: "varchar", length: 40 })
  documentType!: string;

  @Column({ type: "varchar", length: 500 })
  title!: string;

  @Column({ type: "varchar", length: 4000, nullable: true })
  description!: string | null;

  @Column({ name: "search_text", type: "text", nullable: true })
  searchText!: string | null;

  @Column({ name: "embedded_media_json", type: "text", nullable: true })
  embeddedMediaJson!: string | null;

  @Column({ name: "file_path", type: "varchar", length: 2000, nullable: true })
  filePath!: string | null;

  @Column({ name: "file_name", type: "varchar", length: 500, nullable: true })
  fileName!: string | null;

  @Column({ name: "mime_type", type: "varchar", length: 200, nullable: true })
  mimeType!: string | null;

  @Column({ name: "file_size_bytes", type: "int", nullable: true })
  fileSizeBytes!: number | null;

  @Column({ name: "uploaded_by", type: "varchar", length: 200, nullable: true })
  uploadedBy!: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
