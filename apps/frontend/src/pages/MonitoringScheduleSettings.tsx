import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type MonitoringScheduleDto } from "../api";
import { ScheduleTimePicker } from "../components/ScheduleTimePicker";
import { Spinner } from "../components/Spinner";
import {
  WEEKDAY_CRON,
  defaultVisualState,
  dtoFieldsFromVisual,
  humanSummary,
  visualFromDto,
  type VisualRecurrence,
  type VisualScheduleState,
} from "../lib/monitoring-schedule-visual";

function emptyForm(): MonitoringScheduleDto {
  return {
    enabled: false,
    scheduleMode: "cron",
    cronExpression: "0 8 * * *",
    intervalDays: 7,
    runHour: 8,
    runMinute: 0,
    cronAlternateWeeks: false,
    isoWeekParity: null,
    cronFirstWeekOnly: false,
    notifyEmails: "",
    teamsWebhookUrl: null,
    notifyEmailEnabled: true,
    notifyTeamsEnabled: false,
    notifyOn: "alerts_only",
    lastScheduledRunAt: null,
    proximityDailyEnabled: false,
    proximityRunHour: 7,
    lastProximityDailyRunAt: null,
    updatedAt: "",
  };
}

function normalizeScheduleDto(dto: MonitoringScheduleDto): MonitoringScheduleDto {
  const n = Number(dto.intervalDays);
  const intervalDays = Number.isFinite(n) && n >= 1 ? Math.min(365, Math.floor(n)) : 15;
  const rm = Number(dto.runMinute);
  const runMinute = Number.isFinite(rm) ? Math.min(59, Math.max(0, Math.floor(rm))) : 0;
  const cronAlternateWeeks = Boolean(dto.cronAlternateWeeks);
  const ip = dto.isoWeekParity;
  const isoWeekParity = ip === 0 || ip === 1 ? ip : null;
  const cronFirstWeekOnly = Boolean(dto.cronFirstWeekOnly);
  const ph = Number(dto.proximityRunHour);
  const proximityRunHour = Number.isFinite(ph) ? Math.min(23, Math.max(0, Math.floor(ph))) : 7;
  return {
    ...dto,
    intervalDays,
    runMinute,
    cronAlternateWeeks,
    isoWeekParity: cronAlternateWeeks ? (isoWeekParity ?? 0) : isoWeekParity,
    cronFirstWeekOnly,
    notifyEmailEnabled: dto.notifyEmailEnabled !== false,
    notifyTeamsEnabled: Boolean(dto.notifyTeamsEnabled),
    proximityDailyEnabled: Boolean(dto.proximityDailyEnabled),
    proximityRunHour,
  };
}

function toggleWeekday(weekdays: number[], cron: number): number[] {
  const set = new Set(weekdays);
  if (set.has(cron)) set.delete(cron);
  else set.add(cron);
  return [...set].sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d);
    return order(a) - order(b);
  });
}

