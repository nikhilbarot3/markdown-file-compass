// Gemma (open-weight) via OpenRouter. Server-only.

export const GEMMA_MODEL = "google/gemma-4-31b-it";

type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface GemmaMessage {
  role: "system" | "user" | "assistant";
  content: string | Part[];
}

export async function callGemma(messages: GemmaMessage[], maxTokens = 300, json = false): Promise<string> {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("Gemma key is not configured.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMMA_MODEL,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Gemma request failed (${res.status}): ${body.error?.message ?? "unknown error"}`);
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

export function parseJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
