"use client";

import { useEffect, useState } from "react";
import { lookupVerseAction } from "@/app/actions/research";
import type { QuranCitation, TafsirCitation } from "@/lib/islamic";
import { cn } from "@/lib/utils";

type Tab = "translations" | "tafsir" | "audio";

export function VerseModal({
  reference,
  open,
  onClose,
}: {
  reference: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("translations");
  const [verse, setVerse] = useState<QuranCitation | null>(null);
  const [tafsir, setTafsir] = useState<TafsirCitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reference) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setVerse(null);
      setTafsir(null);
      setTab("translations");

      void lookupVerseAction({ reference })
        .then((result) => {
          if (cancelled) return;
          setVerse(result.verse);
          setTafsir(result.tafsir);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Could not load verse");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [open, reference]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--color-ink)]/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full sm:max-w-3xl sm:mx-4 bg-[var(--color-paper)]",
          "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]",
          "shadow-[var(--shadow-lifted)] flex flex-col",
          "max-h-[92dvh]",
        )}
      >
        <header className="flex items-center justify-between p-6 border-b border-[var(--color-surface-strong)]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-citation)] font-[var(--font-ui)]">
              Quran {reference}
            </p>
            {verse?.surahName && (
              <h2 className="text-2xl mt-1">Surah {verse.surahName}</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex items-center gap-1 px-6 pt-4">
          <Tab active={tab === "translations"} onClick={() => setTab("translations")}>
            Translations
          </Tab>
          <Tab active={tab === "tafsir"} onClick={() => setTab("tafsir")}>
            Tafsir
          </Tab>
          <Tab active={tab === "audio"} onClick={() => setTab("audio")}>
            Recitation
          </Tab>
        </div>

        <div className="px-6 pb-6 pt-4 overflow-y-auto flex-1">
          {loading && (
            <p className="text-center text-[var(--color-muted)] py-12">Loading…</p>
          )}
          {error && (
            <p className="text-center text-[var(--color-danger)] py-12">{error}</p>
          )}

          {!loading && !error && verse && tab === "translations" && (
            <TranslationsView verse={verse} />
          )}
          {!loading && !error && tab === "tafsir" && (
            <TafsirView tafsir={tafsir} />
          )}
          {!loading && !error && reference && tab === "audio" && (
            <RecitationView reference={reference} />
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm font-[var(--font-ui)] rounded-md transition-colors",
        active
          ? "text-[var(--color-ink)] bg-[var(--color-surface)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
      )}
    >
      {children}
    </button>
  );
}

function TranslationsView({ verse }: { verse: QuranCitation }) {
  const items: Array<[string, string | undefined]> = [
    ["Sahih International", verse.translations.sahih],
    ["Pickthall",            verse.translations.pickthall],
    ["Yusuf Ali",            verse.translations.yusufali],
    ["Muhammad Asad",        verse.translations.asad],
  ];
  return (
    <div className="space-y-6">
      {verse.arabic && (
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-muted)] font-[var(--font-ui)] mb-3">
            Arabic
          </p>
          <p className="arabic text-right text-[var(--color-ink)]">
            {verse.arabic}
          </p>
        </div>
      )}
      <div className="space-y-5">
        {items
          .filter(([, t]) => !!t)
          .map(([label, t]) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-muted)] font-[var(--font-ui)] mb-2">
                {label}
              </p>
              <p className="text-base leading-[1.75] italic text-[var(--color-ink)]">
                {t}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}

function TafsirView({ tafsir }: { tafsir: TafsirCitation | null }) {
  if (!tafsir) {
    return (
      <p className="text-center text-[var(--color-muted)] py-12 italic">
        Tafsir for this verse isn&apos;t available.
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-dusk)] font-[var(--font-ui)] mb-3">
        {tafsir.source}
      </p>
      <p className="text-base leading-[1.8] text-[var(--color-ink)] whitespace-pre-line">
        {tafsir.text}
      </p>
    </div>
  );
}

function RecitationView({ reference }: { reference: string }) {
  // Audio is streamed via our /api/recitation endpoint, which proxies/redirects
  // to a CDN with a known per-verse URL pattern.
  const src = `/api/recitation?ref=${encodeURIComponent(reference)}`;
  return (
    <div className="py-6">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-muted)] font-[var(--font-ui)] mb-3">
        Mishary Al-Afasy
      </p>
      <audio src={src} controls className="w-full" preload="metadata" />
      <p className="text-xs text-[var(--color-whisper)] mt-3 font-[var(--font-ui)]">
        Audio served from everyayah.com.
      </p>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}
