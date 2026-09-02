/**
 * Provider-agnostic AI configuration.
 *
 * Accepts ANY AI API key by normalizing every LLM call onto the Vercel AI SDK
 * through one of two providers:
 *
 *   - OpenAI-compatible  (default) — works with OpenAI, DeepSeek, NVIDIA NIM,
 *     Groq, Together, Mistral, OpenRouter, xAI, Ollama, LM Studio, and any
 *     gateway that speaks the OpenAI /chat/completions protocol.
 *   - Anthropic           — Anthropic's native Messages API via @ai-sdk/anthropic.
 *
 * Select the provider + models entirely through environment variables (see .env.example).
 * The legacy XAI_* variables still work and map onto the OpenAI-compatible xAI endpoint.
 *
 * Only the LLM (chat / structured-output / organize) layer is portable. The two
 * proprietary xAI surfaces — Grok Collections (RAG) and Grok STT — keep using the
 * xAI REST API (see collections.ts / stt.ts). On a non-xAI deployment those
 * features degrade gracefully (research shows a "not configured" notice) while
 * chat, research summarization, and note organization work against any provider.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";

// ---------------------------------------------------------------------------
// Env resolution — the single source of truth for provider + model + key + base
// ---------------------------------------------------------------------------

export type AIProviderId = "openai" | "anthropic" | "xai";

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  baseURL: string;
  chatModel: string;
  cheapModel: string;
  embeddingModel: string;
  sttModel: string;
}

const ANTHROPIC_HINTS = [
  "claude",
  "anthropic",
];

function resolveProvider(raw: string | undefined): AIProviderId {
  const p = (raw ?? "").trim().toLowerCase();
  if (!p) {
    // Legacy: XAI_API_KEY present (and no generic AI_* vars) → xAI
    if (process.env.XAI_API_KEY?.trim()) return "xai";
    return "openai";
  }
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "xai" || p === "grok") return "xai";
  // "openai", "openai-compatible", "compatible", anything else → openai-compatible
  return "openai";
}

function inferProvider(model: string, baseURL: string): AIProviderId | null {
  const m = model.toLowerCase();
  const u = baseURL.toLowerCase();
  if (ANTHROPIC_HINTS.some((t) => m.includes(t) || u.includes(t))) return "anthropic";
  if (m.includes("grok") || u.includes("api.x.ai")) return "xai";
  // OpenAI-compatible can't be reliably distinguished from "unset"; signal null
  // when there's nothing to infer.
  if (!m && !u) return null;
  return "openai";
}

const PROVIDER_DEFAULTS: Record<
  AIProviderId,
  { baseURL: string; chat: string; cheap: string; embedding: string; stt: string }
> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    chat: "gpt-4o",
    cheap: "gpt-4o-mini",
    embedding: "text-embedding-3-small",
    stt: "whisper-1",
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    chat: "claude-sonnet-4-5",
    cheap: "claude-haiku-4-5",
    // Anthropic has no public embeddings / STT; keep xAI defaults so the REST
    // surfaces error loudly instead of silently posting garbage.
    embedding: "grok-embedding-small",
    stt: "grok-stt",
  },
  xai: {
    baseURL: "https://api.x.ai/v1",
    chat: "grok-4.3",
    cheap: "grok-4.1-fast",
    embedding: "grok-embedding-small",
    stt: "grok-stt",
  },
};

function firstDefined(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

function resolveConfig(): AIConfig {
  const explicit = resolveProvider(process.env.AI_PROVIDER);
  const inferred = inferProvider(
    firstDefined(process.env.AI_CHAT_MODEL, process.env.OPENAI_CHAT_MODEL) ?? "",
    firstDefined(process.env.AI_BASE_URL, process.env.XAI_BASE_URL) ?? "",
  );

  const provider = explicit;

  const defs = PROVIDER_DEFAULTS[provider];

  // Key precedence: provider-native env > generic AI_API_KEY > legacy XAI_API_KEY
  const nativeKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : provider === "xai"
        ? process.env.XAI_API_KEY
        : process.env.OPENAI_API_KEY;
  const apiKey =
    firstDefined(nativeKey, process.env.AI_API_KEY, process.env.XAI_API_KEY) ?? "";

  const baseURL =
    firstDefined(
      provider === "xai" ? process.env.XAI_BASE_URL : process.env.AI_BASE_URL,
      process.env.XAI_BASE_URL,
    ) || defs.baseURL;

  const chatModel =
    firstDefined(process.env.AI_CHAT_MODEL, process.env.OPENAI_CHAT_MODEL) ?? defs.chat;
  const cheapModel =
    firstDefined(process.env.AI_CHEAP_MODEL, process.env.OPENAI_CHEAP_MODEL) ?? defs.cheap;
  const embeddingModel =
    firstDefined(process.env.AI_EMBEDDING_MODEL) ?? defs.embedding;
  const sttModel = firstDefined(process.env.AI_STT_MODEL) ?? defs.stt;

  return {
    provider,
    apiKey,
    baseURL,
    chatModel,
    cheapModel,
    embeddingModel,
    sttModel,
  };
}

// ---------------------------------------------------------------------------
// Cached model factory — returns an AI SDK model for `chat` / `cheap`
// ---------------------------------------------------------------------------

let _config: AIConfig | null = null;

export function aiConfig(): AIConfig {
  if (!_config) _config = resolveConfig();
  return _config;
}

type AnyLanguageModel =
  | ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>
  | ReturnType<ReturnType<typeof createAnthropic>>;

let _chat: AnyLanguageModel | null = null;
let _cheap: AnyLanguageModel | null = null;

function makeModel(cfg: AIConfig, modelId: string): AnyLanguageModel {
  return cfg.provider === "anthropic"
    ? createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL })(modelId)
    : createOpenAICompatible({
        name: cfg.provider === "xai" ? "xai" : "openai-compatible",
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
      }).chatModel(modelId);
}

export function chatModel(): AnyLanguageModel {
  if (_chat) return _chat;
  const cfg = aiConfig();
  assertKey(cfg);
  _chat = makeModel(cfg, cfg.chatModel);
  return _chat;
}

export function cheapModel(): AnyLanguageModel {
  if (_cheap) return _cheap;
  const cfg = aiConfig();
  assertKey(cfg);
  _cheap = makeModel(cfg, cfg.cheapModel);
  return _cheap;
}

function assertKey(cfg: AIConfig): void {
  if (!cfg.apiKey) {
    throw new Error(
      "No AI API key set. Set AI_API_KEY (or the provider-native key: OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY).",
    );
  }
}

// ---------------------------------------------------------------------------
// Raw REST accessors — keep the xAI Collections / STT surface working when
// the deployment is on xAI (proprietary endpoints have no portable equivalent).
// ---------------------------------------------------------------------------

export const XAI_BASE_URL =
  process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";

/**
 * Model ids for the proprietary xAI REST paths (Collections search/upload + STT).
 * These are plain strings; LLM generation uses chatModel()/cheapModel() above.
 */
export const MODELS = {
  embedding: aiConfig().embeddingModel,
  stt: aiConfig().sttModel,
} as const;

function key(): string {
  const k = firstDefined(process.env.XAI_API_KEY, process.env.AI_API_KEY);
  if (!k) throw new Error("XAI_API_KEY (or AI_API_KEY) not set.");
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
      Authorization: `Bearer ${key()}`,
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
    headers: { Authorization: `Bearer ${key()}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI POST ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}