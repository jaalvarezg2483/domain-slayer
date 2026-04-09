import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DataSource } from "typeorm";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction, Router, RequestHandler } from "express";
import { AppUserEntity } from "@domain-slayer/infrastructure";
import type { Logger } from "@domain-slayer/shared";

const SCRYPT_KEY_LEN = 64;

export type AppRole = "admin" | "viewer";

/** SPA de entrada en despliegue combinado (columna `home_app`). */
export type UserHomeApp = "inventory" | "profe";

export function homeAppFromDb(value: string | null | undefined): UserHomeApp {
  return value === "profe" ? "profe" : "inventory";
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const hash = scryptSync(plain, salt, SCRYPT_KEY_LEN);
    return hash.length === expected.length && timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

export type AuthUser = {
  userId: string;
  email: string;
  role: AppRole;
  /** Nombre para mostrar (`display_name`); vacío si el usuario no lo ha definido. */
  name: string;
  /** Tokens antiguos sin claim → se trata como inventario. */
  homeApp: UserHomeApp;
};

export type AuthedRequest = Request & { auth?: AuthUser };

function roleFromDb(role: string | null | undefined): AppRole {
  return role === "viewer" ? "viewer" : "admin";
}

/** Solo el nombre guardado en BD (`display_name`). Vacío si no se ha definido en Usuarios — no se usa el correo. */
export function resolvedDisplayName(user: { displayName: string | null | undefined }): string {
  return user.displayName?.trim() || "";
}

function displayNameFromUser(user: AppUserEntity): string {
  return resolvedDisplayName(user);
}

/** Lee y verifica Bearer JWT. Sin secret o token inválido → null. */
export function readAuthUserFromRequest(req: Request): AuthUser | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(hdr.slice(7), secret) as {
      sub: string;
      email: string;
      role?: string;
      name?: string;
      homeApp?: string;
    };
    const role = roleFromDb(payload.role);
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "";
    const homeApp = homeAppFromDb(payload.homeApp);
    return { userId: payload.sub, email: payload.email, role, name, homeApp };
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    next();
    return;
  }
  const p = req.path;
  if (p === "/health" || p === "/ready" || p === "/auth/login" || p === "/auth/status") {
    next();
    return;
  }
  const u = readAuthUserFromRequest(req);
  if (!u) {
    res.status(401).json({ error: "Se requiere autenticación" });
    return;
  }
  (req as AuthedRequest).auth = u;
  next();
}

/** Programación / rutas fuera del router API: exige JWT y rol admin cuando JWT_SECRET está definido. */
export function monitoringScheduleAuthChain(): RequestHandler[] {
  const requireJwt: RequestHandler = (req, res, next) => {
    if (!process.env.JWT_SECRET?.trim()) {
      next();
      return;
    }
    const u = readAuthUserFromRequest(req);
    if (!u) {
      res.status(401).json({ error: "Se requiere autenticación" });
      return;
    }
    (req as AuthedRequest).auth = u;
    next();
  };
  const requireAdmin: RequestHandler = (req, res, next) => {
    if (!process.env.JWT_SECRET?.trim()) {
      next();
      return;
    }
    const u = (req as AuthedRequest).auth;
    if (!u || u.role !== "admin") {
      res.status(403).json({ error: "Se requieren permisos de administrador." });
      return;
    }
    next();
  };
  return [requireJwt, requireAdmin];
}

export function registerAuthRoutes(r: Router, ds: DataSource): void {
  r.post("/auth/login", async (req, res, next) => {
    try {
      const secret = process.env.JWT_SECRET?.trim();
      if (!secret) {
        res.json({
          authDisabled: true,
          message: "JWT_SECRET no está configurado: el API no exige login.",
        });
        return;
      }
      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password ?? "");
      if (!email || !password) {
        res.status(400).json({ error: "Indique correo y contraseña." });
        return;
      }
      const repo = ds.getRepository(AppUserEntity);
      const user = await repo.findOne({ where: { email } });
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }
      const role = roleFromDb(user.role);
      const name = displayNameFromUser(user);
      const homeApp = homeAppFromDb(user.homeApp);
      const token = jwt.sign(
        { sub: user.id, email: user.email, role, name, homeApp },
        secret,
        { expiresIn: "8h" }
      );
      res.json({
        token,
        expiresIn: 28_800,
        user: { email: user.email, displayName: name, role, homeApp },
      });
    } catch (e) {
      next(e);
    }
  });
}

export async function bootstrapInitialAdmin(ds: DataSource, logger: Logger): Promise<void> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    return;
  }
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const displayName =
    process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim() || process.env.INITIAL_ADMIN_NAME?.trim() || null;
  if (!email || !password) {
    logger.warn(
      "JWT_SECRET definido: defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD para crear el primer usuario al arrancar, inserte en app_users, o use Ajustes → Usuarios en la web."
    );
    return;
  }
  try {
    const repo = ds.getRepository(AppUserEntity);
    const n = await repo.count();
    if (n > 0) return;
    await repo.insert({
      id: randomUUID(),
      email,
      passwordHash: hashPassword(password),
      displayName: displayName || email.split("@")[0] || email,
      role: "admin",
      homeApp: "inventory",
      createdAt: new Date(),
    });
    logger.info({ email }, "Usuario administrador inicial creado (INITIAL_ADMIN_*)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "No se pudo crear el administrador inicial");
  }
}
