/** Indicador Activo / Inactivo para tablas y fichas (usa estilos .badge existentes). */
export function SiteActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`badge ${isActive ? "badge-ok" : "badge-muted"}`}
      title={
        isActive
          ? "Sitio activo: entra al revisar todos y cuenta en el panel"
          : "Sitio inactivo: excluido de «Chequear todos» y del contador de sitios activos"
      }
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}
