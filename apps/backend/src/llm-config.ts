/**
 * OpenAI en la nube o API compatible (p. ej. Ollama en http://127.0.0.1:11434/v1).
 * Si no hay ninguno, el asistente usa solo resumen local (sin LLM).
 */

export type LlmConfig =
  | { kind: "openai"; apiKey: string; baseUrl?: string; model: string }
  | { kind: "ollama"; baseUrl: string; model: string };

/** Base OpenAI-compatible para chat/completions (sin barra final). */
export function resolveLlmConfig(): LlmConfig | null {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      kind: "openai",
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

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

export function hasAnyLlmConfigured(): boolean {
  return resolveLlmConfig() != null;
}
