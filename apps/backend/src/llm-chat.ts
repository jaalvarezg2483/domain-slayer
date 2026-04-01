import type { LlmConfig } from "./llm-config.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function chatCompletionsUrl(cfg: LlmConfig): string {
  if (cfg.kind === "ollama") {
    return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }
  let host = (cfg.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
  if (!/\/v1$/i.test(host)) {
    host = `${host}/v1`;
  }
  return `${host}/chat/completions`;
}

export async function callChatCompletions(
  messages: ChatMessage[],
  cfg: LlmConfig,
  extras?: Record<string, unknown>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = chatCompletionsUrl(cfg);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.kind === "openai") {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  } else {
    headers.Authorization = "Bearer ollama";
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: 2200,
        ...extras,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { ok: false, error: `${res.status}: ${errText.slice(0, 300)}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: "Respuesta vacía del modelo." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
