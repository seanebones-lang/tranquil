import { MODELS, xaiMultipart } from "./xai";

export type Transcript = {
  text: string;
  language: string;
  duration_sec: number;
  segments: Array<{ start: number; end: number; text: string }>;
};

/**
 * Send an audio blob to xAI's transcriptions endpoint.
 * Compatible with the OpenAI-style multipart audio/transcriptions surface.
 */
export async function transcribe(
  audio: Buffer,
  filename: string,
  mimeType: string,
  language = "en",
): Promise<Transcript> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: mimeType }),
    filename,
  );
  form.append("model", MODELS.stt);
  form.append("language", language);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const raw = await xaiMultipart<{
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  }>("/audio/transcriptions", form);

  return {
    text: raw.text ?? "",
    language: raw.language ?? language,
    duration_sec: raw.duration ?? 0,
    segments: raw.segments ?? [],
  };
}
