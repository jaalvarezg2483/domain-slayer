import { eq, sql } from 'drizzle-orm';
import { appUsers, passwordResetTokens } from '../schema.js';
import type { Database } from '../db.js';
import type { AppUserRole } from '../schema.js';

export type AppUserRow = typeof appUsers.$inferSelect;

export class AppUserRepository {
  constructor(private db: Database) {}

  count(): number {
    const r = this.db.select({ c: sql<number>`count(*)` }).from(appUsers).get();
    return Number(r?.c ?? 0);
  }

  getAll() {
    return this.db
      .select({
        id: appUsers.id,
        email: appUsers.email,
        fullName: appUsers.fullName,
        role: appUsers.role,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt,
      })
      .from(appUsers)
      .all();
  }

  getById(id: number) {
    return this.db.select().from(appUsers).where(eq(appUsers.id, id)).get();
  }

  getByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.db.select().from(appUsers).where(eq(appUsers.email, normalized)).get();
  }

  create(data: {
    email: string;
    fullName: string;
    passwordHash: string;
    role: AppUserRole;
  }) {
    const now = new Date();
    const normalized = data.email.trim().toLowerCase();
    return this.db
      .insert(appUsers)
      .values({
        email: normalized,
        fullName: data.fullName.trim(),
        passwordHash: data.passwordHash,
        role: data.role,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(id: number, data: Partial<{ fullName: string; role: AppUserRole; passwordHash: string }>) {
    return this.db
      .update(appUsers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, id))
      .returning()
      .get();
  }

  delete(id: number) {
    return this.db.delete(appUsers).where(eq(appUsers.id, id)).run();
  }

  deleteResetTokensForUser(userId: number) {
    return this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)).run();
  }

  insertResetToken(userId: number, tokenHash: string, expiresAt: Date) {
    const now = new Date();
    return this.db
      .insert(passwordResetTokens)
      .values({
        userId,
        tokenHash,
        expiresAt,
        createdAt: now,
      })
      .returning()
      .get();
  }

  findUserIdByValidToken(tokenHash: string): number | null {
    const row = this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .get();
    if (!row || row.expiresAt.getTime() < Date.now()) return null;
    return row.userId;
  }

  deleteResetTokenByHash(tokenHash: string) {
    return this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).run();
  }
}
