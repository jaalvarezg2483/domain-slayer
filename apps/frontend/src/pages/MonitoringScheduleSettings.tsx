import { useCallback, useEffect, useState } from "react";
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
  return {
    ...dto,
    intervalDays,
    runMinute,
    cronAlternateWeeks,
    isoWeekParity: cronAlternateWeeks ? (isoWeekParity ?? 0) : isoWeekParity,
    cronFirstWeekOnly,
    notifyEmailEnabled: dto.notifyEmailEnabled !== false,
    notifyTeamsEnabled: Boolean(dto.notifyTeamsEnabled),
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

export function MonitoringScheduleSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
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
    setTestMsg(null);
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
    setTestMsg(null);
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
      setTestMsg(parts.join(" · "));
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
        <h1>Programación de chequeos</h1>
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="stack narrow">
      <h1>Programación de chequeos</h1>
      <p className="muted small">
        Los chequeos automáticos usan la misma lógica que «Chequear todos» (solo sitios activos). La hora y el calendario
        siguen la zona horaria del servidor donde corre el backend. Tras cada run verá la fecha en «Último chequeo
        programado» abajo y en el pie del correo (hora del servidor). Una alerta de SSL o dominio «crítica» es cuando
        quedan menos de 3 días (0, 1 o 2); a partir de 3 días es advertencia hasta el siguiente chequeo.
      </p>

      {err && <div className="card error">{err}</div>}
      {testMsg && !err && <div className="card" style={{ borderColor: "rgba(52, 199, 89, 0.35)" }}>{testMsg}</div>}

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

      <div className="card form-grid">
        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Activar chequeos programados</span>
            <span className="muted small">Si está desactivado, no se ejecutan runs automáticos.</span>
          </span>
        </label>

        <div className="span-2 schedule-assistant">
          <h2 className="schedule-assistant__title">Cuándo ejecutar el chequeo</h2>
          <p className="muted small schedule-assistant__intro">
            Marque los días, elija cada cuánto y la hora exacta. El servidor usa node-cron en su zona horaria (0 = domingo).
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
              <option value="biweekly">Bisemanal (una semana sí, otra no — por número de semana ISO)</option>
              <option value="monthly_first">Mensual (solo el primer Lun/Mar/… de ese día en el mes)</option>
              <option value="interval">Cada N días (desde el último chequeo)</option>
              <option value="custom">Avanzado: cron manual</option>
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
                        : "En cron manual los días no se usan aquí."}
            </span>
          </div>

          {visual.recurrence === "biweekly" ? (
            <label className="span-2">
              Semanas en las que corre (ISO)
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
                En modo avanzado la hora la define la expresión cron; el reloj solo actualiza los campos auxiliares del
                servidor.
              </span>
            ) : null}
          </div>

          {visual.recurrence === "custom" ? (
            <label className="span-2">
              Expresión cron (5 campos: minuto hora día-mes mes día-semana)
              <input
                className="input"
                spellCheck={false}
                value={visual.customCron}
                onChange={(e) => setVisual((v) => ({ ...v, customCron: e.target.value }))}
                placeholder="0 8 * * 1"
              />
              <span className="muted small">
                Ej.: <code style={{ color: "var(--muted)" }}>0 8 * * 1</code> = lunes 08:00.{" "}
                <a href="https://github.com/node-cron/node-cron#cron-syntax" target="_blank" rel="noreferrer">
                  Sintaxis node-cron
                </a>
                .
              </span>
            </label>
          ) : null}

          <p className="span-2 muted small schedule-assistant__summary" style={{ margin: 0 }}>
            <strong>Resumen:</strong> {humanSummary(visual) || "—"}
          </p>
        </div>

        <div className="span-2">
          <h2 style={{ fontSize: "1.05rem", margin: "0.5rem 0 0.25rem" }}>Notificaciones tras el chequeo programado</h2>
          <p className="muted small" style={{ margin: "0 0 0.75rem" }}>
            Active solo los canales que desee. La prueba usa exactamente lo que tenga marcado.
          </p>
        </div>

        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.notifyEmailEnabled}
            onChange={(e) => setForm({ ...form, notifyEmailEnabled: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Correo electrónico</span>
            <span className="muted small">
              Destinatarios separados por coma o espacio. En el servidor, configure SMTP en un archivo{" "}
              <code style={{ color: "var(--muted)" }}>.env</code> (vea <code style={{ color: "var(--muted)" }}>.env.example</code> en la raíz del
              proyecto: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) y reinicie el backend.
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
              El backend envía un POST con JSON al estilo <strong>MessageCard</strong> (conectores clásicos: webhook
              entrante del canal). Eso es lo más directo: pegue la URL del webhook aquí.
            </span>
            <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
              <strong>Power Automate:</strong> puede usar un flujo con desencadenador HTTP que reciba el mismo POST y una
              acción «Publicar en un chat o canal de Teams» (o reenviar el cuerpo). La URL que debe guardar en esta app es
              la del flujo (solicitud HTTP), no sustituye al webhook salvo que el flujo exponga un extremo compatible. Use
              «Probar» con Teams marcado para validar.
            </span>
          </span>
        </label>
        <label className="span-2">
          <span className="sr-only">URL del webhook de Teams o flujo Power Automate</span>
          <input
            className="input"
            spellCheck={false}
            placeholder="https://outlook.office.com/webhook/… o URL del desencadenador HTTP de Power Automate"
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
            <option value="alerts_only">Solo si hay alertas abiertas tras el chequeo</option>
            <option value="always">Siempre tras cada chequeo programado</option>
          </select>
        </label>

        {(form.lastScheduledRunAt || form.updatedAt) && (
          <p className="span-2 muted small" style={{ margin: 0 }}>
            Último chequeo programado:{" "}
            {form.lastScheduledRunAt ? new Date(form.lastScheduledRunAt).toLocaleString() : "—"}
            {form.updatedAt && (
              <>
                {" "}
                · Ajustes guardados: {new Date(form.updatedAt).toLocaleString()}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
