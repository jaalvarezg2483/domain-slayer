import type { MonitoringScheduleDto } from "../api";

/** Día de la semana en formato node-cron: 0=dom, 1=lun, … 6=sáb */
export const WEEKDAY_CRON: { label: string; cron: number }[] = [
  { label: "Lun", cron: 1 },
  { label: "Mar", cron: 2 },
  { label: "Mié", cron: 3 },
  { label: "Jue", cron: 4 },
  { label: "Vie", cron: 5 },
  { label: "Sáb", cron: 6 },
  { label: "Dom", cron: 0 },
];

export type VisualRecurrence = "daily" | "weekly" | "biweekly" | "monthly_first" | "interval" | "custom";

export type VisualScheduleState = {
  recurrence: VisualRecurrence;
  hour: number;
  minute: number;
  weekdays: number[];
  intervalDays: number;
  /** Solo bisemanal: paridad del número de semana ISO (0 = par, 1 = impar) */
  biweeklyParity: 0 | 1;
  customCron: string;
};

export type ScheduleSaveFields = {
  scheduleMode: "cron" | "interval";
  cronExpression: string;
  intervalDays: number;
  runHour: number;
  runMinute: number;
  cronAlternateWeeks: boolean;
  isoWeekParity: number | null;
  cronFirstWeekOnly: boolean;
};

export function defaultVisualState(): VisualScheduleState {
  return {
    recurrence: "daily",
    hour: 8,
    minute: 0,
    weekdays: [1, 2, 3, 4, 5],
    intervalDays: 7,
    biweeklyParity: 0,
    customCron: "0 8 * * *",
  };
}

function expandDowPart(part: string): number[] {
  const out = new Set<number>();
  for (const seg of part.split(",")) {
    const s = seg.trim();
    if (!s) continue;
    if (s.includes("-")) {
      const [a, b] = s.split("-").map((x) => Number(x.trim()));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let d = lo; d <= hi; d++) {
          if (d >= 0 && d <= 7) out.add(d === 7 ? 0 : d);
        }
      }
      continue;
    }
    const n = Number(s);
    if (Number.isFinite(n)) {
      const v = n === 7 ? 0 : n;
      if (v >= 0 && v <= 6) out.add(v);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function parseCronTime(c: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2})\s+(\d{1,2})\s+/.exec(c.trim());
  if (!m) return null;
  const minute = Math.min(59, Math.max(0, Number(m[1])));
  const hour = Math.min(23, Math.max(0, Number(m[2])));
  if (!Number.isFinite(minute) || !Number.isFinite(hour)) return null;
  return { hour, minute };
}

/** Interpreta DTO guardado → estado del asistente */
export function visualFromDto(dto: MonitoringScheduleDto): VisualScheduleState {
  const hour = Math.min(23, Math.max(0, Number(dto.runHour) ?? 8));
  const minute = Math.min(59, Math.max(0, Number(dto.runMinute) ?? 0));
  const alt = Boolean(dto.cronAlternateWeeks);
  const parity: 0 | 1 = dto.isoWeekParity === 1 ? 1 : 0;

  if (dto.scheduleMode === "interval") {
    const id = Math.min(365, Math.max(1, Number(dto.intervalDays) ?? 7));
    if (id === 14) {
      return {
        recurrence: "biweekly",
        hour,
        minute,
        weekdays: [1, 2, 3, 4, 5],
        intervalDays: id,
        biweeklyParity: parity,
        customCron: dto.cronExpression ?? `${minute} ${hour} * * *`,
      };
    }
    return {
      recurrence: "interval",
      hour,
      minute,
      weekdays: [1, 2, 3, 4, 5],
      intervalDays: id,
      biweeklyParity: 0,
      customCron: dto.cronExpression ?? `${minute} ${hour} * * *`,
    };
  }

  const c = (dto.cronExpression ?? "").trim().replace(/\s+/g, " ");
  const fromCron = parseCronTime(c);
  const firstWeek = Boolean(dto.cronFirstWeekOnly);

  if (dto.scheduleMode === "cron" && firstWeek) {
    const wk = /^(\d{1,2}) (\d{1,2}) \* \* ([^*\s]+)$/.exec(c);
    if (wk && !wk[3].includes("*")) {
      const days = expandDowPart(wk[3]);
      if (days.length > 0) {
        const h = Math.min(23, Math.max(0, Number(wk[2])));
        const mi = Math.min(59, Math.max(0, Number(wk[1])));
        return {
          recurrence: "monthly_first",
          hour: h,
          minute: mi,
          weekdays: days,
          intervalDays: 7,
          biweeklyParity: 0,
          customCron: c,
        };
      }
    }
  }

  const monthlyLegacy = /^(\d{1,2}) (\d{1,2}) 1-7 \* ([^*\s]+)$/.exec(c);
  if (dto.scheduleMode === "cron" && monthlyLegacy && !alt && !firstWeek) {
    const days = expandDowPart(monthlyLegacy[3]);
    if (days.length > 0 && !monthlyLegacy[3].includes("*")) {
      const h = Math.min(23, Math.max(0, Number(monthlyLegacy[2])));
      const mi = Math.min(59, Math.max(0, Number(monthlyLegacy[1])));
      return {
        recurrence: "monthly_first",
        hour: h,
        minute: mi,
        weekdays: days,
        intervalDays: 7,
        biweeklyParity: 0,
        customCron: `${mi} ${h} * * ${days.join(",")}`,
      };
    }
  }

  if (dto.scheduleMode === "cron" && alt) {
    const wk = /^(\d{1,2}) (\d{1,2}) \* \* ([^*\s]+)$/.exec(c);
    if (wk && !wk[3].includes("*")) {
      const days = expandDowPart(wk[3]);
      if (days.length > 0) {
        const h = fromCron?.hour ?? hour;
        const mi = fromCron?.minute ?? minute;
        return {
          recurrence: "biweekly",
          hour: h,
          minute: mi,
          weekdays: days,
          intervalDays: 7,
          biweeklyParity: parity,
          customCron: c,
        };
      }
    }
  }

  const daily = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(c);
  if (daily) {
    const h = Math.min(23, Math.max(0, Number(daily[2])));
    const mi = Math.min(59, Math.max(0, Number(daily[1])));
    return {
      recurrence: "daily",
      hour: h,
      minute: mi,
      weekdays: [1, 2, 3, 4, 5],
      intervalDays: 7,
      biweeklyParity: 0,
      customCron: c,
    };
  }

  const weekly = /^(\d{1,2}) (\d{1,2}) \* \* ([^*\s]+)$/.exec(c);
  if (weekly && !weekly[3].includes("*")) {
    const days = expandDowPart(weekly[3]);
    if (days.length > 0) {
      const h = Math.min(23, Math.max(0, Number(weekly[2])));
      const mi = Math.min(59, Math.max(0, Number(weekly[1])));
      return {
        recurrence: "weekly",
        hour: h,
        minute: mi,
        weekdays: days,
        intervalDays: 7,
        biweeklyParity: 0,
        customCron: c,
      };
    }
  }

  return {
    recurrence: "custom",
    hour,
    minute,
    weekdays: [1, 2, 3, 4, 5],
    intervalDays: 7,
    biweeklyParity: 0,
    customCron: c || "0 8 * * *",
  };
}

