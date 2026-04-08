import { useEffect, useMemo, useState } from "react";

const MESSAGE_INTERVAL_MS = 4500;

const MESSAGES = [
  "Estamos revisando todos los sitios activos: certificados, dominios y que la web responda.",
  "Si hay muchos sitios, puede tardar varios minutos. Es normal.",
  "Cada dirección se comprueba por turnos; no cierre esta ventana.",
  "En cuanto termine, la tabla mostrará las fechas y estados nuevos.",
  "Gracias por esperar.",
];

type Props = {
  open: boolean;
  siteCount: number;
};

/** Overlay durante POST /monitoring/check-all: expectativa clara y tono ligero. */
export function CheckAllWaitOverlay({ open, siteCount }: Props) {
  const [idx, setIdx] = useState(0);

  const subtitle = useMemo(() => {
    if (siteCount <= 0) {
      return "Procesando los sitios del inventario.";
    }
    if (siteCount === 1) {
      return "Hay un sitio activo en el inventario.";
    }
    return `Hay ${siteCount} sitios activos; revisarlos todos puede llevar un buen rato.`;
  }, [siteCount]);

  useEffect(() => {
    if (!open) {
      setIdx(0);
      return;
    }
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="checkall-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkall-overlay-title"
      aria-describedby="checkall-overlay-desc"
    >
      <div className="checkall-overlay__card">
        <div className="checkall-overlay__inner">
          <h2 id="checkall-overlay-title" className="checkall-overlay__title">
            Revisión en curso
          </h2>
          <p id="checkall-overlay-desc" className="checkall-overlay__subtitle">
            {subtitle}
          </p>

          <div className="checkall-overlay__track" aria-hidden>
            <div className="checkall-overlay__track-rail" />
            <div className="checkall-overlay__shimmer" />
            <div className="checkall-overlay__creep">
              <span className="checkall-overlay__glow" />
              <span className="checkall-overlay__snail-wrap">
                <SnailGlyph className="checkall-overlay__snail" />
              </span>
            </div>
          </div>

          <p className="checkall-overlay__message" key={idx} role="status" aria-live="polite">
            {MESSAGES[idx]}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SnailGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 44" width="64" height="44" aria-hidden>
      <circle cx="41" cy="22" r="12.5" fill="#d4c4a8" stroke="#9a8a6e" strokeWidth="1.25" />
      <path
        d="M46 14.5a8.5 8.5 0 0 0-14 6.5a5.5 5.5 0 0 0 9 5a3 3 0 0 0 4.5-2.5"
        fill="none"
        stroke="#7a6b52"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="24" cy="26" rx="13" ry="10" fill="#34c759" />
      <ellipse cx="24" cy="26" rx="10" ry="7" fill="#5ee397" opacity="0.32" />
      <circle cx="15" cy="21" r="3.4" fill="#2a8f47" />
      <path d="M13 18l-2.8-4.2M16.5 17.5l-1.2-4.8" stroke="#1f6b38" strokeWidth="1.35" strokeLinecap="round" fill="none" />
      <circle cx="16.2" cy="20.5" r="1" fill="#0f1419" />
    </svg>
  );
}
