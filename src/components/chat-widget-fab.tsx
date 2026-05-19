"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "@/lib/utils";
import {
  VerseCard,
  HadithCard,
  TafsirCard,
} from "@/components/citation-cards";
import type {
  QuranCitation,
  HadithCitation,
  TafsirCitation,
} from "@/lib/islamic";
import type { NoteHit, HelpHit } from "@/lib/agent-tools";

// localStorage key for the active thread, so the widget remembers across pages
const THREAD_KEY = "tranquil.activeThreadId";

type ThreadSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

export function ChatWidgetFab() {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Restore active thread from localStorage on first open
  useEffect(() => {
    if (!open || threadId !== undefined) return;
    const saved = typeof window !== "undefined"
      ? window.localStorage.getItem(THREAD_KEY)
      : null;
    if (saved) {
      setHydrating(true);
      fetch(`/api/threads/${saved}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.thread) {
            window.localStorage.removeItem(THREAD_KEY);
            setThreadId(undefined);
            setInitialMessages([]);
            return;
          }
          setThreadId(data.thread.id);
          setInitialMessages(persistedToUI(data.thread.messages));
        })
        .catch(() => {
          window.localStorage.removeItem(THREAD_KEY);
        })
        .finally(() => setHydrating(false));
    }
  }, [open, threadId]);

  const startNew = () => {
    window.localStorage.removeItem(THREAD_KEY);
    setThreadId(undefined);
    setInitialMessages([]);
    setShowHistory(false);
  };

  const switchTo = async (id: string) => {
    setHydrating(true);
    setShowHistory(false);
    const data = await fetch(`/api/threads/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (data?.thread) {
      window.localStorage.setItem(THREAD_KEY, data.thread.id);
      setThreadId(data.thread.id);
      setInitialMessages(persistedToUI(data.thread.messages));
    }
    setHydrating(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the app"
        className={cn(
          "fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40",
          "w-14 h-14 rounded-full",
          "bg-[var(--color-sage)] text-white",
          "flex items-center justify-center",
          "shadow-[var(--shadow-lifted)]",
          "transition-all duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
          "hover:bg-[var(--color-sage-deep)] hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sage)]/30",
        )}
      >
        <ChatIcon className="w-6 h-6" />
      </button>

      {open && (
        <ChatSheet
          onClose={() => setOpen(false)}
          threadId={threadId}
          onThreadIdResolved={(id) => {
            setThreadId(id);
            window.localStorage.setItem(THREAD_KEY, id);
          }}
          initialMessages={initialMessages}
          hydrating={hydrating}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((v) => !v)}
          onStartNew={startNew}
          onSwitchTo={switchTo}
        />
      )}
    </>
  );
}

// =================================================================
// Chat sheet
// =================================================================
function ChatSheet({
  onClose,
  threadId,
  onThreadIdResolved,
  initialMessages,
  hydrating,
  showHistory,
  onToggleHistory,
  onStartNew,
  onSwitchTo,
}: {
  onClose: () => void;
  threadId: string | undefined;
  onThreadIdResolved: (id: string) => void;
  initialMessages: UIMessage[];
  hydrating: boolean;
  showHistory: boolean;
  onToggleHistory: () => void;
  onStartNew: () => void;
  onSwitchTo: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, threadId },
      }),
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        const newThreadId = res.headers.get("x-thread-id");
        if (newThreadId && newThreadId !== threadId) {
          onThreadIdResolved(newThreadId);
        }
        return res;
      },
    }),
  });

  // Autoscroll to bottom on new content
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    void sendMessage({ text });
  };

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-ink)]/30 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full sm:max-w-2xl sm:mx-4 bg-[var(--color-paper)]",
          "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]",
          "shadow-[var(--shadow-lifted)] flex flex-col",
          "h-[88dvh] sm:h-[80dvh]",
        )}
      >
        <SheetHeader
          onClose={onClose}
          onToggleHistory={onToggleHistory}
          onStartNew={onStartNew}
          historyOpen={showHistory}
        />

        {showHistory ? (
          <ThreadHistory
            currentId={threadId}
            onSwitchTo={onSwitchTo}
          />
        ) : (
          <>
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
            >
              {hydrating && (
                <p className="text-center text-[var(--color-muted)] py-12 italic text-sm">
                  Loading…
                </p>
              )}
              {!hydrating && messages.length === 0 && <EmptyState />}
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {isStreaming &&
                messages[messages.length - 1]?.role === "user" && (
                  <ThinkingIndicator />
                )}
            </div>

            <form
              onSubmit={handleSend}
              className="border-t border-[var(--color-surface-strong)] p-4 flex items-center gap-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                disabled={hydrating}
                className={cn(
                  "flex-1 h-11 px-4 rounded-full bg-[var(--color-surface)]",
                  "border-0 outline-none focus:ring-2 focus:ring-[var(--color-sage)]/30",
                  "font-[var(--font-ui)] text-base text-[var(--color-ink)]",
                  "placeholder:text-[var(--color-whisper)]",
                )}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="h-11 px-4 rounded-full bg-[var(--color-surface-strong)] text-[var(--color-ink)] font-[var(--font-ui)] text-sm"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center",
                    "bg-[var(--color-sage)] text-white",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    "hover:bg-[var(--color-sage-deep)] transition-colors",
                  )}
                  aria-label="Send"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SheetHeader({
  onClose,
  onToggleHistory,
  onStartNew,
  historyOpen,
}: {
  onClose: () => void;
  onToggleHistory: () => void;
  onStartNew: () => void;
  historyOpen: boolean;
}) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-[var(--color-surface-strong)]">
      <button
        type="button"
        onClick={onToggleHistory}
        aria-label={historyOpen ? "Back to conversation" : "Show history"}
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
      >
        {historyOpen ? (
          <BackIcon className="w-5 h-5 text-[var(--color-muted)]" />
        ) : (
          <HistoryIcon className="w-5 h-5 text-[var(--color-muted)]" />
        )}
      </button>
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)]">
        {historyOpen ? "Recent conversations" : "Ask the app"}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onStartNew}
          aria-label="New conversation"
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
        >
          <NewIcon className="w-5 h-5 text-[var(--color-muted)]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
        >
          <CloseIcon className="w-5 h-5 text-[var(--color-muted)]" />
        </button>
      </div>
    </header>
  );
}

