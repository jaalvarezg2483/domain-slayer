const AUTH_KEY = "ds_jwt";

function authHeaders(): HeadersInit {
  const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(AUTH_KEY) : null;
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return await res.text().catch(() => res.statusText);
  }
}

export type ProfeSchoolDto = {
  id: string;
  name: string;
  logoPath: string;
  reportHeader: string;
  reportFooter: string;
  createdAt: string;
  updatedAt: string;
};

export async function profeSchoolsList(): Promise<ProfeSchoolDto[]> {
  const res = await fetch("/api/profe/schools", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as { items: ProfeSchoolDto[] };
  return j.items ?? [];
}

export async function profeSchoolCreate(body: {
  name: string;
  logoPath?: string;
  reportHeader?: string;
  reportFooter?: string;
}): Promise<ProfeSchoolDto> {
  const res = await fetch("/api/profe/schools", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ProfeSchoolDto>;
}

export async function profeSchoolUpdate(
  id: string,
  body: Partial<{ name: string; logoPath: string; reportHeader: string; reportFooter: string }>
): Promise<ProfeSchoolDto> {
  const res = await fetch(`/api/profe/schools/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ProfeSchoolDto>;
}

export async function profeSchoolDelete(id: string): Promise<void> {
  const res = await fetch(`/api/profe/schools/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
