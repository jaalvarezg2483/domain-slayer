import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/Spinner";
import { getStoredContactEmails, rememberContactEmail } from "../lib/contact-email-memory";
import type { SiteEnvironment, SiteRow } from "../types";

const empty = {
  siteName: "",
  businessUnit: "",
  domain: "",
  url: "https://",
  environment: "production" as SiteEnvironment,
  provider: "",
  hostingProvider: "",
  dnsProvider: "",
  sslProvider: "",
  registrarProvider: "",
  owner: "",
  technicalOwner: "",
  contactEmail: "",
  notes: "",
  isActive: true,
  /** YYYY-MM-DD para input type=date; vacío = sin fecha manual */
  domainExpiryManualStr: "",
};

function toSitePayload(form: typeof empty) {
  return {
    siteName: form.siteName,
    businessUnit: form.businessUnit.trim() || null,
    domain: form.domain,
    url: form.url,
    environment: form.environment,
    provider: form.provider.trim() || null,
    hostingProvider: form.hostingProvider.trim() || null,
    dnsProvider: form.dnsProvider.trim() || null,
    sslProvider: form.sslProvider.trim() || null,
    registrarProvider: form.registrarProvider.trim() || null,
    owner: form.owner.trim() || null,
    technicalOwner: form.technicalOwner.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    notes: form.notes.trim() || null,
    isActive: form.isActive,
    domainExpiryManual: form.domainExpiryManualStr
      ? new Date(`${form.domainExpiryManualStr}T12:00:00`)
      : null,
    domainExpirySource: (form.domainExpiryManualStr ? "manual" : "auto") as "manual" | "auto",
  };
}

export function SiteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>(() => getStoredContactEmails());
  const isNew = !id || id === "new";

  useEffect(() => {
    if (!id || id === "new") return;
    api.sites
      .get(id)
      .then((s) => {
        const row = s as SiteRow & Record<string, unknown>;
        const manualRaw = row.domainExpiryManual as string | Date | null | undefined;
        let domainExpiryManualStr = "";
        if (manualRaw) {
          const d = typeof manualRaw === "string" ? new Date(manualRaw) : manualRaw;
          if (!Number.isNaN(d.getTime())) domainExpiryManualStr = d.toISOString().slice(0, 10);
        }
        setForm({
          siteName: String(row.siteName ?? ""),
          businessUnit: String(row.businessUnit ?? ""),
          domain: String(row.domain ?? ""),
          url: String(row.url ?? "https://"),
          environment: (row.environment as SiteEnvironment) ?? "production",
          provider: String(row.provider ?? ""),
          hostingProvider: String(row.hostingProvider ?? ""),
          dnsProvider: String(row.dnsProvider ?? ""),
          sslProvider: String(row.sslProvider ?? ""),
          registrarProvider: String(row.registrarProvider ?? ""),
          owner: String(row.owner ?? ""),
          technicalOwner: String(row.technicalOwner ?? ""),
          contactEmail: String(row.contactEmail ?? ""),
          notes: String(row.notes ?? ""),
          isActive: Boolean(row.isActive ?? true),
          domainExpiryManualStr,
        });
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const payload = toSitePayload(form);
      if (id && id !== "new") {
        await api.sites.update(id, payload);
        rememberContactEmail(form.contactEmail);
        setEmailSuggestions(getStoredContactEmails());
        nav(`/sites/${id}`);
      } else {
        const created = (await api.sites.create(payload)) as { id: string };
        rememberContactEmail(form.contactEmail);
        setEmailSuggestions(getStoredContactEmails());
        nav(`/sites/${created.id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack narrow">
      <h1>{id && id !== "new" ? "Editar sitio" : "Nuevo sitio"}</h1>
      {err && <div className="card error">{err}</div>}
      <div className="card form-grid">
        <label>
          Nombre
          <input className="input" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
        </label>
        <label>
          Dominio
          <input
            className="input"
            placeholder="ej. grupopurdy.com — sin www (WHOIS/RDAP usan el dominio de registro)"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          />
        </label>
        <label>
          URL
          <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </label>
        <label>
          Ambiente
          <select
            className="input"
            value={form.environment}
            onChange={(e) => setForm({ ...form, environment: e.target.value as SiteEnvironment })}
          >
            <option value="production">Producción</option>
            <option value="staging">Staging</option>
            <option value="development">Desarrollo</option>
          </select>
        </label>
        <label className="span-2 form-checkbox-row">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span className="form-checkbox-row__text">
            <span className="form-checkbox-row__title">Sitio activo</span>
            <span className="muted small">
              Si lo desactiva, el sitio deja de incluirse en «Chequear todos» y no cuenta en «Sitios activos» del panel.
            </span>
          </span>
        </label>
        <label className="span-2">
          Unidad de negocio
          <input className="input" value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value })} />
        </label>
        <label>
          Email contacto
          <input
            className="input"
            type="email"
            name="contactEmail"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            list="contact-email-suggestions"
            placeholder="correo@empresa.com"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
          <datalist id="contact-email-suggestions">
            {emailSuggestions.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <span className="muted small">Sugerencias al escribir: correos guardados al guardar sitios en este navegador.</span>
        </label>
        <label>
          Propietario
          <input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </label>
        <label className="span-2">
          Notas del sitio (URLs dev/prod, admin, contraseñas)
          <textarea
            className="input site-notes-textarea"
            rows={10}
            placeholder={
              "Ej.: URL dev https://…\nAdmin: https://…/wp-admin\nUsuario / contraseña (solo personal autorizado)"
            }
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            spellCheck={false}
          />
          <span className="muted small">
            Visible en la ficha del sitio. No comparta fuera de canales seguros; trate las contraseñas como información
            sensible.
          </span>
        </label>
        <div className="span-2">
          <h2 style={{ fontSize: "1.05rem", margin: "0.5rem 0 0.25rem" }}>Expiración del dominio</h2>
          <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
            Si RDAP/WHOIS no devuelven la fecha (p. ej. firewall al puerto 43), indíquela aquí. Esa fecha prevalece
            sobre la detectada automáticamente. Déjelo vacío para confiar solo en el chequeo automático.
          </p>
        </div>
        <label>
          Fecha fin de dominio (manual)
          <input
            className="input"
            type="date"
            value={form.domainExpiryManualStr}
            onChange={(e) => setForm({ ...form, domainExpiryManualStr: e.target.value })}
          />
        </label>
      </div>
      {isNew && (
        <p className="muted small">
          Al crear un sitio nuevo, el sistema ejecuta automáticamente el primer chequeo (SSL, DNS, dominio…); puede tardar unos segundos.
        </p>
      )}
      <div className="row gap">
        <button type="button" className="btn primary" onClick={() => void save()} disabled={saving} aria-busy={saving}>
          {saving ? (
            <>
              <Spinner size="sm" />
              {isNew ? "Guardando y revisando…" : "Guardando…"}
            </>
          ) : (
            "Guardar"
          )}
        </button>
        <button type="button" className="btn ghost" onClick={() => nav(-1)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
