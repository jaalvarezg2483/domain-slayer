import { useEffect, useMemo, useState } from "react";

const MESSAGE_INTERVAL_MS = 4500;

const MESSAGES = [
  "Revisamos todos los sitios activos: SSL, DNS y conectividad. No se omite ninguno.",
  "Puede tardar varios minutos si hay muchos dominios; es normal.",
  "Los caracoles van con calma, pero el sistema sí visita cada sitio de la lista.",
  "Consultamos certificados, caducidades y respuesta HTTP por cada URL.",
  "Gracias por la paciencia: un chequeo completo es más fiable que uno a la carrera.",
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
      return "Se están procesando los sitios del inventario.";
    }
    if (siteCount === 1) {
      return "Hay 1 sitio activo en el inventario.";
    }
    return `Hay ${siteCount} sitios en el inventario; el chequeo completo puede tardar bastante.`;
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
        <h2 id="checkall-overlay-title" className="checkall-overlay__title">
          Chequeo en curso
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
  );
}

function SnailGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 40" width="56" height="40" aria-hidden>
      <ellipse cx="38" cy="22" rx="14" ry="12" fill="#c9b896" stroke="#a89878" strokeWidth="1.2" />
      <path
        d="M38 14c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7zm0 2.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5-4.5-2-4.5-4.5 2-4.5 4.5-4.5z"
        fill="#8b7a5c"
        opacity="0.45"
      />
      <ellipse cx="22" cy="24" rx="12" ry="9" fill="#34c759" opacity="0.92" />
      <ellipse cx="22" cy="24" rx="9" ry="6.5" fill="#5ee397" opacity="0.35" />
      <circle cx="14" cy="20" r="3.2" fill="#34c759" />
      <path d="M12 17l-2.5-4M15 16.5l-1-4.5" stroke="#2a8f47" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="15.5" cy="19.5" r="0.9" fill="#0f1419" />
    </svg>
  );
}
