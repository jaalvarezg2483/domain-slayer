/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROFE_EMAILS?: string;
  readonly VITE_PROFE_EMAIL_SUFFIXES?: string;
  /** Dev: URL del Vite del inventario (p. ej. http://127.0.0.1:5173) si esta app corre en otro puerto. */
  readonly VITE_INVENTORY_DEV_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
