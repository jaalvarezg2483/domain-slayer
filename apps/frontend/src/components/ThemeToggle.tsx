import { useTheme } from "../theme-context";

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  );
}

type Props = { className?: string; compact?: boolean };

/** Un solo botón: alterna entre modo claro y oscuro. */
export function ThemeToggle({ className = "", compact }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Activar modo oscuro" : "Activar modo claro";

  return (
    <button
      type="button"
      className={
        "theme-toggle-single" +
        (compact ? " theme-toggle-single--compact" : "") +
        (className ? ` ${className}` : "")
      }
      onClick={() => toggleTheme()}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {isLight ? <IconMoon /> : <IconSun />}
      {!compact ? <span aria-hidden>{isLight ? "Modo oscuro" : "Modo claro"}</span> : null}
    </button>
  );
}
