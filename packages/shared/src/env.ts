import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_ENCRYPT: z.coerce.boolean().default(true),
  DB_TRUST_SERVER_CERTIFICATE: z.coerce.boolean().default(true),
  DB_TYPE: z.enum(["sqlite", "mssql", "sqlserver"]).optional(),
  DB_PATH: z.string().optional(),
  DB_SYNC: z.enum(["true", "false"]).optional(),
  TRANSPORTER: z.string().optional(),
  SSL_CHECK_TIMEOUT_MS: z.coerce.number().default(10_000),
  HTTP_CHECK_TIMEOUT_MS: z.coerce.number().default(8000),
  /** Correo tras chequeo programado (opcional). */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): AppEnv {
  const merged = { ...process.env, ...overrides };
  return envSchema.parse(merged);
}
