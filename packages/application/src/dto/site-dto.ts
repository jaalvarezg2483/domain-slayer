import { z } from "zod";

export const siteEnvironmentSchema = z.enum(["production", "staging", "development"]);

export const createSiteSchema = z.object({
  siteName: z.string().min(1).max(500),
  businessUnit: z.string().max(200).nullable().optional(),
  domain: z
    .string()
    .min(1)
    .max(253)
    .transform((s) => s.trim().toLowerCase()),
  url: z.string().url().max(2048),
  environment: siteEnvironmentSchema,
  provider: z.string().max(200).nullable().optional(),
  hostingProvider: z.string().max(200).nullable().optional(),
  dnsProvider: z.string().max(200).nullable().optional(),
  sslProvider: z.string().max(200).nullable().optional(),
  registrarProvider: z.string().max(200).nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
  technicalOwner: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  sslResolutionNotes: z.string().max(16000).nullable().optional(),
  domainResolutionNotes: z.string().max(16000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  domainExpiryManual: z.coerce.date().nullable().optional(),
  domainExpirySource: z.enum(["auto", "manual", "unavailable"]).optional(),
  sslValidToManual: z.coerce.date().nullable().optional(),
  sslExpirySource: z.enum(["auto", "manual", "unavailable"]).optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

export type CreateSiteDto = z.infer<typeof createSiteSchema>;
export type UpdateSiteDto = z.infer<typeof updateSiteSchema>;
