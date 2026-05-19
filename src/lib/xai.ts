/**
 * Minimal HTTP client for xAI's REST API.
 *
 * Used for STT (audio/transcriptions) and Collections endpoints.
 * For chat completions we use the AI SDK directly via @ai-sdk/xai.
 *
 * Endpoint conventions follow xAI's OpenAI-compatible base
 * (https://api.x.ai/v1/...). If your SDK has drifted, this file is the only
 * place that needs updating.
 */

export const XAI_BASE_URL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";

export const MODELS = {
  chat:       "grok-4.3",
  cheap:      "grok-4.1-fast",
  embedding:  "grok-embedding-small",
  stt:        "grok-stt",
} as const;

function key(): string {
  const k = process.env.XAI_API_KEY;
  if (!k) throw new Error("XAI_API_KEY not set.");
  return k;
}

export async function xaiJson<T = unknown>(
  path: string,
  init: Omit<RequestInit, "body"> & { method: string; body?: unknown },
): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(`${XAI_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Authorization": `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI ${init.method} ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function xaiMultipart<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const res = await fetch(`${XAI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key()}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI POST ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
