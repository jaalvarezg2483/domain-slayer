import { useEffect, useState } from "react";

/** Logo opcional: `public/grupo-purdy-logo.png` */
const BRAND_LOGO_PNG = "/grupo-purdy-logo.png";

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
            width={240}
            height={52}
            onError={() => setBrandLogoSrc(null)}
          />
        ) : (
          <span className="brand-org-text">Grupo Purdy</span>
        )}
      </div>
      <p className="brand-tagline">Inventario de sitios Web</p>
    </div>
  );
}
