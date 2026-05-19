"use client";

import { useState, useTransition } from "react";
import { unsaveCitation } from "@/app/actions/research";
import { cn } from "@/lib/utils";

type Kind = "quran" | "hadith" | "tafsir";

export function LibraryItem({
  id,
  kind,
  reference,
  arabic,
  translation,
  translator,
  grade,
}: {
  id: string;
  kind: Kind;
  reference: string;
  arabic: string | null;
  translation: string | null;
  translator: string | null;
  grade: string | null;
}) {
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();

  if (removed) return null;

  const handleRemove = () => {
    startTransition(async () => {
      setRemoved(true);
      try {
        await unsaveCitation({ kind, reference });
      } catch {
        setRemoved(false);
      }
    });
  };

  const borderColor =
    kind === "quran"
      ? "border-[var(--color-citation)]"
      : kind === "hadith"
        ? "border-[var(--color-sage)]"
        : "border-[var(--color-dusk)]";

  const labelColor =
    kind === "quran"
      ? "text-[var(--color-citation)]"
      : kind === "hadith"
        ? "text-[var(--color-sage-deep)]"
        : "text-[var(--color-dusk)]";

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-surface)]",
        "border-l-2 p-5",
        "shadow-[var(--shadow-soft)]",
        borderColor,
      )}
    >
      <header className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <p className={cn("text-xs uppercase tracking-[0.15em] font-[var(--font-ui)]", labelColor)}>
            {kindLabel(kind)} · {reference}
          </p>
          {translator && (
            <p className="text-xs text-[var(--color-muted)] font-[var(--font-ui)] mt-0.5">
              {translator}
            </p>
          )}
          {grade && (
            <p className="text-xs text-[var(--color-muted)] font-[var(--font-ui)] mt-0.5">
              {grade}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="text-xs font-[var(--font-ui)] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
        >
          Remove
        </button>
      </header>

      {arabic && (
        <p className="arabic mb-3 text-right text-[var(--color-ink)] text-base">
          {arabic.length > 200 ? arabic.slice(0, 200) + "…" : arabic}
        </p>
      )}
      {translation && (
        <p className="text-base leading-[1.7] italic text-[var(--color-ink)] line-clamp-4">
          {translation}
        </p>
      )}
    </article>
  );
}

function kindLabel(k: Kind): string {
  return k === "quran" ? "Quran" : k === "hadith" ? "Hadith" : "Tafsir";
}
