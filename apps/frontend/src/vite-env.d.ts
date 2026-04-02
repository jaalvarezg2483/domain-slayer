/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Nombre de la app bajo el logo (solo se aplica al compilar; en Docker definir antes de `npm run build`). */
  readonly VITE_APP_TITLE?: string;
  /**
   * URL pública del sitio sin barra final (p. ej. https://app.grupopurdy.com).
   * En build, Vite sustituye %VITE_SITE_URL% en index.html para og:image y twitter:image absolutos.
   */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
