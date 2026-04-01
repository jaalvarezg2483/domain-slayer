import { Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "site_document_links" })
export class SiteDocumentLinkEntity {
  @PrimaryColumn({ name: "site_id", type: "varchar", length: 36 })
  siteId!: string;

  @PrimaryColumn({ name: "document_id", type: "varchar", length: 36 })
  documentId!: string;
}
