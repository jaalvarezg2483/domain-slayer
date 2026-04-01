import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  hour: number;
  minute: number;
  onChange: (next: { hour: number; minute: number }) => void;
  disabled?: boolean;
};

const CX = 100;
const CY = 100;
const R_HOUR = 76;
const R_MIN_OUT = 88;

function polarToHour(clientX: number, clientY: number, svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 200 - CX;
  const y = ((clientY - rect.top) / rect.height) * 200 - CY;
  let angle = Math.atan2(y, x) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  return Math.round((angle / (Math.PI * 2)) * 24) % 24;
}

function polarToMinute(clientX: number, clientY: number, svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 200 - CX;
  const y = ((clientY - rect.top) / rect.height) * 200 - CY;
  let angle = Math.atan2(y, x) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  return Math.round((angle / (Math.PI * 2)) * 60) % 60;
}

export function ScheduleTimePicker({ hour, minute, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"hour" | "min">("hour");
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const w = wrapRef.current;
      if (w && !w.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setTab("hour");
  }, [open]);

  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const onSvgPointer = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      if (tab === "hour") {
        const h = polarToHour(e.clientX, e.clientY, svg);
        onChange({ hour: h, minute });
        setTab("min");
      } else {
        const m = polarToMinute(e.clientX, e.clientY, svg);
        onChange({ hour, minute: m });
        setOpen(false);
      }
    },
    [tab, hour, minute, onChange]
  );

  const hourAngle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  const minAngle = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  const handAngle = tab === "hour" ? hourAngle : minAngle;

  return (
    <div className="schedule-time-picker" ref={wrapRef}>
      <button
        type="button"
        className="schedule-time-picker__trigger"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${id}-popover`}
      >
        <svg className="schedule-time-picker__icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="12" y1="12" x2="15.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="schedule-time-picker__value">{label}</span>
      </button>
      {open ? (
        <div
          className="schedule-time-picker__popover"
          id={`${id}-popover`}
          role="dialog"
          aria-label="Hora de ejecución"
        >
          <div className="schedule-time-picker__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "hour"}
              className={tab === "hour" ? "is-active" : ""}
              onClick={() => setTab("hour")}
            >
              Hora
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "min"}
              className={tab === "min" ? "is-active" : ""}
              onClick={() => setTab("min")}
            >
              Minutos
            </button>
          </div>
          <svg
            viewBox="0 0 200 200"
            className="schedule-time-picker__svg"
            onClick={onSvgPointer}
          >
            <defs>
              <radialGradient id={`${id}-g`} cx="50%" cy="45%" r="65%">
                <stop offset="0%" stopColor="rgba(55, 65, 85, 0.95)" />
                <stop offset="100%" stopColor="rgba(28, 32, 42, 0.98)" />
              </radialGradient>
            </defs>
            <circle cx={CX} cy={CY} r={96} fill={`url(#${id}-g)`} stroke="rgba(100, 210, 255, 0.22)" strokeWidth="1.5" />
            {tab === "hour"
              ? Array.from({ length: 24 }, (_, h) => {
                  const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
                  const x = CX + R_HOUR * Math.cos(ang);
                  const y = CY + R_HOUR * Math.sin(ang);
                  const sel = h === hour;
                  return (
                    <g key={h}>
                      <circle
                        cx={x}
                        cy={y}
                        r={sel ? 15 : 12}
                        className={
                          sel
                            ? "schedule-time-picker__node schedule-time-picker__node--on"
                            : "schedule-time-picker__node"
                        }
                      />
                      <text
                        x={x}
                        y={y + 4.5}
                        textAnchor="middle"
                        className={
                          sel
                            ? "schedule-time-picker__num schedule-time-picker__num--on"
                            : "schedule-time-picker__num"
                        }
                      >
                        {h}
                      </text>
                    </g>
                  );
                })
              : null}
            {tab === "min"
              ? Array.from({ length: 60 }, (_, m) => {
                  const ang = (m / 60) * Math.PI * 2 - Math.PI / 2;
                  const major = m % 5 === 0;
                  const r1 = major ? 78 : 84;
                  const r2 = R_MIN_OUT;
                  const x1 = CX + r1 * Math.cos(ang);
                  const y1 = CY + r1 * Math.sin(ang);
                  const x2 = CX + r2 * Math.cos(ang);
                  const y2 = CY + r2 * Math.sin(ang);
                  return (
                    <line
                      key={m}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      className={
                        m === minute
                          ? "schedule-time-picker__tick schedule-time-picker__tick--on"
                          : major
                            ? "schedule-time-picker__tick schedule-time-picker__tick--major"
                            : "schedule-time-picker__tick"
                      }
                    />
                  );
                })
              : null}
            {tab === "min"
              ? [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                  const ang = (m / 60) * Math.PI * 2 - Math.PI / 2;
                  const x = CX + 62 * Math.cos(ang);
                  const y = CY + 62 * Math.sin(ang);
                  return (
                    <text
                      key={m}
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      className="schedule-time-picker__num-inner"
                    >
                      {m}
                    </text>
                  );
                })
              : null}
            <line
              x1={CX}
              y1={CY}
              x2={CX + (tab === "hour" ? 48 : 56) * Math.cos(handAngle)}
              y2={CY + (tab === "hour" ? 48 : 56) * Math.sin(handAngle)}
              className="schedule-time-picker__hand"
            />
            <circle cx={CX} cy={CY} r={6} className="schedule-time-picker__cap" />
          </svg>
          <p className="schedule-time-picker__hint muted small">
            {tab === "hour"
              ? "Toque la hora en el círculo (0–23). Luego elija los minutos."
              : "Toque el borde exterior para el minuto exacto (0–59)."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
