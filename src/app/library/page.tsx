import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { Card } from "@/components/ui/card";
import { LibraryItem } from "@/components/library-item";

type Search = { kind?: string };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const sp = await searchParams;
  const kindFilter =
    sp.kind === "quran" || sp.kind === "hadith" || sp.kind === "tafsir"
      ? sp.kind
      : null;

  const items = await prisma.savedCitation.findMany({
    where: { userId, ...(kindFilter ? { kind: kindFilter } : {}) },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.savedCitation.groupBy({
    by: ["kind"],
    where: { userId },
    _count: { kind: true },
  });
  const countOf = (k: string) =>
    counts.find((c) => c.kind === k)?._count.kind ?? 0;

  return (
    <>
      <Nav userName={session.user.name} />
      <main className="mx-auto max-w-3xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Library
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight">Saved citations.</h1>
        </header>

        <div className="mb-8 flex items-center gap-2 text-sm font-[var(--font-ui)]">
          <FilterTab href="/library" active={!kindFilter}>
            All ({items.length === 0 ? 0 : countOf("quran") + countOf("hadith") + countOf("tafsir")})
          </FilterTab>
          <FilterTab href="/library?kind=quran" active={kindFilter === "quran"}>
            Quran ({countOf("quran")})
          </FilterTab>
          <FilterTab href="/library?kind=hadith" active={kindFilter === "hadith"}>
            Hadith ({countOf("hadith")})
          </FilterTab>
          <FilterTab href="/library?kind=tafsir" active={kindFilter === "tafsir"}>
            Tafsir ({countOf("tafsir")})
          </FilterTab>
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-[var(--color-muted)] italic mb-4">
              Nothing saved yet.
            </p>
            <Link
              href="/research"
              className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)] text-sm font-[var(--font-ui)]"
            >
              Go to Research →
            </Link>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id}>
                <LibraryItem
                  id={i.id}
                  kind={i.kind}
                  reference={i.reference}
                  arabic={i.arabic}
                  translation={i.translation}
                  translator={i.translator}
                  grade={i.grade}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
      <ChatWidgetFab />
    </>
  );
}

function FilterTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "px-3 py-1.5 rounded-full transition-colors " +
        (active
          ? "bg-[var(--color-sage)] text-white"
          : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]")
      }
    >
      {children}
    </Link>
  );
}
