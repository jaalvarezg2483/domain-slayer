type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Etiqueta para accesibilidad (ej. «sitios») */
  itemLabel?: string;
  disabled?: boolean;
};

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = "elementos",
  disabled,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  if (total <= pageSize) return null;

  return (
    <div className="table-pagination" role="navigation" aria-label={`Paginación de ${itemLabel}`}>
      <span className="muted small table-pagination__meta">
        {from} a {to} de {total}
      </span>
      <div className="table-pagination__btns">
        <button
          type="button"
          className="btn small ghost"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Anterior
        </button>
        <span className="muted small">
          Página {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn small ghost"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
