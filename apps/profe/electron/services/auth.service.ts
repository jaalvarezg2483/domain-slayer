import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { AppUserRepository } from '../database/repositories/app-user.repository.js';
import type { PeriodRepository } from '../database/repositories/period.repository.js';
import type { AppUserPeriodStatusRepository } from '../database/repositories/app-user-period-status.repository.js';
import type { AppUserRole } from '../database/schema.js';
import type { DataScope } from '../database/data-scope.js';
import * as authStore from '../auth-store.js';

export type AuthServiceDeps = {
  periodRepo: PeriodRepository;
  periodStatusRepo: AppUserPeriodStatusRepository;
};

function periodsContainingDate(periodRepo: PeriodRepository, when: Date, scope: DataScope) {
  return periodRepo.getAll(scope).filter((p) => p.startDate <= when && p.endDate >= when);
}

/** Los administradores no quedan bloqueados por vigencia (pueden corregirla en Usuarios). */
function isProfesorAllowedForCurrentPeriods(
  userId: number,
  role: string,
  periodRepo: PeriodRepository,
  statusRepo: AppUserPeriodStatusRepository,
): boolean {
  if (role === 'admin') return true;
  const scope: DataScope = { userId };
  const currents = periodsContainingDate(periodRepo, new Date(), scope);
  if (currents.length === 0) return true;
  for (const p of currents) {
    if (statusRepo.getEffectiveStatus(userId, p.id) === 'inactive') {
      return false;
    }
  }
  return true;
}

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_HOURS = 1;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function requireAdmin() {
  const s = authStore.getSession();
  if (!s || s.role !== 'admin') {
    throw new Error('No autorizado');
  }
}

function toPublicUser(row: { id: number; email: string; fullName: string; role: string }) {
  return {
    id: row.id,
    email: row.email,
    name: row.fullName,
    role: row.role as AppUserRole,
  };
}