function EmptyState() {
  const examples = [
    "What did I write about patience last month?",
    "What does the Quran say about gratitude?",
    "Find a hadith about kindness to neighbors",
    "Summarize my recent thoughts on family",
  ];
  return (
    <div className="text-center py-8">
      <p className="text-lg italic text-[var(--color-muted)] mb-2">
        Ask anything.
      </p>
      <p className="text-sm text-[var(--color-whisper)] font-[var(--font-ui)] mb-8">
        I can search your notes, the Quran, hadith, tafsir, and the web.
      </p>
      <div className="space-y-2 text-left max-w-md mx-auto">
        {examples.map((ex) => (
          <p
            key={ex}
            className="text-sm text-[var(--color-muted)] italic font-[var(--font-body)]"
          >
            "{ex}"
          </p>
        ))}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] italic font-[var(--font-ui)]">
      <span className="inline-flex gap-1">
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </span>
      Thinking…
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-[var(--color-sage)] animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

// =================================================================
// Message row — text parts + tool result cards inline
// =================================================================
function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] space-y-3",
          isUser && "bg-[var(--color-surface)] rounded-[var(--radius-md)] px-4 py-3",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p
                key={i}
                className={cn(
                  "leading-[1.7] whitespace-pre-wrap",
                  isUser
                    ? "text-[var(--color-ink)] font-[var(--font-ui)] text-base"
                    : "text-[var(--color-ink)] font-[var(--font-body)] text-base",
                )}
              >
                {part.text}
              </p>
            );
          }
          // Tool calls render as inline citation cards once the result lands
          if (part.type.startsWith("tool-")) {
            return <ToolResultCard key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

function ToolResultCard({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  const state = part.state ?? "input-available";

  if (state !== "output-available") {
    return (
      <div className="text-xs italic text-[var(--color-whisper)] font-[var(--font-ui)]">
        {toolPendingLabel(name)}…
      </div>
    );
  }

  const output = part.output;
  if (output == null) return null;

  if (name === "quran_search" && Array.isArray(output)) {
    const verses = output as QuranCitation[];
    if (verses.length === 0) return <EmptyToolNote name={name} />;
    return (
      <div className="space-y-2">
        {verses.slice(0, 3).map((v, i) => (
          <VerseCard key={`${v.reference}-${i}`} verse={v} compact showSaveButton />
        ))}
      </div>
    );
  }

  if (name === "hadith_search" && Array.isArray(output)) {
    const hadiths = output as HadithCitation[];
    if (hadiths.length === 0) return <EmptyToolNote name={name} />;
    return (
      <div className="space-y-2">
        {hadiths.slice(0, 3).map((h, i) => (
          <HadithCard key={`${h.reference}-${i}`} hadith={h} compact />
        ))}
      </div>
    );
  }

  if (name === "tafsir_search" && Array.isArray(output)) {
    const tafs = output as TafsirCitation[];
    if (tafs.length === 0) return <EmptyToolNote name={name} />;
    return (
      <div className="space-y-2">
        {tafs.slice(0, 2).map((t, i) => (
          <TafsirCard key={`${t.reference}-${i}`} tafsir={t} compact />
        ))}
      </div>
    );
  }

  if (name === "search_my_notes" && Array.isArray(output)) {
    const notes = output as NoteHit[];
    if (notes.length === 0) return <EmptyToolNote name={name} />;
    return (
      <div className="space-y-2">
        {notes.slice(0, 5).map((n) => (
          <Link
            key={n.noteId}
            href={`/notes/${n.noteId}`}
            className="block rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-strong)] transition-colors"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-1">
              your note
            </p>
            <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)] line-clamp-1">
              {n.title ?? "Untitled"}
            </p>
            <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] line-clamp-2 mt-1">
              {n.snippet}
            </p>
          </Link>
        ))}
      </div>
    );
  }

  if (name === "app_help" && output && typeof output === "object") {
    const hit = output as HelpHit;
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 border-l-2 border-[var(--color-dusk)]">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-dusk)] font-[var(--font-ui)] mb-2">
          App guidance
        </p>
        <p className="text-sm leading-[1.7] text-[var(--color-ink)] font-[var(--font-ui)]">
          {hit.body}
        </p>
      </div>
    );
  }

  return null;
}

