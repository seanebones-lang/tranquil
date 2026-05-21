import Link from "next/link";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { PushToTalk } from "@/components/push-to-talk";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { Card } from "@/components/ui/card";
import { isR2Configured } from "@/lib/r2";
import { firstName, timeOfDayGreeting } from "@/lib/utils";
import { format } from "date-fns";

export default async function TodayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const voiceUploadsEnabled = isR2Configured();

  if (userId) {
    await prisma.user
      .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  const today = startOfTodayUTC();

  const [recent, reflection] = await Promise.all([
    userId
      ? prisma.note.findMany({
          where: { userId, deletedAt: null, status: { in: ["saved", "draft"] } },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: {
            id: true,
            title: true,
            aiSummary: true,
            bodyMd: true,
            source: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    userId
      ? prisma.dailyReflection.findUnique({
          where: { userId_date: { userId, date: today } },
          select: { prompt: true },
        })
      : Promise.resolve(null),
  ]);

  const greeting = timeOfDayGreeting();
  const name = firstName(session?.user?.name);

  // Default reflection if dynamic one isn't ready yet
  const reflectionText = reflection?.prompt ?? defaultReflection();

  return (
    <>
      <Nav userName={session?.user?.name} />

      <main className="mx-auto max-w-2xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-12 sm:mb-16">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Today
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight">
            {greeting}
            {name ? `, ${name}` : ""}.
          </h1>
        </header>

        <section className="my-16 sm:my-20 flex flex-col items-center text-center">
          <p className="mb-10 text-[var(--color-muted)] text-lg italic">
            What&apos;s on your mind?
          </p>
          <PushToTalk uploadsEnabled={voiceUploadsEnabled} />
          <p className="mt-6 text-xs font-[var(--font-ui)] text-[var(--color-whisper)] uppercase tracking-[0.15em]">
            or tap below to write
          </p>
          <Link
            href="/notes/new"
            className="mt-3 text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)] text-base"
          >
            Open a blank page
          </Link>
        </section>

        <section className="mt-20">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            A reflection for today
          </h2>
          <Card>
            <p className="text-lg leading-relaxed italic text-[var(--color-ink)]">
              {reflectionText}
            </p>
          </Card>
        </section>

        <section className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)]">
              Recent notes
            </h2>
            {recent.length > 0 && (
              <Link
                href="/notes"
                className="text-xs font-[var(--font-ui)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                See all
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[var(--color-muted)]">
                Your notes will appear here as you create them.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {recent.map((n) => (
                <li key={n.id}>
                  <Link href={`/notes/${n.id}`} className="block group">
                    <Card className="py-4">
                      <div className="flex items-start gap-3">
                        {n.source === "voice" && (
                          <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-sage)] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)] group-hover:text-[var(--color-sage-deep)] line-clamp-1">
                            {n.title ?? "Untitled"}
                          </p>
                          <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)] line-clamp-1 mt-0.5">
                            {n.aiSummary ?? n.bodyMd?.slice(0, 120) ?? ""}
                          </p>
                        </div>
                        <span className="text-xs text-[var(--color-whisper)] font-[var(--font-ui)] shrink-0">
                          {format(n.updatedAt, "MMM d")}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ChatWidgetFab />
    </>
  );
}

function defaultReflection(): string {
  return `Quran 42:43: "And whoever is patient and forgives — indeed, that is of the matters requiring determination."`;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
