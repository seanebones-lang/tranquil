"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateNote, deleteNote } from "@/app/actions/notes";
import { getNoteStatus } from "@/app/actions/voice";
import { expandSlashCommand } from "@/app/actions/slash";
import { findSlashCommands, formatCitationBlock } from "@/lib/slash-commands";
import { NoteBody } from "@/components/note-body";
import { cn } from "@/lib/utils";

type Props = {
  noteId: string;
  initialTitle: string;
  initialBody: string;
  initialTranscriptionStatus: string;
  initialOrganizeStatus: string;
  initialTags: string[];
  initialSummary: string | null;
  initialTopic: string | null;
  hasAudio: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type Mode = "write" | "read";
type DeleteState = "idle" | "confirm";

const AUTOSAVE_DEBOUNCE_MS = 800;

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function NoteEditor(props: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("write");
  const [title, setTitle] = useState(props.initialTitle);
  const [body, setBody] = useState(props.initialBody);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [transcriptionStatus, setTranscriptionStatus] = useState(props.initialTranscriptionStatus);
  const [organizeStatus, setOrganizeStatus] = useState(props.initialOrganizeStatus);
  const [tags, setTags] = useState(props.initialTags);
  const [summary, setSummary] = useState(props.initialSummary);
  const [topic, setTopic] = useState(props.initialTopic);
  const [slashError, setSlashError] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [, startTransition] = useTransition();

  const lastSavedRef = useRef({ title: props.initialTitle, body: props.initialBody });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ------- Auto-save -------
  const flushSave = useCallback(
    async (nextTitle: string, nextBody: string) => {
      if (
        nextTitle === lastSavedRef.current.title &&
        nextBody === lastSavedRef.current.body
      ) {
        return;
      }
      setSaveState("saving");
      try {
        await updateNote({
          noteId: props.noteId,
          title: nextTitle || null,
          bodyMd: nextBody,
        });
        lastSavedRef.current = { title: nextTitle, body: nextBody };
        setSaveState("saved");
        setOrganizeStatus("pending");
      } catch {
        setSaveState("error");
      }
    },
    [props.noteId],
  );

  const scheduleSave = useCallback(
    (nextTitle: string, nextBody: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushSave(nextTitle, nextBody);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  useEffect(() => {
    scheduleSave(title, body);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, body, scheduleSave]);

  useEffect(() => {
    const onHide = () => {
      if (
        title !== lastSavedRef.current.title ||
        body !== lastSavedRef.current.body
      ) {
        void updateNote({
          noteId: props.noteId,
          title: title || null,
          bodyMd: body,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [title, body, props.noteId]);

  // ------- Status polling -------
  // Use a ref to track the interval ID so we can reliably clear it across
  // re-renders without stacking multiple intervals.
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isWorking =
      transcriptionStatus === "pending" || organizeStatus === "pending";

    // Always clear any existing interval first to prevent stacking
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (!isWorking) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const status = await getNoteStatus(props.noteId).catch(() => null);
      if (!status || cancelled) return;
      setTranscriptionStatus(status.transcriptionStatus);
      setOrganizeStatus(status.organizeStatus);
      setTags(status.aiTags ?? []);
      setSummary(status.aiSummary);
      setTopic(status.aiTopic);

      if (
        status.transcriptionStatus === "done" &&
        status.bodyMd &&
        status.bodyMd !== lastSavedRef.current.body
      ) {
        setBody(status.bodyMd);
        lastSavedRef.current.body = status.bodyMd;
      }
      if (
        status.title &&
        status.title !== lastSavedRef.current.title &&
        !title.trim()
      ) {
        setTitle(status.title);
        lastSavedRef.current.title = status.title;
      }
    };

    pollIntervalRef.current = setInterval(tick, 2500);
    void tick();
    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [transcriptionStatus, organizeStatus, props.noteId, title]);

  // ------- Slash command expansion -------
  // On Enter, scan the body for slash commands; if any are present, look them
  // up and replace with citation blocks.
  const expandSlashCommands = useCallback(async () => {
    const commands = findSlashCommands(body);
    if (commands.length === 0) return;
    setSlashError(null);
    setExpanding(true);

    // Process from last to first so character offsets stay valid as we replace.
    let nextBody = body;
    const reversed = [...commands].reverse();
    let lastFailed: string | null = null;

    for (const cmd of reversed) {
      const result = await expandSlashCommand({
        command: cmd.command,
        argument: cmd.argument,
      });
      if ("error" in result) {
        lastFailed = result.error;
        continue;
      }
      const replacement = "\n\n" + formatCitationBlock(result.block) + "\n\n";
      nextBody =
        nextBody.slice(0, cmd.start) + replacement + nextBody.slice(cmd.end);
    }

    setBody(nextBody);
    setExpanding(false);
    if (lastFailed) setSlashError(lastFailed);
  }, [body]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+Enter: expand any slash commands and flip to read mode
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void (async () => {
        await expandSlashCommands();
        setMode("read");
      })();
    }
  };

  // ------- Render -------
  const isTranscribing = props.hasAudio && transcriptionStatus === "pending";
  const isOrganizing = organizeStatus === "pending" && body.trim().length > 20;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)]">
          {topic ? topic : "Note"}
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle mode={mode} setMode={setMode} hasContent={body.trim().length > 0} />
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isTranscribing ? "Transcribing your voice…" : "Untitled"}
        className={cn(
          "w-full bg-transparent border-0 outline-none",
          "font-[var(--font-display)] text-3xl sm:text-4xl tracking-tight",
          "placeholder:text-[var(--color-whisper)]",
          "mb-6",
        )}
      />

      {mode === "write" ? (
        <>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTranscribing
                ? "We'll drop your words in here shortly…"
                : "Begin writing. Try /verse 2:255 to embed a citation."
            }
            rows={16}
            className={cn(
              "w-full bg-transparent border-0 outline-none resize-none",
              "font-[var(--font-body)] text-lg leading-[1.8] text-[var(--color-ink)]",
              "placeholder:text-[var(--color-whisper)] placeholder:italic",
            )}
          />
          <div className="mt-3 flex items-center justify-between gap-4 text-xs font-[var(--font-ui)] text-[var(--color-whisper)] flex-wrap">
            <span>
              Type <code className="text-[var(--color-muted)]">/verse 2:255</code>,{" "}
              <code className="text-[var(--color-muted)]">/tafsir 2:255</code>, or{" "}
              <code className="text-[var(--color-muted)]">/hadith kindness to neighbors</code>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="tabular-nums">
                {wordCount(body)} words · {body.length.toLocaleString()} chars
              </span>
              <button
                type="button"
                onClick={expandSlashCommands}
                disabled={expanding || findSlashCommands(body).length === 0}
                className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {expanding ? "Looking up…" : "Expand citations"}
              </button>
            </span>
          </div>
          {slashError && (
            <p className="mt-2 text-sm text-[var(--color-danger)] font-[var(--font-ui)]">
              {slashError}
            </p>
          )}
        </>
      ) : (
        <NoteBody bodyMd={body} />
      )}

      <div className="mt-8 border-t border-[var(--color-surface-strong)] pt-6 space-y-4">
        {(tags.length > 0 || isOrganizing) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.15em] text-[var(--color-whisper)] font-[var(--font-ui)]">
              {isOrganizing ? "Organizing…" : "Tags"}
            </span>
            {tags.map((t) => (
              <span
                key={t}
                className="text-xs font-[var(--font-ui)] px-2.5 py-1 rounded-full bg-[var(--color-surface-strong)] text-[var(--color-ink)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {summary && (
          <p className="text-sm italic text-[var(--color-muted)] font-[var(--font-ui)]">
            {summary}
          </p>
        )}

        <div className="flex items-center gap-4 pt-4">
          {deleteState === "idle" ? (
            <button
              type="button"
              onClick={() => setDeleteState("confirm")}
              className="text-sm font-[var(--font-ui)] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-[var(--font-ui)] text-[var(--color-danger)]">
                Delete this note?
              </span>
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await deleteNote(props.noteId);
                    router.push("/notes");
                  });
                }}
                className="text-sm font-[var(--font-ui)] text-white bg-[var(--color-danger)] px-3 py-1 rounded-full hover:opacity-90"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteState("idle")}
                className="text-sm font-[var(--font-ui)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
  hasContent,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  hasContent: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-surface)] rounded-full p-0.5 text-xs font-[var(--font-ui)]">
      <button
        type="button"
        onClick={() => setMode("write")}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors",
          mode === "write"
            ? "bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[var(--shadow-soft)]"
            : "text-[var(--color-muted)]",
        )}
      >
        Write
      </button>
      <button
        type="button"
        onClick={() => setMode("read")}
        disabled={!hasContent}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors disabled:opacity-50",
          mode === "read"
            ? "bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[var(--shadow-soft)]"
            : "text-[var(--color-muted)]",
        )}
      >
        Read
      </button>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const text =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Couldn't save"
          : "";
  return (
    <span
      className={cn(
        "text-xs font-[var(--font-ui)] transition-opacity duration-[var(--duration-fade)]",
        state === "error"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-whisper)]",
        text ? "opacity-100" : "opacity-0",
      )}
      aria-live="polite"
    >
      {text || "—"}
    </span>
  );
}