function EmptyToolNote({ name }: { name: string }) {
  return (
    <p className="text-xs italic text-[var(--color-whisper)] font-[var(--font-ui)]">
      {emptyToolLabel(name)}
    </p>
  );
}

function toolPendingLabel(name: string): string {
  switch (name) {
    case "quran_search":    return "Searching the Quran";
    case "hadith_search":   return "Searching the hadith";
    case "tafsir_search":   return "Searching the tafsir";
    case "search_my_notes": return "Searching your notes";
    case "app_help":        return "Looking that up";
    default:                return "Working";
  }
}

function emptyToolLabel(name: string): string {
  switch (name) {
    case "quran_search":    return "No matching verses found.";
    case "hadith_search":   return "No matching hadith found.";
    case "tafsir_search":   return "No tafsir match.";
    case "search_my_notes": return "Nothing in your notes yet.";
    default:                return "No result.";
  }
}

// =================================================================
// Thread history sub-view
// =================================================================
function ThreadHistory({
  currentId,
  onSwitchTo,
}: {
  currentId: string | undefined;
  onSwitchTo: (id: string) => void;
}) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/threads")
      .then((r) => r.json())
      .then((data: { threads: ThreadSummary[] }) => {
        if (!cancelled) setThreads(data.threads);
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      });
    return () => { cancelled = true; };
  }, []);

  if (threads === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-muted)] italic text-sm">
        Loading…
      </div>
    );
  }
  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-muted)] italic text-sm font-[var(--font-ui)]">
        No past conversations yet.
      </div>
    );
  }
  return (
    <ul className="flex-1 overflow-y-auto py-2">
      {threads.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSwitchTo(t.id)}
            className={cn(
              "w-full text-left px-6 py-4 hover:bg-[var(--color-surface)] transition-colors",
              currentId === t.id && "bg-[var(--color-surface)]",
            )}
          >
            <p className="font-[var(--font-display)] text-base text-[var(--color-ink)] line-clamp-1">
              {t.title ?? "Untitled conversation"}
            </p>
            <p className="text-xs text-[var(--color-whisper)] font-[var(--font-ui)] mt-1">
              {new Date(t.updatedAt).toLocaleString()}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

// =================================================================
// Hydration: convert persisted ChatMessage rows back into UIMessages
// =================================================================
type PersistedMessage = {
  id: string;
  role: string;
  content: string;
  toolCalls: unknown;
  citations: unknown;
};

function persistedToUI(msgs: PersistedMessage[]): UIMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    role: m.role as UIMessage["role"],
    parts: [{ type: "text", text: m.content }],
  }));
}

// =================================================================
// Icons
// =================================================================
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}
function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.4 9.4 0 0 0-6.5 2.6L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function NewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
