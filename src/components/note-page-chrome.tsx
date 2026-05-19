"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KhalwaShell, KhalwaButton, useKhalwa } from "@/components/khalwa";
import { setHeirloomVisible } from "@/app/actions/notes";
import { cn } from "@/lib/utils";

export function NotePageChrome({
  noteId,
  heirloomVisible: initialHeirloom,
  header,
  side,
  fab,
  children,
}: {
  noteId: string;
  heirloomVisible: boolean;
  header: React.ReactNode;
  side: React.ReactNode;
  fab: React.ReactNode;
  children: React.ReactNode;
}) {
  const khalwa = useKhalwa();
  const [heirloom, setHeirloom] = useState(initialHeirloom);
  const [, startTransition] = useTransition();

  const toggleHeirloom = () => {
    const next = !heirloom;
    setHeirloom(next);
    startTransition(async () => {
      try {
        await setHeirloomVisible({ noteId, visible: next });
      } catch {
        setHeirloom(!next);
      }
    });
  };

  if (khalwa.active) {
    return (
      <KhalwaShell active={true}>
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)]">
            Khalwa · press Esc to exit
          </span>
          <KhalwaButton active={true} onToggle={khalwa.toggle} />
        </div>
        {children}
      </KhalwaShell>
    );
  }

  return (
    <>
      {header}
      <main className="mx-auto max-w-6xl px-6 sm:px-10 pt-4 pb-32 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
        <div>
          <NoteToolbar
            noteId={noteId}
            heirloom={heirloom}
            onToggleHeirloom={toggleHeirloom}
            onKhalwa={khalwa.toggle}
          />
          {children}
        </div>
        <aside className="lg:pt-6 lg:border-l lg:border-[var(--color-surface-strong)] lg:pl-8">
          {side}
        </aside>
      </main>
      {fab}
    </>
  );
}

function NoteToolbar({
  noteId,
  heirloom,
  onToggleHeirloom,
  onKhalwa,
}: {
  noteId: string;
  heirloom: boolean;
  onToggleHeirloom: () => void;
  onKhalwa: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1 mb-2 text-xs font-[var(--font-ui)]">
      <button
        type="button"
        onClick={onToggleHeirloom}
        title={
          heirloom
            ? "This note is included in your heirloom"
            : "Excluded from your heirloom"
        }
        className={cn(
          "px-2 py-1 rounded transition-colors flex items-center gap-1.5",
          heirloom
            ? "text-[var(--color-citation)]"
            : "text-[var(--color-whisper)] hover:text-[var(--color-muted)]",
        )}
      >
        <HeirloomIcon className="w-3.5 h-3.5" />
        {heirloom ? "Heirloom" : "Private"}
      </button>
      <Link
        href={`/api/export?noteId=${noteId}`}
        className="px-2 py-1 rounded text-[var(--color-whisper)] hover:text-[var(--color-muted)]"
        title="Download this note"
      >
        Export
      </Link>
      <KhalwaButton active={false} onToggle={onKhalwa} />
    </div>
  );
}

function HeirloomIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
