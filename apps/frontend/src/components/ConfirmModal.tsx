import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = acción destructiva (eliminar); el botón principal va en rojo. */
  tone?: "default" | "danger";
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmación en modal (sin `window.confirm` / diálogos del navegador).
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  busyLabel = "Procesando…",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="modal-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="confirm-modal-title" className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn small ghost modal-close"
            onClick={() => !busy && onCancel()}
            disabled={busy}
          >
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          <div id="confirm-modal-desc" className="confirm-modal-message">
            {message}
          </div>
          <div className="modal-footer confirm-modal-actions">
            <button type="button" className="btn ghost" onClick={() => !busy && onCancel()} disabled={busy}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={tone === "danger" ? "btn primary btn-confirm-danger" : "btn primary"}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
