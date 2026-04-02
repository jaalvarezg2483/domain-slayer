import { useEffect, useState } from "react";

/** Logo opcional: `public/grupo-purdy-logo.png` */
const BRAND_LOGO_PNG = "/grupo-purdy-logo.png";

/** Título por defecto bajo el logo. */
const DEFAULT_APP_TITLE = "Inventario Sitios Web Purdy";
/** En sidebar: opcional `VITE_APP_TITLE` en build. En login (`standalone`) siempre el nombre completo Purdy. */
function appTitleForVariant(variant: "sidebar" | "standalone"): string {
  if (variant === "standalone") return DEFAULT_APP_TITLE;
  const env = typeof import.meta.env.VITE_APP_TITLE === "string" ? import.meta.env.VITE_APP_TITLE.trim() : "";
  return env || DEFAULT_APP_TITLE;
}

type Props = {
  /** En login el fondo no es el del sidebar; sin lighten el logo se ve igual de bien */
  variant?: "sidebar" | "standalone";
};

export function AppBrand({ variant = "sidebar" }: Props) {
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BRAND_LOGO_PNG)
      .then((r) => {
        if (!cancelled && r.ok) setBrandLogoSrc(BRAND_LOGO_PNG);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`brand${variant === "standalone" ? " brand--standalone" : ""}`}>
      <div className="brand-logo-row">
        {brandLogoSrc ? (
          <img
            className="brand-logo"
            src={brandLogoSrc}
            alt="Grupo Purdy"
            width={320}
            height={69}
            onError={() => setBrandLogoSrc(null)}
          />
        ) : (
          <span className="brand-org-text">Grupo Purdy</span>
        )}
      </div>
      <p className="brand-tagline">{appTitleForVariant(variant)}</p>
    </div>
  );
}
