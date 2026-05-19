import Link from "next/link";

type RelatedNote = {
  id: string;
  title: string | null;
  summary: string | null;
  similarity: number;
};

export function RelatedNotesPanel({ related }: { related: RelatedNote[] }) {
  if (related.length === 0) {
    return (
      <div className="text-xs uppercase tracking-[0.15em] text-[var(--color-whisper)] font-[var(--font-ui)]">
        Related notes will appear here as you write more.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xs uppercase tracking-[0.15em] text-[var(--color-whisper)] font-[var(--font-ui)]">
        Related notes
      </h2>
      <ul className="space-y-4">
        {related.map((r) => (
          <li key={r.id}>
            <Link
              href={`/notes/${r.id}`}
              className="block group"
            >
              <p className="font-[var(--font-display)] text-base text-[var(--color-ink)] group-hover:text-[var(--color-sage-deep)] line-clamp-2 mb-1">
                {r.title ?? "Untitled"}
              </p>
              {r.summary && (
                <p className="text-xs font-[var(--font-ui)] text-[var(--color-muted)] line-clamp-2 leading-relaxed">
                  {r.summary}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
