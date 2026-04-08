import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { Spinner } from "../components/Spinner";
import { readAuthPayload, setSessionDisplayName } from "../lib/auth-session";

type Row = { id: string; email: string; displayName: string; role: string; createdAt: string };

function roleLabel(r: string): string {
  return r === "viewer" ? "Visor" : "Administrador";
}

export function UsersSettings() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [creating, setCreating] = useState(false);

  const [pwdUserId, setPwdUserId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [editUser, setEditUser] = useState<Row | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "viewer">("viewer");
  const [editBusy, setEditBusy] = useState(false);

  const [userPendingDelete, setUserPendingDelete] = useState<{ id: string; email: string } | null>(null);
  const [userDeleteBusy, setUserDeleteBusy] = useState(false);

  const selfId = readAuthPayload()?.sub ?? null;

  const load = useCallback(() => {
    setErr(null);
    setOk(null);
    setLoading(true);
    api.users
      .list()
      .then((r) => {
        setItems(r.items ?? []);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async () => {
    setErr(null);
    setOk(null);
    setCreating(true);
    try {
      await api.users.create({
        email: newEmail.trim(),
        password: newPass,
        displayName: newDisplayName.trim() || undefined,
        role: newRole,
      });
      setOk(`Usuario ${newEmail.trim()} creado.`);
      setNewEmail("");
      setNewPass("");
      setNewDisplayName("");
      setNewRole("viewer");
      void load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const executeRemoveUser = async () => {
    const u = userPendingDelete;
    if (!u) return;
    setUserDeleteBusy(true);
    setErr(null);
    setOk(null);
    try {
      await api.users.remove(u.id);
      setUserPendingDelete(null);
      setOk("Usuario eliminado.");
      void load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUserDeleteBusy(false);
    }
  };

  const savePwd = async () => {
    if (!pwdUserId || pwdValue.length < 8) return;
    setPwdBusy(true);
    setErr(null);
    setOk(null);
    try {
      await api.users.update(pwdUserId, { password: pwdValue });
      setOk("Contraseña actualizada.");
      setPwdUserId(null);
      setPwdValue("");
      void load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPwdBusy(false);
    }
  };

  const openEdit = (u: Row) => {
    setEditUser(u);
    setEditDisplayName(u.displayName?.trim() || u.email.split("@")[0] || "");
    setEditRole(u.role === "viewer" ? "viewer" : "admin");
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditBusy(true);
    setErr(null);
    setOk(null);
    try {
      await api.users.update(editUser.id, {
        displayName: editDisplayName.trim(),
        role: editRole,
      });
      if (editUser.id === selfId) {
        setSessionDisplayName(editDisplayName.trim() || null);
      }
      setOk("Usuario actualizado.");
      setEditUser(null);
      void load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="stack narrow">
        <h1>Usuarios autorizados</h1>
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="stack narrow">
      <h1>Usuarios autorizados</h1>

      {err ? <div className="card error">{err}</div> : null}
      {ok ? (
        <div className="card" style={{ borderColor: "rgba(52, 199, 89, 0.35)" }}>
          {ok}
        </div>
      ) : null}

      <div className="card form-grid">
        <h2 className="span-2" style={{ fontSize: "1.05rem", margin: 0 }}>
          Añadir usuario
        </h2>
        <label>
          Nombre en pantalla (obligatorio; es el que sale en el menú)
          <input
            className="input"
            type="text"
            autoComplete="name"
            required
            placeholder="Ej. María García"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
          />
        </label>
        <label>
          Rol
          <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}>
            <option value="viewer">Visor (solo lectura en sitios, documentos y alertas)</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label>
          Correo
          <input className="input" type="email" autoComplete="off" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </label>
        <label>
          Contraseña (mín. 8 caracteres)
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
        </label>
        <div className="span-2">
          <button
            type="button"
            className="btn schedule-save-btn"
            disabled={
              creating || newEmail.trim().length < 3 || newPass.length < 8 || !newDisplayName.trim()
            }
            onClick={() => void createUser()}
          >
            {creating ? (
              <>
                <Spinner size="sm" />
                Creando…
              </>
            ) : (
              "Crear usuario"
            )}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>Usuarios actuales</h2>
        {items.length === 0 ? (
          <p className="muted small">No hay usuarios todavía. Puede crear el primero con el formulario de arriba.</p>
        ) : (
          <ul className="users-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((u) => (
              <li key={u.id} className="users-list__row">
                <div>
                  <strong>{u.displayName?.trim() || u.email}</strong>
                  <span className="muted small" style={{ display: "block" }}>
                    {u.email} · {roleLabel(u.role)}
                  </span>
                  <span className="muted small" style={{ display: "block" }}>
                    Alta: {new Date(u.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="users-list__actions">
                  <button type="button" className="btn small schedule-test-btn" onClick={() => openEdit(u)}>
                    Nombre y rol
                  </button>
                  <button type="button" className="btn small schedule-test-btn" onClick={() => setPwdUserId(u.id)}>
                    Cambiar contraseña
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    disabled={u.id === selfId || items.length <= 1}
                    title={u.id === selfId ? "No puede eliminar su propio usuario aquí" : undefined}
                    onClick={() => setUserPendingDelete({ id: u.id, email: u.email })}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editUser ? (
        <div className="card form-grid">
          <h3 className="span-2" style={{ fontSize: "1rem", margin: 0 }}>
            Editar {editUser.email}
          </h3>
          <label>
            Nombre (pantalla)
            <input
              className="input"
              type="text"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
            />
          </label>
          <label>
            Rol
            <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value as "admin" | "viewer")}>
              <option value="viewer">Visor</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <div className="span-2 row gap">
            <button
              type="button"
              className="btn schedule-save-btn"
              disabled={editBusy}
              onClick={() => void saveEdit()}
            >
              {editBusy ? <Spinner size="sm" /> : null}
              Guardar cambios
            </button>
            <button type="button" className="btn schedule-test-btn" onClick={() => setEditUser(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {pwdUserId ? (
        <div className="card form-grid">
          <h3 className="span-2" style={{ fontSize: "1rem", margin: 0 }}>
            Nueva contraseña
          </h3>
          <label className="span-2">
            <span className="sr-only">Nueva contraseña</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
            />
          </label>
          <div className="span-2 row gap">
            <button
              type="button"
              className="btn schedule-save-btn"
              disabled={pwdBusy || pwdValue.length < 8}
              onClick={() => void savePwd()}
            >
              {pwdBusy ? <Spinner size="sm" /> : null}
              Guardar
            </button>
            <button
              type="button"
              className="btn schedule-test-btn"
              onClick={() => {
                setPwdUserId(null);
                setPwdValue("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={userPendingDelete !== null}
        title="Eliminar usuario"
        message={
          userPendingDelete ? (
            <>
              ¿Eliminar la cuenta <strong>{userPendingDelete.email}</strong>? No podrá volver a iniciar sesión.
            </>
          ) : null
        }
        tone="danger"
        confirmLabel="Eliminar usuario"
        cancelLabel="Cancelar"
        busy={userDeleteBusy}
        busyLabel="Eliminando…"
        onCancel={() => {
          if (!userDeleteBusy) setUserPendingDelete(null);
        }}
        onConfirm={() => void executeRemoveUser()}
      />
    </div>
  );
}