function requireWeekdays(v: VisualScheduleState): number[] {
  const days = [...new Set(v.weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) {
    throw new Error("Marque al menos un día de la semana.");
  }
  return days;
}

/** Construye campos para guardar en API */
export function dtoFieldsFromVisual(v: VisualScheduleState): ScheduleSaveFields {
  const hour = Math.min(23, Math.max(0, Math.floor(v.hour)));
  const mi = Math.min(59, Math.max(0, Math.floor(v.minute)));

  switch (v.recurrence) {
    case "daily":
      return {
        scheduleMode: "cron",
        cronExpression: `${mi} ${hour} * * *`,
        intervalDays: 7,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: false,
      };
    case "weekly": {
      const days = requireWeekdays(v);
      return {
        scheduleMode: "cron",
        cronExpression: `${mi} ${hour} * * ${days.join(",")}`,
        intervalDays: 7,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: false,
      };
    }
    case "biweekly": {
      const days = requireWeekdays(v);
      const p = v.biweeklyParity === 1 ? 1 : 0;
      return {
        scheduleMode: "cron",
        cronExpression: `${mi} ${hour} * * ${days.join(",")}`,
        intervalDays: 7,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: true,
        isoWeekParity: p,
        cronFirstWeekOnly: false,
      };
    }
    case "monthly_first": {
      const days = requireWeekdays(v);
      return {
        scheduleMode: "cron",
        cronExpression: `${mi} ${hour} * * ${days.join(",")}`,
        intervalDays: 7,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: true,
      };
    }
    case "interval": {
      const n = Math.min(365, Math.max(1, Math.floor(v.intervalDays)));
      return {
        scheduleMode: "interval",
        cronExpression: `${mi} ${hour} * * *`,
        intervalDays: n,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: false,
      };
    }
    case "custom": {
      const expr = v.customCron.trim();
      if (!expr) throw new Error("Indique una expresión cron o elija otra recurrencia.");
      return {
        scheduleMode: "cron",
        cronExpression: expr,
        intervalDays: 7,
        runHour: hour,
        runMinute: mi,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: false,
      };
    }
  }
}

export function humanSummary(v: VisualScheduleState): string {
  const hm = `${String(v.hour).padStart(2, "0")}:${String(v.minute).padStart(2, "0")}`;
  try {
    const f = dtoFieldsFromVisual(v);
    const parityLabel =
      v.recurrence === "biweekly"
        ? v.biweeklyParity === 1
          ? " (semanas ISO impares: 1, 3, 5…)"
          : " (semanas ISO pares: 2, 4, 6…)"
        : "";
    if (f.scheduleMode === "interval") {
      return `Cada ${f.intervalDays} día(s) a las ${hm} (hora servidor).`;
    }
    if (v.recurrence === "daily") return `Todos los días a las ${hm}.`;
    if (v.recurrence === "weekly") {
      const names = WEEKDAY_CRON.filter((w) => v.weekdays.includes(w.cron)).map((w) => w.label);
      return `Cada semana: ${names.join(", ")} a las ${hm}.`;
    }
    if (v.recurrence === "biweekly") {
      const names = WEEKDAY_CRON.filter((w) => v.weekdays.includes(w.cron)).map((w) => w.label);
      return `Cada dos semanas: ${names.join(", ")} a las ${hm}${parityLabel}.`;
    }
    if (v.recurrence === "monthly_first") {
      const names = WEEKDAY_CRON.filter((w) => v.weekdays.includes(w.cron)).map((w) => w.label);
      return `Cada mes, solo en la primera semana (días 1–7): ${names.join(", ")} a las ${hm}.`;
    }
    if (v.recurrence === "custom") return `Cron: ${f.cronExpression}`;
    return f.cronExpression;
  } catch {
    return "";
  }
}
