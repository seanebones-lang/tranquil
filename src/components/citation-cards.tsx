"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type {
  QuranCitation,
  HadithCitation,
  TafsirCitation,
} from "@/lib/islamic";
import { saveCitation, unsaveCitation } from "@/app/actions/research";

type TranslationKey = "sahih" | "pickthall" | "yusufali" | "asad";

const TRANSLATION_LABELS: Record<TranslationKey, string> = {
  sahih:     "Sahih International",
  pickthall: "Pickthall",
  yusufali:  "Yusuf Ali",
  asad:      "Muhammad Asad",
};

const TRANSLATION_ORDER: TranslationKey[] = ["sahih", "pickthall", "yusufali", "asad"];

// ============================================================
// VerseCard
// ============================================================
export function VerseCard({
  verse,
  initiallySaved = false,
  onOpenModal,
  showSaveButton = true,
  compact = false,
}: {
  verse: QuranCitation;
  initiallySaved?: boolean;
  onOpenModal?: () => void;
  showSaveButton?: boolean;
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TranslationKey>("sahih");
  const [saved, setSaved] = useState(initiallySaved);
  const [, startTransition] = useTransition();

  const handleSaveToggle = () => {
    startTransition(async () => {
      const next = !saved;
      setSaved(next);
      try {
        if (next) {
          await saveCitation({
            kind: "quran",
            reference: verse.reference,
            arabic: verse.arabic,
            translation: verse.translations[activeTab] ?? verse.translations.sahih ?? "",
            translator: TRANSLATION_LABELS[activeTab],
          });
        } else {
          await unsaveCitation({ kind: "quran", reference: verse.reference });
        }
      } catch {
        setSaved(!next);
      }
    });
  };

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-paper)]",
        "border-l-2 border-[var(--color-citation)]",
        "shadow-[var(--shadow-soft)]",
        compact ? "p-5" : "p-7",
      )}
    >
      <header className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-citation)] font-[var(--font-ui)]">
            Quran · {verse.reference}
          </p>
          {verse.surahName && (
            <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] mt-0.5">
              Surah {verse.surahName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="text-xs font-[var(--font-ui)] text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
            >
              Open in full
            </button>
          )}
          {showSaveButton && (
            <SaveButton saved={saved} onToggle={handleSaveToggle} />
          )}
        </div>
      </header>

      {verse.arabic && (
        <p className="arabic mb-5 text-right text-[var(--color-ink)]">
          {verse.arabic}
        </p>
      )}

      <div className="space-y-3">
        {!compact && (
          <div className="flex items-center gap-1 flex-wrap">
            {TRANSLATION_ORDER.filter((k) => !!verse.translations[k]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveTab(k)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full transition-colors font-[var(--font-ui)]",
                  activeTab === k
                    ? "bg-[var(--color-citation-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {TRANSLATION_LABELS[k]}
              </button>
            ))}
          </div>
        )}
        <p className="text-lg leading-[1.7] text-[var(--color-ink)] italic">
          {verse.translations[activeTab] ?? verse.translations.sahih ?? ""}
        </p>
        {!compact && (
          <p className="text-xs font-[var(--font-ui)] text-[var(--color-whisper)] uppercase tracking-wider">
            {TRANSLATION_LABELS[activeTab]}
          </p>
        )}
      </div>
    </article>
  );
}

// ============================================================
// HadithCard
// ============================================================
export function HadithCard({
  hadith,
  initiallySaved = false,
  compact = false,
}: {
  hadith: HadithCitation;
  initiallySaved?: boolean;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [, startTransition] = useTransition();

  const handleSaveToggle = () => {
    startTransition(async () => {
      const next = !saved;
      setSaved(next);
      try {
        if (next) {
          await saveCitation({
            kind: "hadith",
            reference: hadith.reference,
            arabic: hadith.arabic ?? null,
            translation: hadith.english,
            grade: hadith.grade,
          });
        } else {
          await unsaveCitation({ kind: "hadith", reference: hadith.reference });
        }
      } catch {
        setSaved(!next);
      }
    });
  };

  const gradeColor = hadith.grade.toLowerCase().includes("sahih")
    ? "text-[var(--color-sage-deep)]"
    : hadith.grade.toLowerCase().includes("hasan")
      ? "text-[var(--color-dusk)]"
      : hadith.grade.toLowerCase().includes("da")
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-muted)]";

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-paper)]",
        "border-l-2 border-[var(--color-sage)]",
        "shadow-[var(--shadow-soft)]",
        compact ? "p-5" : "p-7",
      )}
    >
      <header className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-sage-deep)] font-[var(--font-ui)]">
            Hadith · {hadith.reference}
          </p>
          {hadith.collection && (
            <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] mt-0.5">
              {hadith.collection}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs font-[var(--font-ui)] uppercase tracking-wider",
              gradeColor,
            )}
            title="Hadith grading"
          >
            {hadith.grade}
          </span>
          <SaveButton saved={saved} onToggle={handleSaveToggle} />
        </div>
      </header>

      {hadith.arabic && (
        <p className="arabic mb-5 text-right text-[var(--color-ink)]">
          {hadith.arabic}
        </p>
      )}

      <p className="text-base leading-[1.75] text-[var(--color-ink)]">
        {hadith.english}
      </p>
    </article>
  );
}

// ============================================================
// TafsirCard
// ============================================================
export function TafsirCard({
  tafsir,
  compact = false,
}: {
  tafsir: TafsirCitation;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-surface)]",
        "border-l-2 border-[var(--color-dusk)]",
        compact ? "p-5" : "p-6",
      )}
    >
      <header className="mb-3">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-dusk)] font-[var(--font-ui)]">
          Tafsir · on Quran {tafsir.reference}
        </p>
        <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] mt-0.5">
          {tafsir.source}
        </p>
      </header>
      <p className="text-base leading-[1.75] text-[var(--color-ink)] whitespace-pre-line">
        {tafsir.text}
      </p>
    </article>
  );
}

// ============================================================
// SaveButton (internal)
// ============================================================
function SaveButton({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={saved ? "Remove from library" : "Save to library"}
      className={cn(
        "transition-colors duration-[var(--duration-fade)]",
        saved
          ? "text-[var(--color-citation)]"
          : "text-[var(--color-whisper)] hover:text-[var(--color-citation)]",
      )}
    >
      <BookmarkIcon filled={saved} className="w-5 h-5" />
    </button>
  );
}

function BookmarkIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
