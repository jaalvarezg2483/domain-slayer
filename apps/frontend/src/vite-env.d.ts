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
  /** Correos exactos (coma) que van a la SPA `/profe/` tras login. */
  readonly VITE_PROFE_EMAILS?: string;
  /** Sufijos de correo (coma), p. ej. `@escuela.edu`. */
  readonly VITE_PROFE_EMAIL_SUFFIXES?: string;
  /** Ruta base de la app profe (por defecto `/profe`). */
  readonly VITE_PROFE_BASE_PATH?: string;
  /** Dev: origen del Vite de profe si corre en otro puerto (p. ej. http://127.0.0.1:5175). */
  readonly VITE_PROFE_DEV_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
