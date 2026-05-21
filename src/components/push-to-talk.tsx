"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  prepareVoiceNoteUpload,
  finalizeVoiceNoteUpload,
} from "@/app/actions/voice";
import { cn } from "@/lib/utils";

type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "error";

export function PushToTalk({
  uploadsEnabled = true,
}: {
  /** When false, R2 vars missing or placeholders — avoids recording then failing upload. */
  uploadsEnabled?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const handleUpload = useCallback(
    async (blob: Blob, durationSec: number) => {
      setState("uploading");
      try {
        const { noteId, uploadUrl } = await prepareVoiceNoteUpload({
          mimeType: blob.type || "audio/webm",
          durationSec,
        });

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed (${putRes.status})`);
        }

        await finalizeVoiceNoteUpload({ noteId });
        router.push(`/notes/${noteId}`);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Upload failed");
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [router],
  );

  const start = useCallback(async () => {
    if (!uploadsEnabled) return;
    if (state !== "idle") return;
    setErrorMsg(null);
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMime();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        stopStream();
        if (blob.size > 0) {
          await handleUpload(blob, durationSec);
        } else {
          setState("idle");
        }
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Could not access the microphone.",
      );
      setState("error");
      stopStream();
      setTimeout(() => setState("idle"), 2500);
    }
  }, [state, stopStream, handleUpload, uploadsEnabled]);

  const stop = useCallback(() => {
    if (state !== "recording") return;
    mediaRecorderRef.current?.stop();
  }, [state]);

  useEffect(() => {
    if (!uploadsEnabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (
        document.activeElement instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        )
      ) {
        return;
      }
      e.preventDefault();
      void start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      stop();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [start, stop, uploadsEnabled]);

  useEffect(() => stopStream, [stopStream]);

  const label = (() => {
    if (!uploadsEnabled && state === "idle") {
      return "The server isn’t detecting R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). Set them in env, restart npm run dev, or open a blank page to write instead.";
    }
    switch (state) {
      case "idle":       return "Hold to speak";
      case "requesting": return "Listening…";
      case "recording":  return "Recording — release when done";
      case "uploading":  return "Saving your note…";
      case "error":      return errorMsg ?? "Something went wrong";
    }
  })();

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        aria-label={
          uploadsEnabled
            ? "Hold to speak — release when done"
            : "Hold to speak unavailable — restart dev after configuring R2 environment variables"
        }
        aria-pressed={state === "recording"}
        disabled={state === "uploading" || !uploadsEnabled}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          void start();
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          stop();
        }}
        onPointerCancel={stop}
        onPointerLeave={(e) => {
          if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
            stop();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative select-none touch-none",
          "w-40 h-40 sm:w-48 sm:h-48 rounded-full",
          "flex items-center justify-center",
          "transition-all duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
          "shadow-[var(--shadow-lifted)]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sage)]/30",
          "disabled:opacity-70 disabled:cursor-not-allowed",
          state === "recording"
            ? "bg-[var(--color-sage)] recording-pulse"
            : state === "error"
              ? "bg-[var(--color-danger)]"
              : state === "uploading"
                ? "bg-[var(--color-sage-soft)]"
                : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-strong)]",
        )}
      >
        <MicIcon
          className={cn(
            "w-12 h-12 transition-colors",
            state === "recording" || state === "error"
              ? "text-white"
              : !uploadsEnabled && state === "idle"
                ? "text-[var(--color-whisper)]"
                : "text-[var(--color-sage-deep)]",
          )}
        />
      </button>
      <p
        className={cn(
          "text-sm font-[var(--font-ui)] tracking-wide max-w-md text-center",
          state === "error"
            ? "text-[var(--color-danger)]"
            : !uploadsEnabled
              ? "text-[var(--color-whisper)]"
              : "text-[var(--color-muted)]",
        )}
        aria-live="polite"
      >
        {label}
      </p>
    </div>
  );
}

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return null;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
