import { SnailGlyph } from "./CheckAllWaitOverlay";

export type SessionSnailMode = "welcome" | "goodbye";

const COPY: Record<
  SessionSnailMode,
  { title: string; subtitle: string; message: string; titleId: string }
> = {
  welcome: {
    title: "Bienvenido",
    subtitle: "Ingresando al inventario de sitios web.",
    message: "Un momento… en seguida podrá usar el panel.",
    titleId: "session-snail-welcome-title",
  },
  goodbye: {
    title: "Hasta pronto",
    subtitle: "Cerrando sesión.",
    message: "Gracias por su visita. Vuelva cuando quiera.",
    titleId: "session-snail-goodbye-title",
  },
};

type Props = {
  open: boolean;
  mode: SessionSnailMode;
};

/**
 * Misma animación de caracol que «Chequear todos»: entrada tras login y salida al cerrar sesión.
 */
export function SessionTransitionOverlay({ open, mode }: Props) {
  if (!open) return null;
  const c = COPY[mode];

  return (
    <div
      className={`checkall-overlay session-snail-overlay session-snail-overlay--${mode}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={c.titleId}
      aria-live="polite"
    >
      <div className="checkall-overlay__card">
        <div className="checkall-overlay__inner">
          <h2 id={c.titleId} className="checkall-overlay__title">
            {c.title}
          </h2>
          <p className="checkall-overlay__subtitle">{c.subtitle}</p>

          <div className="checkall-overlay__track" aria-hidden>
            <div className="checkall-overlay__track-rail" />
            <div className="checkall-overlay__shimmer" />
            <div className={`checkall-overlay__creep session-snail-overlay__creep--${mode}`}>
              <span className="checkall-overlay__glow" />
              <span className="checkall-overlay__snail-wrap">
                <SnailGlyph className="checkall-overlay__snail" />
              </span>
            </div>
          </div>

          <p className="checkall-overlay__message">{c.message}</p>
        </div>
      </div>
    </div>
  );
}
