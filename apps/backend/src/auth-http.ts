import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DataSource } from "typeorm";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction, Router } from "express";
import { AppUserEntity } from "@domain-slayer/infrastructure";
import type { Logger } from "@domain-slayer/shared";

const SCRYPT_KEY_LEN = 64;

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

export type AuthedRequest = Request & { auth?: { userId: string; email: string } };

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
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Se requiere autenticación" });
    return;
  }
  try {
    const payload = jwt.verify(hdr.slice(7), secret) as { sub: string; email: string };
    (req as AuthedRequest).auth = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function registerAuthRoutes(r: Router, ds: DataSource): void {
  r.get("/auth/status", (_req, res) => {
    res.json({ authRequired: Boolean(process.env.JWT_SECRET?.trim()) });
  });

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
      const token = jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "8h" });
      res.json({
        token,
        expiresIn: 28_800,
        user: { email: user.email },
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
      createdAt: new Date(),
    });
    logger.info({ email }, "Usuario administrador inicial creado (INITIAL_ADMIN_*)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "No se pudo crear el administrador inicial");
  }
}
