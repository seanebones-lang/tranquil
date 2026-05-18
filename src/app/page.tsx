import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { PushToTalk } from "@/components/push-to-talk";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { Card } from "@/components/ui/card";
import { firstName, timeOfDayGreeting } from "@/lib/utils";

export default async function TodayPage() {
  const session = await auth();

  // Stamp lastSeenAt on every Today visit (dormancy heartbeat for heirloom)
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => { /* non-fatal */ });
  }

  const greeting = timeOfDayGreeting();
  const name = firstName(session?.user?.name);

  return (
    <>
      <Nav userName={session?.user?.name} />

      <main className="mx-auto max-w-2xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-12 sm:mb-16">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Today
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight">
            {greeting}{name ? `, ${name}` : ""}.
          </h1>
        </header>

        <section className="my-16 sm:my-20 flex flex-col items-center text-center">
          <p className="mb-10 text-[var(--color-muted)] text-lg italic">
            What's on your mind?
          </p>
          <PushToTalk />
          <p className="mt-6 text-xs font-[var(--font-ui)] text-[var(--color-whisper)] uppercase tracking-[0.15em]">
            or tap below to write
          </p>
          <a
            href="/notes/new"
            className="mt-3 text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)] text-base"
          >
            Open a blank page
          </a>
        </section>

        <section className="mt-20">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            A reflection for today
          </h2>
          <Card>
            <p className="text-lg leading-relaxed italic text-[var(--color-ink)]">
              "And whoever is patient and forgives — indeed, that is of the
              matters requiring determination."
            </p>
            <p className="mt-3 text-sm text-[var(--color-muted)] font-[var(--font-ui)]">
              — Quran 42:43 (Sahih International)
            </p>
          </Card>
        </section>

        <section className="mt-16">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            Recent notes
          </h2>
          <Card className="text-center py-12">
            <p className="text-[var(--color-muted)]">
              Your notes will appear here as you create them.
            </p>
          </Card>
        </section>
      </main>

      <ChatWidgetFab />
    </>
  );
}
