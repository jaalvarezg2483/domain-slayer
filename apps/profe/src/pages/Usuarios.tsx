import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuthPublicUser, UserPeriodVigenciaRow } from '@/lib/ipc';
import { useAuth } from '@/contexts/AuthContext';
import { getElectronAuth } from '@/lib/electron-auth';
import { ipc } from '@/lib/ipc';
import { format } from 'date-fns';

export default function Usuarios() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState<AuthPublicUser[]>([]);
  const [loadError, setLoadError] = useState('');
  const [mailUrl, setMailUrl] = useState('');
  const [mailSecret, setMailSecret] = useState('');
  const [mailSaved, setMailSaved] = useState('');
  const [lookupUrl, setLookupUrl] = useState('');
  const [lookupSecret, setLookupSecret] = useState('');
  const [lookupSaved, setLookupSaved] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'profesor'>('profesor');
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [resetError, setResetError] = useState('');
  const [vigenciaFor, setVigenciaFor] = useState<AuthPublicUser | null>(null);
  const [vigenciaRows, setVigenciaRows] = useState<UserPeriodVigenciaRow[]>([]);
  const [vigenciaLoading, setVigenciaLoading] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const list = await getElectronAuth().listUsers();
      setUsers(list);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    }
  }, []);

  const loadMail = useCallback(async () => {
    try {
      const s = await getElectronAuth().getMailSettings();
      setMailUrl(s.url);
      setMailSecret('');
    } catch {
      /* ignore */
    }
  }, []);

  const loadPersonLookup = useCallback(async () => {
    try {
      const s = await ipc.personLookup.getSettings();
      setLookupUrl(s.url);
      setLookupSecret('');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    loadMail();
    loadPersonLookup();
  }, [load, loadMail, loadPersonLookup]);

  async function saveMail(e: React.FormEvent) {
    e.preventDefault();
    setMailSaved('');
    try {
      await getElectronAuth().setMailSettings({ url: mailUrl, secret: mailSecret });
      setMailSaved('Guardado. La clave solo se actualiza si la escribes de nuevo.');
      setMailSecret('');
      await loadMail();
    } catch (e: unknown) {
      setMailSaved(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function savePersonLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupSaved('');
    try {
      await ipc.personLookup.setSettings({ url: lookupUrl, secret: lookupSecret });
      setLookupSaved('Guardado. El secreto solo se actualiza si lo vuelves a escribir.');
      setLookupSecret('');
      await loadPersonLookup();
    } catch (e: unknown) {
      setLookupSaved(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    try {
      await getElectronAuth().createUser({
        email: newEmail,
        name: newName,
        password: newPassword,
        role: newRole,
      });
      setCreateOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('profesor');
      await load();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function changeRole(u: AuthPublicUser, role: 'admin' | 'profesor') {
    try {
      await getElectronAuth().updateUserRole(u.id, role);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetUserId == null) return;
    setResetError('');
    try {
      await getElectronAuth().adminSetPassword(resetUserId, resetPassword);
      setResetUserId(null);
      setResetPassword('');
      await load();
    } catch (e: unknown) {
      setResetError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function openVigencia(u: AuthPublicUser) {
    setVigenciaFor(u);
    setVigenciaLoading(true);
    try {
      const rows = await getElectronAuth().getUserPeriodVigencia(u.id);
      setVigenciaRows([...rows].sort((a, b) => b.startDate - a.startDate));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al cargar vigencia');
      setVigenciaFor(null);
      setVigenciaRows([]);
    } finally {
      setVigenciaLoading(false);
    }
  }

  async function changeVigencia(periodId: number, status: 'active' | 'inactive') {
    if (!vigenciaFor) return;
    try {
      await getElectronAuth().setUserPeriodVigencia(vigenciaFor.id, periodId, status);
      setVigenciaRows((prev) => prev.map((r) => (r.periodId === periodId ? { ...r, status } : r)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function removeUser(id: number) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await getElectronAuth().deleteUser(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  if (current?.role !== 'admin') {
    return <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>;
  }

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usuarios, correo y consulta por cédula</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona cuentas, vigencia por período académico (profesores inactivos no pueden entrar mientras la fecha de
          hoy caiga dentro de ese período) y el correo de recuperación vía Railway. Los administradores no quedan
          bloqueados por vigencia. Cada usuario tiene sus propios colegios, cursos y demás datos académicos; el rol
          administrador es para esta pantalla y acciones de cuenta, no para ver el trabajo de otros docentes.
        </p>
      </div>

      <section className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Servicio de correo (Railway)</h2>
        <p className="text-sm text-muted-foreground">
          URL pública de tu API desplegada (ej. https://tu-app.up.railway.app) y la misma clave que definiste como{' '}
          <code className="text-xs bg-muted px-1 rounded">MAIL_API_SECRET</code> en Railway. En el servidor usa{' '}
          <code className="text-xs bg-muted px-1 rounded">RESEND_API_KEY</code> y un remitente verificado.
        </p>
        <form onSubmit={saveMail} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="mailUrl">URL base del servicio</Label>
            <Input
              id="mailUrl"
              placeholder="https://gestor-mail-production.up.railway.app"
              value={mailUrl}
              onChange={(e) => setMailUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mailSecret">Clave compartida (MAIL_API_SECRET)</Label>
            <Input
              id="mailSecret"
              type="password"
              autoComplete="new-password"
              placeholder={mailSecret ? '••••••••' : 'Pega la clave secreta'}
              value={mailSecret}
              onChange={(e) => setMailSecret(e.target.value)}
            />
          </div>
          <Button type="submit">Guardar configuración de correo</Button>
          {mailSaved ? <p className="text-sm text-muted-foreground">{mailSaved}</p> : null}
        </form>
      </section>

      <section className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Consulta opcional por cédula (Costa Rica)</h2>
        <p className="text-sm text-muted-foreground">
          El Registro Civil no publica una API oficial abierta para apps. El TSE tiene{' '}
          <a
            href="https://servicioselectorales.tse.go.cr/chc/consulta_cedula.aspx"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            consulta web manual por cédula
          </a>
          . Aquí puedes configurar la URL de un <strong>proxy tuyo</strong> (o de un proveedor con contrato y
          cumplimiento legal) que responda en JSON. La app hará <code className="text-xs bg-muted px-1 rounded">GET</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{url}/{cedula}'}</code> y leerá campos como{' '}
          <code className="text-xs bg-muted px-1 rounded">fullName</code>,{' '}
          <code className="text-xs bg-muted px-1 rounded">nombreCompleto</code> o{' '}
          <code className="text-xs bg-muted px-1 rounded">nombre</code> + <code className="text-xs bg-muted px-1 rounded">apellido1</code>.
        </p>
        <form onSubmit={savePersonLookup} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="lookupUrl">URL base del servicio</Label>
            <Input
              id="lookupUrl"
              placeholder="https://tu-servidor.com/api/persona"
              value={lookupUrl}
              onChange={(e) => setLookupUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lookupSecret">Bearer token (opcional)</Label>
            <Input
              id="lookupSecret"
              type="password"
              autoComplete="new-password"
              placeholder={lookupSecret ? '••••••••' : 'Si tu proxy lo requiere'}
              value={lookupSecret}
              onChange={(e) => setLookupSecret(e.target.value)}
            />
          </div>
          <Button type="submit">Guardar consulta por cédula</Button>
          {lookupSaved ? <p className="text-sm text-muted-foreground">{lookupSaved}</p> : null}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Cuentas</h2>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Nuevo usuario
          </Button>
        </div>
        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
        <table className="ds-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>
                    <Select
                      value={u.role}
                      onValueChange={(v) => changeRole(u, v as 'admin' | 'profesor')}
                      disabled={u.id === current?.userId}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profesor">Profesor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openVigencia(u)}>
                      Vigencia
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setResetUserId(u.id)}>
                      Nueva contraseña
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={u.id === current?.userId}
                      onClick={() => removeUser(u.id)}
                    >
                      Eliminar
                    </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" required />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as 'admin' | 'profesor')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profesor">Profesor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Crear</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={vigenciaFor != null}
        onOpenChange={(o) => {
          if (!o) {
            setVigenciaFor(null);
            setVigenciaRows([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vigencia por período — {vigenciaFor?.name}</DialogTitle>
          </DialogHeader>
          {vigenciaFor?.role === 'admin' ? (
            <p className="text-sm text-muted-foreground">
              Este usuario es administrador: la vigencia no bloquea su acceso, pero puedes dejar configurado el estado
              por si cambia a profesor más adelante.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Por defecto todos los períodos son <strong>activos</strong>. Si marcas <strong>inactivo</strong>, ese
              usuario no podrá iniciar sesión mientras la fecha de hoy esté entre el inicio y el fin del período. Si
              hay varios períodos que se solapan y alguno está inactivo, tampoco podrá entrar.
            </p>
          )}
          {vigenciaLoading ? (
            <p className="text-sm text-muted-foreground">Cargando períodos…</p>
          ) : vigenciaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay períodos creados. Créalos en el menú Períodos.</p>
          ) : (
            <table className="ds-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Fechas</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {vigenciaRows.map((r) => {
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    const now = Date.now();
                    const enCurso = r.startDate <= now && r.endDate >= now;
                    return (
                      <tr key={r.periodId}>
                        <td>
                          {r.year} · {r.type}
                          {enCurso ? (
                            <span className="ml-2 text-xs text-primary font-medium">(incluye hoy)</span>
                          ) : null}
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')}
                        </td>
                        <td>
                          <Select
                            value={r.status}
                            onValueChange={(v) => changeVigencia(r.periodId, v as 'active' | 'inactive')}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Activo</SelectItem>
                              <SelectItem value="inactive">Inactivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetUserId != null} onOpenChange={(o) => !o && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva contraseña (administrador)</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReset} className="space-y-4">
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
