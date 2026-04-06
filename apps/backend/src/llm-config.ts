/**
 * LLM opcional vía Ollama (API compatible con /v1/chat/completions).
 * Sin variables de entorno, el asistente de biblioteca usa solo el índice local.
 */

export type LlmConfig = { kind: "ollama"; baseUrl: string; model: string };

export function resolveLlmConfig(): LlmConfig | null {
  const raw = process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim();
  if (!raw) return null;

  let base = raw.replace(/\/$/, "");
  if (!/\/v1$/i.test(base)) {
    base = `${base}/v1`;
  }
  return {
    kind: "ollama",
    baseUrl: base,
    model: process.env.OLLAMA_MODEL?.trim() || "llama3.2",
  };
}
