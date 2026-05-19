import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings-form";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      fontScale: true,
      contrast: true,
      reducedMotion: true,
      ambientSound: true,
      heirloomContactEmail: true,
      heirloomUnlockAfterDays: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  if (!user) redirect("/signin");

  const activeGrants = await prisma.heirloomAccess.findMany({
    where: { ownerId: session.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, heirEmail: true, createdAt: true, expiresAt: true, unlockedAt: true },
  });

  const noteCount = await prisma.note.count({
    where: { userId: session.user.id, deletedAt: null },
  });

  return (
    <>
      <Nav userName={session.user.name} />
      <main className="mx-auto max-w-2xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-12">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Settings
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight">Your space.</h1>
        </header>

        <SettingsForm
          initial={{
            fontScale: user.fontScale,
            contrast: user.contrast as "standard" | "high",
            reducedMotion: user.reducedMotion,
            ambientSound: user.ambientSound,
            heirloomContactEmail: user.heirloomContactEmail,
            heirloomUnlockAfterDays: user.heirloomUnlockAfterDays,
          }}
          activeGrants={activeGrants.map((g) => ({
            id: g.id,
            heirEmail: g.heirEmail,
            createdAt: g.createdAt.toISOString(),
            expiresAt: g.expiresAt.toISOString(),
            unlockedAt: g.unlockedAt?.toISOString() ?? null,
          }))}
        />

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            Your data
          </h2>
          <Card>
            <p className="text-base mb-4">
              You have <strong>{noteCount}</strong> {noteCount === 1 ? "note" : "notes"}{" "}
              saved here, since {format(user.createdAt, "MMMM yyyy")}.
            </p>
            <p className="space-y-2">
              <Link
                href="/api/export"
                className="inline-block text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
              >
                Download all notes as markdown
              </Link>
            </p>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
            Account
          </h2>
          <Card>
            <p className="text-sm text-[var(--color-muted)] font-[var(--font-ui)]">
              Signed in as <strong>{user.email}</strong>
            </p>
          </Card>
        </section>
      </main>
    </>
  );
}
