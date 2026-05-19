"use client";

import { splitBodyByCitations, type CitationBlock } from "@/lib/slash-commands";
import { useEffect, useState } from "react";
import { lookupVerseAction } from "@/app/actions/research";
import { VerseCard, HadithCard, TafsirCard } from "@/components/citation-cards";
import type { QuranCitation, HadithCitation, TafsirCitation } from "@/lib/islamic";

export function NoteBody({ bodyMd }: { bodyMd: string }) {
  const parts = splitBodyByCitations(bodyMd);
  return (
    <div className="space-y-5">
      {parts.map((p, i) =>
        p.kind === "text" ? (
          p.value.trim() ? (
            <p
              key={i}
              className="text-lg leading-[1.8] whitespace-pre-line text-[var(--color-ink)] font-[var(--font-body)]"
            >
              {p.value}
            </p>
          ) : null
        ) : (
          <CitationRenderer key={i} block={p.value} />
        ),
      )}
    </div>
  );
}

function CitationRenderer({ block }: { block: CitationBlock }) {
  // For quran citations, hydrate from RAG so we get all four translations.
  // For hadith and tafsir, render directly from the stored data.
  if (block.kind === "quran") {
    return <HydratedVerse reference={block.reference} fallback={block} />;
  }
  if (block.kind === "hadith") {
    const h: HadithCitation = {
      kind: "hadith",
      reference: block.reference,
      collection: "",
      english: block.translation ?? "",
      arabic: block.arabic,
      grade: block.grade ?? "(not specified)",
      collectionDocId: "",
      score: 0,
    };
    return <HadithCard hadith={h} />;
  }
  // tafsir
  const t: TafsirCitation = {
    kind: "tafsir",
    reference: block.reference,
    text: block.text ?? block.translation ?? "",
    source: "",
    collectionDocId: "",
    score: 0,
  };
  return <TafsirCard tafsir={t} />;
}

function HydratedVerse({
  reference,
  fallback,
}: {
  reference: string;
  fallback: CitationBlock;
}) {
  const [verse, setVerse] = useState<QuranCitation | null>(null);
  useEffect(() => {
    let cancelled = false;
    void lookupVerseAction({ reference })
      .then((r) => {
        if (!cancelled && r.verse) setVerse(r.verse);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const v: QuranCitation = verse ?? {
    kind: "quran",
    reference,
    surahNumber: 0,
    ayahNumber: 0,
    surahName: "",
    arabic: fallback.arabic ?? "",
    translations: { sahih: fallback.translation },
    collectionDocId: "",
    score: 0,
  };
  return <VerseCard verse={v} compact />;
}
