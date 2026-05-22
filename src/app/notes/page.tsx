import Link from "next/link";
import { redirect } from "next/navigation";
import { format, isThisMonth, isThisYear } from "date-fns";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Search = { view?: string; q?: string; topic?: string };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  // Middleware already verified Clerk; missing bridge = DB/sync issue — avoid /signin loops.
  if (!userId) redirect("/");

  const sp = await searchParams;
  const view = sp.view ?? "timeline";
  const q = (sp.q ?? "").trim();
  const topic = sp.topic ?? null;

  const notes = await prisma.note.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ["saved", "draft"] },
      ...(topic ? { aiTopic: topic } : {}),
      ...(q
        ? {
            OR: [
              { title:    { contains: q, mode: "insensitive" } },
              { bodyMd:   { contains: q, mode: "insensitive" } },
              { aiSummary:{ contains: q, mode: "insensitive" } },
              { aiTags:   { has: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      bodyMd: true,
      aiSummary: true,
      aiTags: true,
      aiTopic: true,
      source: true,
      updatedAt: true,
    },
    take: 200,
  });

  const topics =
    view === "topics"
      ? await prisma.note.groupBy({
          by: ["aiTopic"],
          where: { userId, deletedAt: null, aiTopic: { not: null } },
          _count: { aiTopic: true },
          orderBy: { _count: { aiTopic: "desc" } },
        })
      : [];

  return (
    <>
      <Nav userName={session.user.name} />

      <main className="mx-auto max-w-3xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-10 flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-2">
              Notes
            </p>
            <h1 className="text-4xl sm:text-5xl tracking-tight">
              {topic ? topic : "Your library."}
            </h1>
          </div>
          <Link href="/notes/new">
            <Button>New note</Button>
          </Link>
        </header>

        <div className="mb-8 flex items-center gap-2 text-sm font-[var(--font-ui)]">
          <TabLink href="/notes?view=timeline" active={view === "timeline"}>
            Timeline
          </TabLink>
          <TabLink href="/notes?view=topics" active={view === "topics"}>
            Topics
          </TabLink>
          <TabLink href="/notes?view=search" active={view === "search"}>
            Search
          </TabLink>
        </div>

        {view === "search" && (
          <form className="mb-8" action="/notes" method="get">
            <input type="hidden" name="view" value="search" />
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Search your notes…"
              className="w-full h-12 px-4 rounded-[var(--radius-md)] bg-[var(--color-paper)] border border-[var(--color-surface-strong)] focus:border-[var(--color-sage)] outline-none font-[var(--font-ui)]"
            />
          </form>
        )}

        {view === "topics" && topics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {topics.map((t) => (
              <Link
                key={t.aiTopic ?? "x"}
                href={`/notes?topic=${encodeURIComponent(t.aiTopic ?? "")}`}
                className="block"
              >
                <Card className="py-5">
                  <p className="font-[var(--font-display)] text-xl">{t.aiTopic}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-1 font-[var(--font-ui)]">
                    {t._count.aiTopic} {t._count.aiTopic === 1 ? "note" : "notes"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {notes.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-[var(--color-muted)] italic">
              {q ? "Nothing matches that yet." : "No notes yet. Start one above."}
            </p>
          </Card>
        ) : (
          <NoteList notes={notes} />
        )}
      </main>

      <ChatWidgetFab />
    </>
  );
}

function TabLink({
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

type NoteListItem = {
  id: string;
  title: string | null;
  bodyMd: string;
  aiSummary: string | null;
  aiTags: string[];
  aiTopic: string | null;
  source: string;
  updatedAt: Date;
};

function NoteList({ notes }: { notes: NoteListItem[] }) {
  const grouped = groupByMonth(notes);
  return (
    <div className="space-y-12">
      {grouped.map(([label, group]) => (
        <section key={label}>
          <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            {label}
          </h2>
          <ul className="space-y-3">
            {group.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="block group">
                  <Card className="py-5 hover:shadow-[var(--shadow-lifted)] transition-shadow">
                    <div className="flex items-start gap-3">
                      {n.source === "voice" && (
                        <span
                          className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-sage)] shrink-0"
                          aria-label="voice note"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)] group-hover:text-[var(--color-sage-deep)] line-clamp-1 mb-1">
                          {n.title ?? "Untitled"}
                        </p>
                        <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] line-clamp-2 leading-relaxed">
                          {n.aiSummary ?? n.bodyMd.slice(0, 180)}
                        </p>
                        {n.aiTags.length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {n.aiTags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] uppercase tracking-wider text-[var(--color-whisper)] font-[var(--font-ui)]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupByMonth(
  notes: NoteListItem[],
): Array<[string, NoteListItem[]]> {
  const map = new Map<string, NoteListItem[]>();
  for (const n of notes) {
    const key = labelForDate(n.updatedAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return [...map.entries()];
}

function labelForDate(d: Date): string {
  if (isThisMonth(d)) return "This month";
  if (isThisYear(d)) return format(d, "MMMM");
  return format(d, "MMMM yyyy");
}