export function createAuthService(repo: AppUserRepository, deps: AuthServiceDeps) {
  const { periodRepo, periodStatusRepo } = deps;

  return {
    getBootstrap() {
      try {
        const count = repo.count();
        let session = authStore.getSession();
        try {
          if (
            session &&
            !isProfesorAllowedForCurrentPeriods(
              session.userId,
              session.role,
              periodRepo,
              periodStatusRepo,
            )
          ) {
            authStore.setSession(null);
            session = null;
          }
        } catch (vigenciaErr) {
          console.error('[auth] getBootstrap: error comprobando vigencia por período', vigenciaErr);
        }
        return {
          hasUsers: count > 0,
          user: session,
        };
      } catch (e) {
        console.error('[auth] getBootstrap: error leyendo app_users', e);
        const session = authStore.getSession();
        return { hasUsers: true, user: session };
      }
    },

    register(input: { email: string; name: string; password: string }) {
      if (repo.count() > 0) {
        throw new Error('Ya hay usuarios registrados. Inicie sesión o pida acceso a un administrador.');
      }
      const passwordHash = bcrypt.hashSync(input.password, BCRYPT_ROUNDS);
      const row = repo.create({
        email: input.email,
        fullName: input.name,
        passwordHash,
        role: 'admin',
      });
      if (!row) throw new Error('No se pudo crear el usuario');
      const session = {
        userId: row.id,
        email: row.email,
        name: row.fullName,
        role: 'admin' as const,
      };
      authStore.setSession(session);
      return { user: toPublicUser(row) };
    },

    login(input: { email: string; password: string }) {
      const row = repo.getByEmail(input.email);
      if (!row) {
        throw new Error(
          'No hay ninguna cuenta con ese correo. Debe ser el mismo correo con el que te registraste (no uses otro usuario). Si reinstalaste la app o borraste la base de datos, tendrás que volver a crear el administrador.',
        );
      }
      if (!bcrypt.compareSync(input.password, row.passwordHash)) {
        throw new Error(
          'La contraseña no coincide. Revisa mayúsculas, números y que no haya espacios de más. Si no la recuerdas: «¿Olvidaste tu contraseña?» o un administrador puede poner una nueva en Usuarios.',
        );
      }
      if (!isProfesorAllowedForCurrentPeriods(row.id, row.role, periodRepo, periodStatusRepo)) {
        throw new Error(
          'Tu cuenta está inactiva para el período académico actual (fechas del período que incluyen hoy). Un administrador puede activarla en Usuarios → Vigencia por período.',
        );
      }
      const session = {
        userId: row.id,
        email: row.email,
        name: row.fullName,
        role: row.role as 'admin' | 'profesor',
      };
      authStore.setSession(session);
      return { user: toPublicUser(row) };
    },

    logout() {
      authStore.setSession(null);
      return { ok: true as const };
    },

    async forgotPassword(email: string) {
      const row = repo.getByEmail(email);
      if (!row) {
        return { ok: true as const, emailSent: false, message: 'Si el correo existe, recibirás instrucciones.' };
      }
      repo.deleteResetTokensForUser(row.id);
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000);
      repo.insertResetToken(row.id, tokenHash, expiresAt);

      const { url, secret } = authStore.getMailConfig();
      if (!url || !secret) {
        return {
          ok: true as const,
          emailSent: false,
          message:
            'Servicio de correo no configurado. Un administrador puede restablecer tu contraseña en Usuarios, o configura la URL y clave del servicio (Railway) en Ajustes > Correo.',
        };
      }

      const endpoint = `${url}/api/send-reset-email`;
      const subject = 'Recuperar contraseña — Gestor Académico';
      const html = `
        <p>Hola ${escapeHtml(row.fullName)},</p>
        <p>Usa este código en la aplicación <strong>Gestor Académico</strong>, pantalla <em>Restablecer contraseña</em>:</p>
        <p style="font-size:18px;font-family:monospace;letter-spacing:2px;">${token}</p>
        <p>Caduca en ${RESET_TOKEN_HOURS} hora(s).</p>
        <p>Si no solicitaste esto, ignora este mensaje.</p>
      `;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            to: row.email,
            subject,
            html,
            text: `Código de recuperación (Gestor Académico): ${token}\nCaduca en ${RESET_TOKEN_HOURS} hora(s).`,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        return {
          ok: true as const,
          emailSent: true,
          message: 'Revisa tu correo para el código de recuperación.',
        };
      } catch (e: any) {
        console.error('Error enviando correo de recuperación:', e);
        throw new Error(
          `No se pudo enviar el correo (${e?.message || 'error'}). Verifica URL del servicio y variables en Railway.`,
        );
      }
    },

    resetPassword(input: { token: string; newPassword: string }) {
      const tokenHash = hashToken(input.token.trim());
      const userId = repo.findUserIdByValidToken(tokenHash);
      if (!userId) {
        throw new Error('Código inválido o expirado');
      }
      const passwordHash = bcrypt.hashSync(input.newPassword, BCRYPT_ROUNDS);
      repo.update(userId, { passwordHash });
      repo.deleteResetTokenByHash(tokenHash);
      repo.deleteResetTokensForUser(userId);
      return { ok: true as const };
    },

    listUsers() {
      requireAdmin();
      return repo.getAll().map((u) => toPublicUser({ ...u, fullName: u.fullName }));
    },

    createUser(input: { email: string; name: string; password: string; role: AppUserRole }) {
      requireAdmin();
      if (repo.getByEmail(input.email)) {
        throw new Error('Ya existe un usuario con ese correo');
      }
      const passwordHash = bcrypt.hashSync(input.password, BCRYPT_ROUNDS);
      const row = repo.create({
        email: input.email,
        fullName: input.name,
        passwordHash,
        role: input.role,
      });
      if (!row) throw new Error('No se pudo crear el usuario');
      return toPublicUser(row);
    },

    updateUserRole(userId: number, role: AppUserRole) {
      requireAdmin();
      const self = authStore.getSession();
      if (self && self.userId === userId && role !== 'admin') {
        throw new Error('No puedes quitarte el rol administrador a ti mismo');
      }
      const row = repo.update(userId, { role });
      if (!row) throw new Error('Usuario no encontrado');
      return toPublicUser(row);
    },

    adminSetPassword(userId: number, newPassword: string) {
      requireAdmin();
      const passwordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
      const row = repo.update(userId, { passwordHash });
      if (!row) throw new Error('Usuario no encontrado');
      return { ok: true as const };
    },

    deleteUser(userId: number) {
      requireAdmin();
      const self = authStore.getSession();
      if (self && self.userId === userId) {
        throw new Error('No puedes eliminar tu propia cuenta');
      }
      repo.delete(userId);
      return { ok: true as const };
    },

    getMailSettings() {
      requireAdmin();
      const { url, secret } = authStore.getMailConfig();
      return { url, hasSecret: Boolean(secret) };
    },

    setMailSettings(input: { url: string; secret: string }) {
      requireAdmin();
      authStore.setMailConfig(input.url, input.secret);
      return { ok: true as const };
    },

    getUserPeriodVigencia(userId: number) {
      requireAdmin();
      const target = repo.getById(userId);
      if (!target) throw new Error('Usuario no encontrado');
      const periodScope: DataScope = { userId: target.id };
      const allPeriods = periodRepo.getAll(periodScope);
      return allPeriods.map((p) => ({
        periodId: p.id,
        year: p.year,
        type: p.type,
        startDate: p.startDate.getTime(),
        endDate: p.endDate.getTime(),
        status: periodStatusRepo.getEffectiveStatus(userId, p.id),
      }));
    },

    setUserPeriodVigencia(userId: number, periodId: number, status: 'active' | 'inactive') {
      requireAdmin();
      const target = repo.getById(userId);
      if (!target) throw new Error('Usuario no encontrado');
      const periodScope: DataScope = { userId: target.id };
      if (!periodRepo.getById(periodScope, periodId)) throw new Error('Período no encontrado');
      periodStatusRepo.setStatus(userId, periodId, status);
      return { ok: true as const };
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
