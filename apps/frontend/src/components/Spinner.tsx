/** Indicador visual; el botón contenedor debe usar aria-busy. */
export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  return <span className={`spinner spinner-${size}`} aria-hidden />;
}
