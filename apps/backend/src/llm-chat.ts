import type { LlmConfig } from "./llm-config.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function chatCompletionsUrl(cfg: LlmConfig): string {
  return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export async function callChatCompletions(
  messages: ChatMessage[],
  cfg: LlmConfig,
  extras?: Record<string, unknown>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = chatCompletionsUrl(cfg);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ollama",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: 1800,
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
