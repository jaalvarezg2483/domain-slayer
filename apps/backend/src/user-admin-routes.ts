import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import type { Router, Request, Response, NextFunction } from "express";
import { AppUserEntity } from "@domain-slayer/infrastructure";
import { hashPassword, type AuthedRequest } from "./auth-http.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function registerUserAdminRoutes(r: Router, ds: DataSource): void {
  const gate = (_req: Request, res: Response, next: NextFunction): void => {
    if (!process.env.JWT_SECRET?.trim()) {
      res.status(503).json({ error: "Configure JWT_SECRET en el servidor para gestionar usuarios." });
      return;
    }
    next();
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as AuthedRequest).auth) {
      res.status(401).json({ error: "Se requiere autenticación" });
      return;
    }
    next();
  };

  r.get("/users", gate, requireAuth, async (_req, res, next) => {
    try {
      const repo = ds.getRepository(AppUserEntity);
      const rows = await repo.find({ order: { createdAt: "ASC" } });
      res.json({
        items: rows.map((u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.createdAt.toISOString(),
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/users", gate, requireAuth, async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password ?? "");
      if (!email || !EMAIL_RE.test(email)) {
        res.status(400).json({ error: "Indique un correo electrónico válido." });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
        return;
      }
      const repo = ds.getRepository(AppUserEntity);
      const exists = await repo.findOne({ where: { email } });
      if (exists) {
        res.status(409).json({ error: "Ya existe un usuario con ese correo." });
        return;
      }
      await repo.insert({
        id: randomUUID(),
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date(),
      });
      res.status(201).json({ ok: true, email });
    } catch (e) {
      next(e);
    }
  });

  r.patch("/users/:id", gate, requireAuth, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const password = String(req.body?.password ?? "");
      if (!id) {
        res.status(400).json({ error: "Usuario no válido." });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
        return;
      }
      const repo = ds.getRepository(AppUserEntity);
      const row = await repo.findOne({ where: { id } });
      if (!row) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }
      row.passwordHash = hashPassword(password);
      await repo.save(row);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.delete("/users/:id", gate, requireAuth, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const auth = (req as AuthedRequest).auth;
      if (!id || !auth) {
        res.status(400).json({ error: "Solicitud no válida." });
        return;
      }
      if (id === auth.userId) {
        res.status(400).json({ error: "No puede eliminar su propio usuario mientras tenga la sesión iniciada." });
        return;
      }
      const repo = ds.getRepository(AppUserEntity);
      const n = await repo.count();
      if (n <= 1) {
        res.status(400).json({ error: "No puede eliminar el último usuario del sistema." });
        return;
      }
      const result = await repo.delete({ id });
      if (!result.affected) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
