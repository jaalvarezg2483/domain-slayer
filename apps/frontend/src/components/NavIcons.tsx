/** Iconos del menú lateral (SVG, currentColor). */

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function IconDashboard() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="2" />
      <rect x="14" y="14" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}

export function IconSites() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.25 12h17.5" />
      <path d="M12 3.25c4.5 4 7.25 8.75 7.25 8.75S16.5 16.75 12 20.75c-4.5-4-7.25-8.75-7.25-8.75S7.5 7.25 12 3.25z" />
    </svg>
  );
}

export function IconLibrary() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7.5h8M9 11h6" opacity="0.88" />
    </svg>
  );
}

export function IconAlerts() {
  return (
    <svg {...iconProps}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/** Programación / chequeos automáticos */
export function IconClock() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Usuarios / acceso */
export function IconUsers() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Búsqueda inteligente (robot) */
export function IconAssistant() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v2.5" strokeWidth={1.6} />
      <circle cx="12" cy="2.25" r="1.35" fill="currentColor" stroke="none" />
      <rect x="5.25" y="6.25" width="13.5" height="12" rx="3.25" />
      <circle cx="9.35" cy="11.75" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.65" cy="11.75" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9.25 15.35h5.5" strokeWidth={1.45} />
    </svg>
  );
}

export function IconPlusSite() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 8.25v7.5M8.25 12h7.5" strokeWidth={1.65} />
    </svg>
  );
}

/** Portapapeles (acciones de copiar) */
export function IconClipboard() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1.25" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Barra de sitios: búsqueda */
export function IconSearch() {
  return (
    <svg {...iconProps} width={18} height={18}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

/** Chequeo / refrescar monitorización */
export function IconRefreshCw() {
  return (
    <svg {...iconProps} width={18} height={18}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

export function IconCheckCircle() {
  return (
    <svg {...iconProps} width={22} height={22}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-6" />
    </svg>
  );
}

/** Ver detalle / notas (vencimientos, modales) */
export function IconEye() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
