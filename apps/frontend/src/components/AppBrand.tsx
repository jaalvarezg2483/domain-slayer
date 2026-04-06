import { useEffect, useState } from "react";
import { useTheme } from "../theme-context";

/** Tema oscuro: `public/grupo-purdy-logo.png` (blanco sobre oscuro; en login/sidebar se usa con mix-blend lighten). */
const BRAND_LOGO_DARK = "/grupo-purdy-logo.png";
/** Tema claro: `public/grupo-purdy-logo-light.png` (logo oscuro o a color sobre fondo claro; sin mix-blend). */
const BRAND_LOGO_LIGHT = "/grupo-purdy-logo-light.png";

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
  const { theme } = useTheme();
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = theme === "light" ? BRAND_LOGO_LIGHT : BRAND_LOGO_DARK;
    fetch(url)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setBrandLogoSrc(url);
        else setBrandLogoSrc(null);
      })
      .catch(() => {
        if (!cancelled) setBrandLogoSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [theme]);

  const logoClass = theme === "light" && brandLogoSrc === BRAND_LOGO_LIGHT ? "brand-logo brand-logo--light" : "brand-logo";

  return (
    <div className={`brand${variant === "standalone" ? " brand--standalone" : ""}`}>
      <div className="brand-logo-row">
        {brandLogoSrc ? (
          <img
            className={logoClass}
            src={brandLogoSrc}
            alt="Grupo Purdy"
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
