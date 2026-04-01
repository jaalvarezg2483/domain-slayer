import pino from "pino";
import type { AppEnv } from "./env.js";

export function createLogger(env: Pick<AppEnv, "NODE_ENV" | "LOG_LEVEL">) {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: "domain-slayer" },
  });
}

export type Logger = ReturnType<typeof createLogger>;
