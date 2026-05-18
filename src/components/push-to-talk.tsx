"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RecordingState = "idle" | "requesting" | "recording" | "processing" | "error";

export function PushToTalk() {
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

  const start = useCallback(async () => {
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
        setState("processing");
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);

        // Phase 1: just log. Phase 2: upload to R2 + enqueue STT job.
        console.info("[push-to-talk] captured audio", {
          size: blob.size,
          mimeType: blob.type,
          durationSec,
        });

        // Tiny pause so the user sees the processing state momentarily
        setTimeout(() => {
          stopStream();
          setState("idle");
        }, 400);
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not access the microphone.";
      setErrorMsg(message);
      setState("error");
      stopStream();
      setTimeout(() => setState("idle"), 2500);
    }
  }, [state, stopStream]);

  const stop = useCallback(() => {
    if (state !== "recording") return;
    mediaRecorderRef.current?.stop();
  }, [state]);

  // Keyboard support: hold Space to record
  useEffect(() => {
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
  }, [start, stop]);

  useEffect(() => stopStream, [stopStream]);

  const label = (() => {
    switch (state) {
      case "idle":       return "Hold to speak";
      case "requesting": return "Listening…";
      case "recording":  return "Recording — release when done";
      case "processing": return "Thinking…";
      case "error":      return errorMsg ?? "Something went wrong";
    }
  })();

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        aria-label="Hold to speak — release when done"
        aria-pressed={state === "recording"}
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
          // Only stop if the pointer was actually captured by us
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
          state === "recording"
            ? "bg-[var(--color-sage)] recording-pulse"
            : state === "error"
              ? "bg-[var(--color-danger)]"
              : state === "processing"
                ? "bg-[var(--color-sage-soft)]"
                : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-strong)]",
        )}
      >
        <MicIcon
          className={cn(
            "w-12 h-12 transition-colors",
            state === "recording" || state === "error"
              ? "text-white"
              : "text-[var(--color-sage-deep)]",
          )}
        />
      </button>
      <p
        className={cn(
          "text-sm font-[var(--font-ui)] tracking-wide",
          state === "error"
            ? "text-[var(--color-danger)]"
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
