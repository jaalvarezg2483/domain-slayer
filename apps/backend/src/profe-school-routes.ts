import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import type { Router, Request, Response, NextFunction } from "express";
import { ProfeSchoolEntity } from "@domain-slayer/infrastructure";
import type { AuthedRequest } from "./auth-http.js";

function requireJwtUser(req: Request, res: Response, next: NextFunction): void {
  if (!process.env.JWT_SECRET?.trim()) {
    res.status(503).json({ error: "Configure JWT_SECRET en el servidor para guardar datos de Inventario Profe." });
    return;
  }
  const u = (req as AuthedRequest).auth;
  if (!u?.userId) {
    res.status(401).json({ error: "Se requiere autenticación" });
    return;
  }
  next();
}

function toDto(e: ProfeSchoolEntity) {
  return {
    id: e.id,
    name: e.name,
    logoPath: e.logoPath ?? "",
    reportHeader: e.reportHeader ?? "",
    reportFooter: e.reportFooter ?? "",
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function registerProfeSchoolRoutes(r: Router, ds: DataSource): void {
  r.get("/profe/schools", requireJwtUser, async (req, res, next) => {
    try {
      const userId = (req as AuthedRequest).auth!.userId;
      const repo = ds.getRepository(ProfeSchoolEntity);
      const rows = await repo.find({ where: { ownerUserId: userId }, order: { name: "ASC" } });
      res.json({ items: rows.map(toDto) });
    } catch (e) {
      next(e);
    }
  });

  r.post("/profe/schools", requireJwtUser, async (req, res, next) => {
    try {
      const userId = (req as AuthedRequest).auth!.userId;
      const name = String(req.body?.name ?? "").trim();
      if (!name) {
        res.status(400).json({ error: "Indique el nombre de la institución." });
        return;
      }
      const logoPath = req.body?.logoPath != null ? String(req.body.logoPath) : "";
      const reportHeader = req.body?.reportHeader != null ? String(req.body.reportHeader) : "";
      const reportFooter = req.body?.reportFooter != null ? String(req.body.reportFooter) : "";
      const now = new Date();
      const row = ds.getRepository(ProfeSchoolEntity).create({
        id: randomUUID(),
        ownerUserId: userId,
        name,
        logoPath: logoPath || null,
        reportHeader: reportHeader || null,
        reportFooter: reportFooter || null,
        createdAt: now,
        updatedAt: now,
      });
      await ds.getRepository(ProfeSchoolEntity).save(row);
      res.status(201).json(toDto(row));
    } catch (e) {
      next(e);
    }
  });

  r.patch("/profe/schools/:id", requireJwtUser, async (req, res, next) => {
    try {
      const userId = (req as AuthedRequest).auth!.userId;
      const id = String(req.params.id ?? "").trim();
      if (!id) {
        res.status(400).json({ error: "Institución no válida." });
        return;
      }
      const repo = ds.getRepository(ProfeSchoolEntity);
      const row = await repo.findOne({ where: { id, ownerUserId: userId } });
      if (!row) {
        res.status(404).json({ error: "Institución no encontrada." });
        return;
      }
      if (req.body?.name !== undefined) row.name = String(req.body.name).trim() || row.name;
      if (req.body?.logoPath !== undefined) row.logoPath = String(req.body.logoPath) || null;
      if (req.body?.reportHeader !== undefined) row.reportHeader = String(req.body.reportHeader) || null;
      if (req.body?.reportFooter !== undefined) row.reportFooter = String(req.body.reportFooter) || null;
      row.updatedAt = new Date();
      await repo.save(row);
      res.json(toDto(row));
    } catch (e) {
      next(e);
    }
  });

  r.delete("/profe/schools/:id", requireJwtUser, async (req, res, next) => {
    try {
      const userId = (req as AuthedRequest).auth!.userId;
      const id = String(req.params.id ?? "").trim();
      if (!id) {
        res.status(400).json({ error: "Institución no válida." });
        return;
      }
      const result = await ds.getRepository(ProfeSchoolEntity).delete({ id, ownerUserId: userId });
      if (!result.affected) {
        res.status(404).json({ error: "Institución no encontrada." });
        return;
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