function SettingsCollapse(props: {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { id, title, subtitle, defaultOpen = false, children } = props;
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  return (
    <div className="settings-collapse">
      <button
        type="button"
        className="settings-collapse__trigger"
        id={headingId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="settings-collapse__trigger-text">
          <span className="settings-collapse__title">{title}</span>
          {subtitle ? <span className="settings-collapse__subtitle">{subtitle}</span> : null}
        </span>
        <span className="settings-collapse__chevron" aria-hidden>
          ›
        </span>
      </button>
      {open ? (
        <div className="settings-collapse__panel" id={panelId} role="region" aria-labelledby={headingId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MonitoringScheduleSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testBanner, setTestBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<MonitoringScheduleDto>(emptyForm);
  const [visual, setVisual] = useState<VisualScheduleState>(() => defaultVisualState());

  const load = useCallback(() => {
    setErr(null);
    setLoading(true);
    api.monitoringSchedule
      .get()
      .then((dto) => {
        const norm = normalizeScheduleDto(dto);
        setForm(norm);
        setVisual(visualFromDto(norm));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setErr(null);
    setTestBanner(null);
    setSaving(true);
    try {
      let sched: ReturnType<typeof dtoFieldsFromVisual>;
      try {
        sched = dtoFieldsFromVisual(visual);
      } catch (e) {
        setErr((e as Error).message);
        setSaving(false);
        return;
      }
      const dto = await api.monitoringSchedule.update({
        enabled: form.enabled,
        scheduleMode: sched.scheduleMode,
        cronExpression: sched.cronExpression,
        intervalDays: sched.intervalDays,
        runHour: sched.runHour,
        runMinute: sched.runMinute,
        cronAlternateWeeks: sched.cronAlternateWeeks,
        isoWeekParity: sched.isoWeekParity,
        cronFirstWeekOnly: sched.cronFirstWeekOnly,
        notifyEmails: form.notifyEmails,
        teamsWebhookUrl: form.teamsWebhookUrl?.trim() ? form.teamsWebhookUrl.trim() : null,
        notifyEmailEnabled: form.notifyEmailEnabled,
        notifyTeamsEnabled: form.notifyTeamsEnabled,
        notifyOn: form.notifyOn,
        proximityDailyEnabled: form.proximityDailyEnabled,
        proximityRunHour: form.proximityRunHour,
      });
      const norm = normalizeScheduleDto(dto);
      setForm(norm);
      setVisual(visualFromDto(norm));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testNotify = async () => {
    setErr(null);
    setTestBanner(null);
    if (!form.notifyEmailEnabled && !form.notifyTeamsEnabled) {
      setErr("Marque «Correo» o «Teams» para poder probar notificaciones.");
      return;
    }
    setTesting(true);
    try {
      const r = await api.monitoringSchedule.testNotify({
        notifyEmails: form.notifyEmails,
        teamsWebhookUrl: form.teamsWebhookUrl?.trim() ? form.teamsWebhookUrl.trim() : null,
        testEmail: form.notifyEmailEnabled,
        testTeams: form.notifyTeamsEnabled,
      });
      const parts: string[] = [];
      if (form.notifyEmailEnabled) parts.push(r.emailSent ? "Correo: enviado" : "Correo: no enviado");
      if (form.notifyTeamsEnabled) parts.push(r.teamsSent ? "Teams: enviado" : "Teams: no enviado");
      if (r.errors?.length) parts.push(...r.errors);
      const emailOk = !form.notifyEmailEnabled || Boolean(r.emailSent);
      const teamsOk = !form.notifyTeamsEnabled || Boolean(r.teamsSent);
      const ok = emailOk && teamsOk && !(r.errors?.length);
      setTestBanner({ text: parts.join(" · "), ok });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const canTestNotify = form.notifyEmailEnabled || form.notifyTeamsEnabled;

  const weekdaysApply =
    visual.recurrence === "weekly" ||
    visual.recurrence === "biweekly" ||
    visual.recurrence === "monthly_first";

  if (loading) {
    return (
      <div className="stack narrow">
        <h1>Programación</h1>
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="stack narrow">
      <h1>Programación</h1>
      <p className="muted small">
        Defina cuándo se ejecutan los chequeos automáticos y cómo recibir avisos. Use las secciones siguientes para
        desplegar u ocultar cada bloque.
      </p>

      {form.smtpConfigured === false && (
        <div
          className="card"
          role="status"
          style={{
            borderColor: "rgba(255, 159, 10, 0.45)",
            color: "var(--text-muted)",
          }}
        >
          <strong style={{ color: "var(--text)" }}>Correo en el servidor</strong>
          <p className="small" style={{ margin: "0.5rem 0 0" }}>
            El API que atiende esta página <strong>no</strong> ve la variable <code>SMTP_HOST</code> (por eso «Probar» no puede enviar
            correo). En local suele estar en <code>.env</code> en la raíz o en <code>apps/backend</code>; en Railway u otro PaaS hay que
            poner las variables en el <strong>servicio que ejecuta el backend Node</strong> (API), no solo en el build del frontend ni en
            otro contenedor. Nombres exactos y en mayúsculas: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_SECURE</code>{" "}
            (p. ej. <code>false</code> con puerto 587), <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>. Guarde en
            el panel, lance un <strong>nuevo deploy</strong> del servicio API y recargue esta página: el aviso debería desaparecer si el
            proceso ya recibe <code>SMTP_HOST</code>.
          </p>
        </div>
      )}

      {err && <div className="card error">{err}</div>}
      {testBanner && !err && (
        <div
          className="card"
          style={{
            borderColor: testBanner.ok ? "rgba(52, 199, 89, 0.35)" : "rgba(255, 159, 10, 0.45)",
            color: testBanner.ok ? undefined : "var(--text-muted)",
          }}
        >
          {testBanner.text}
        </div>
      )}

      <div className="row gap monitoring-schedule-actions" aria-label="Guardar o probar programación">
        <button
          type="button"
          className="btn schedule-save-btn"
          onClick={() => void save()}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? (
            <>
              <Spinner size="sm" />
              Guardando…
            </>
          ) : (
            "Guardar programación"
          )}
        </button>
        <button
          type="button"
          className="btn schedule-test-btn"
          onClick={() => void testNotify()}
          disabled={testing || !canTestNotify}
          title={!canTestNotify ? "Marque correo o Teams para probar" : undefined}
        >
          {testing ? (
            <>
              <Spinner size="sm" />
              Probando…
            </>
          ) : (
            "Probar"
          )}
        </button>
      </div>

      <SettingsCollapse
        id="monitoring-schedule-checks"
        title="Programación de chequeos"
        subtitle="Activar chequeos, frecuencia, días, hora y chequeo diario de sitios próximos a vencer."
      >
        <div className="form-grid">
        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Activar chequeos programados</span>
            <span className="muted small">Si está desactivado, no hay chequeos automáticos en esta programación.</span>
          </span>
        </label>

        <div className="span-2 schedule-assistant">
          <h2 className="schedule-assistant__title">Cuándo ejecutar el chequeo</h2>
          <p className="muted small schedule-assistant__intro">
            Indique con qué frecuencia y a qué hora deben ejecutarse los chequeos. El domingo cuenta como primer día de la
            semana en el calendario. El apartado de «sitios por vencer» es independiente y está más abajo.
          </p>

          <label className="span-2">
            Cada cuánto
            <select
              className="input"
              value={visual.recurrence}
              onChange={(e) =>
                setVisual((v) => ({ ...v, recurrence: e.target.value as VisualRecurrence }))
              }
            >
              <option value="daily">Diario (todos los días)</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Bisemanal (una semana sí, otra no)</option>
              <option value="monthly_first">Mensual (solo el primer Lun/Mar/… de ese día en el mes)</option>
              <option value="interval">Cada N días (desde el último chequeo)</option>
              <option value="custom">Avanzado (solo administradores)</option>
            </select>
          </label>

          <div className={`span-2${!weekdaysApply ? " schedule-weekdays--muted" : ""}`}>
            <span className="modal-notes-label-text" style={{ display: "block", marginBottom: "0.4rem" }}>
              Días de la semana
            </span>
            <div className="schedule-weekday-row" role="group" aria-label="Días de la semana">
              {WEEKDAY_CRON.map((w) => {
                const on = visual.weekdays.includes(w.cron);
                return (
                  <button
                    key={w.cron}
                    type="button"
                    className={`schedule-weekday-btn${on ? " schedule-weekday-btn--on" : ""}`}
                    aria-pressed={on}
                    disabled={!weekdaysApply}
                    onClick={() => setVisual((v) => ({ ...v, weekdays: toggleWeekday(v.weekdays, w.cron) }))}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <span className="muted small">
              {visual.recurrence === "daily"
                ? "En modo diario se ejecuta cada día; los días marcados no aplican."
                : visual.recurrence === "weekly"
                  ? "Se ejecuta cada semana en los días marcados."
                  : visual.recurrence === "biweekly"
                    ? "Solo en esos días, en semanas alternas (vea la opción de paridad abajo)."
                    : visual.recurrence === "monthly_first"
                      ? "Solo la primera aparición de cada día marcado dentro del mes (días 1–7 del calendario)."
                      : visual.recurrence === "interval"
                        ? "En «cada N días» no se usan los días de la semana."
                        : "En modo avanzado los días de la semana no se usan aquí."}
            </span>
          </div>

          {visual.recurrence === "biweekly" ? (
            <label className="span-2">
              En qué semanas alternas debe ejecutarse
              <select
                className="input"
                value={visual.biweeklyParity}
                onChange={(e) =>
                  setVisual((v) => ({ ...v, biweeklyParity: Number(e.target.value) === 1 ? 1 : 0 }))
                }
              >
                <option value={0}>Semanas con número par (2, 4, 6…)</option>
                <option value={1}>Semanas con número impar (1, 3, 5…)</option>
              </select>
              <span className="muted small">
                Si no coincide con el lunes (o el día) que esperaba, cambie esta opción y guarde de nuevo.
              </span>
            </label>
          ) : null}

          {visual.recurrence === "interval" ? (
            <label className="span-2">
              Cada cuántos días
              <input
                className="input"
                type="number"
                min={1}
                max={365}
                value={visual.intervalDays}
                onChange={(e) =>
                  setVisual((v) => ({
                    ...v,
                    intervalDays: Math.min(365, Math.max(1, Number(e.target.value) || 1)),
                  }))
                }
              />
              <span className="muted small">Cuenta desde el último chequeo programado; la hora es la del reloj de abajo.</span>
            </label>
          ) : null}

          <div className="span-2 schedule-time-row">
            <span className="modal-notes-label-text" style={{ display: "block", marginBottom: "0.4rem" }}>
              Hora de ejecución
            </span>
            <ScheduleTimePicker
              hour={visual.hour}
              minute={visual.minute}
              disabled={visual.recurrence === "custom"}
              onChange={({ hour: h, minute: m }) =>
                setVisual((v) => ({ ...v, hour: h, minute: m }))
              }
            />
            {visual.recurrence === "custom" ? (
              <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
                En modo avanzado, el horario lo fija el texto de programación de abajo; el reloj sirve solo de referencia.
              </span>
            ) : null}
          </div>

          {visual.recurrence === "custom" ? (
            <label className="span-2">
              Programación en formato técnico (uso avanzado)
              <input
                className="input"
                spellCheck={false}
                value={visual.customCron}
                onChange={(e) => setVisual((v) => ({ ...v, customCron: e.target.value }))}
                placeholder="0 8 * * 1"
              />
              <span className="muted small">
                Use este campo solo si quien administra el sistema le pasó el texto exacto de programación.
              </span>
            </label>
          ) : null}

          <p className="span-2 muted small schedule-assistant__summary" style={{ margin: 0 }}>
            <strong>Resumen:</strong> {humanSummary(visual) || "—"}
          </p>
        </div>

        <div
          className="span-2"
          style={{
            borderTop: "1px solid var(--border, rgba(255,255,255,0.08))",
            paddingTop: "1rem",
            marginTop: "0.25rem",
          }}
        >
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.25rem" }}>Chequeo diario (solo próximos a vencer)</h2>
          <p className="muted small" style={{ margin: "0 0 0.75rem" }}>
            Además del chequeo general, puede activar una revisión <strong>una vez al día</strong> solo para los sitios que
            en el panel aparecen como próximos a vencer (certificado o dominio). Así se detecta antes si ya renovaron. Si un
            sitio deja de estar en esa situación, puede recibir un aviso positivo por los mismos medios que configure abajo
            (correo o Teams), si los tiene activados.
          </p>
          <label className="span-2 form-checkbox-row">
            <input
              type="checkbox"
              checked={form.proximityDailyEnabled}
              onChange={(e) => setForm({ ...form, proximityDailyEnabled: e.target.checked })}
            />
            <span className="form-checkbox-row__text">
              <span className="form-checkbox-row__title">Activar chequeo diario de proximidad</span>
              <span className="muted small">No requiere tener activado el chequeo programado global.</span>
            </span>
          </label>
          <div className="span-2 schedule-time-row">
            <span className="modal-notes-label-text" style={{ display: "block", marginBottom: "0.4rem" }}>
              Hora del día
            </span>
            <ScheduleTimePicker
              hour={form.proximityRunHour}
              minute={0}
              hourOnly
              disabled={!form.proximityDailyEnabled}
              onChange={({ hour: h }) =>
                setForm({ ...form, proximityRunHour: Math.min(23, Math.max(0, h)) })
              }
            />
            <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
              Elija la hora en punto (como en el reloj de arriba). Coincide con el reloj de la instalación de esta aplicación.
            </span>
          </div>
        </div>
        </div>
      </SettingsCollapse>

      <SettingsCollapse
        id="monitoring-schedule-notify"
        title="Programación de notificaciones"
        subtitle="Correo, Microsoft Teams y cuándo enviar el aviso tras un chequeo."
      >
        <div className="form-grid">
        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.notifyEmailEnabled}
            onChange={(e) => setForm({ ...form, notifyEmailEnabled: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Correo electrónico</span>
            <span className="muted small">
              Escriba las direcciones separadas por coma o espacio. Si los mensajes no llegan, quien administra esta
              aplicación debe revisar la configuración de correo del sistema.
            </span>
          </span>
        </label>
        <label className="span-2">
          <span className="sr-only">Direcciones de correo</span>
          <textarea
            className="input"
            rows={2}
            spellCheck={false}
            placeholder="equipo@empresa.com, otro@empresa.com"
            value={form.notifyEmails}
            disabled={!form.notifyEmailEnabled}
            onChange={(e) => setForm({ ...form, notifyEmails: e.target.value })}
          />
        </label>

        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.notifyTeamsEnabled}
            onChange={(e) => setForm({ ...form, notifyTeamsEnabled: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Microsoft Teams</span>
            <span className="muted small">
              Reciba en Teams un resumen parecido al del correo: sitios, fechas y avisos importantes. Pegue el enlace que
              Microsoft Teams le dio para conectar avisos al canal (o el que le indique su equipo de TI).
            </span>
            <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
              Use «Probar» para comprobar que el enlace funciona antes de depender de los avisos automáticos.
            </span>
          </span>
        </label>
        <label className="span-2">
          <span className="sr-only">Enlace para avisos en Microsoft Teams</span>
          <input
            className="input"
            spellCheck={false}
            placeholder="Pegue aquí el enlace para avisos en Teams"
            value={form.teamsWebhookUrl ?? ""}
            disabled={!form.notifyTeamsEnabled}
            onChange={(e) =>
              setForm({ ...form, teamsWebhookUrl: e.target.value.trim() ? e.target.value.trim() : null })
            }
          />
        </label>

        <label className="span-2">
          Cuándo enviar notificación
          <select
            className="input"
            value={form.notifyOn}
            onChange={(e) => setForm({ ...form, notifyOn: e.target.value as "always" | "alerts_only" })}
          >
            <option value="alerts_only">
              Solo si hay alertas abiertas o sitios en ventana de vencimiento del panel (si no, no se envía nada)
            </option>
            <option value="always">Siempre tras cada chequeo programado</option>
          </select>
        </label>
        </div>
      </SettingsCollapse>

      {(form.lastScheduledRunAt || form.lastProximityDailyRunAt || form.updatedAt) && (
        <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
          Último chequeo general:{" "}
          {form.lastScheduledRunAt ? new Date(form.lastScheduledRunAt).toLocaleString() : "—"}
          {" · "}
          Último chequeo diario (sitios por vencer):{" "}
          {form.lastProximityDailyRunAt ? new Date(form.lastProximityDailyRunAt).toLocaleString() : "—"}
          {form.updatedAt && (
            <>
              {" "}
              · Ajustes guardados: {new Date(form.updatedAt).toLocaleString()}
            </>
          )}
        </p>
      )}
    </div>
  );
}
