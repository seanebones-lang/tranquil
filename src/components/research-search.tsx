"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { askResearch } from "@/app/actions/research";
import type { ResearchAnswer } from "@/lib/research";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { VerseCard, HadithCard, TafsirCard } from "@/components/citation-cards";
import { VerseModal } from "@/components/verse-modal";

export function ResearchSearch() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [openVerse, setOpenVerse] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      try {
        const res = await askResearch({ question });
        setAnswer(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  const quranCites = (answer?.citations ?? []).filter((c) => c.kind === "quran");
  const hadithCites = (answer?.citations ?? []).filter((c) => c.kind === "hadith");
  const tafsirCites = (answer?.citations ?? []).filter((c) => c.kind === "tafsir");

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 mb-10">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What does the Quran say about patience in hardship?"
          autoFocus
        />
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "Searching the sources…" : "Search"}
        </Button>
      </form>

      {error && (
        <Card className="border-l-2 border-[var(--color-danger)]">
          <p className="text-[var(--color-danger)]">{error}</p>
        </Card>
      )}

      {answer && (
        <div className="space-y-8">
          <Card
            className={cn(
              "border-l-2",
              answer.refused
                ? "border-[var(--color-muted)]"
                : "border-[var(--color-sage)]",
            )}
          >
            <p className="text-lg leading-[1.8] text-[var(--color-ink)] italic">
              {answer.prose}
            </p>
          </Card>

          {quranCites.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
                From the Quran
              </h2>
              <div className="space-y-3">
                {quranCites.map((c, i) =>
                  c.kind === "quran" ? (
                    <VerseCard
                      key={`${c.citation.reference}-${i}`}
                      verse={c.citation}
                      onOpenModal={() => setOpenVerse(c.citation.reference)}
                    />
                  ) : null,
                )}
              </div>
            </section>
          )}

          {hadithCites.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
                From the Hadith
              </h2>
              <div className="space-y-3">
                {hadithCites.map((c, i) =>
                  c.kind === "hadith" ? (
                    <HadithCard
                      key={`${c.citation.reference}-${i}`}
                      hadith={c.citation}
                    />
                  ) : null,
                )}
              </div>
            </section>
          )}

          {tafsirCites.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
                From the Tafsir
              </h2>
              <div className="space-y-3">
                {tafsirCites.map((c, i) =>
                  c.kind === "tafsir" ? (
                    <TafsirCard
                      key={`${c.citation.reference}-${i}`}
                      tafsir={c.citation}
                    />
                  ) : null,
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <VerseModal
        reference={openVerse}
        open={openVerse !== null}
        onClose={() => setOpenVerse(null)}
      />
    </>
  );
}
