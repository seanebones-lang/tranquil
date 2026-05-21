import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { NoteBody } from "@/components/note-body";
import { format } from "date-fns";

type Search = { token?: string };

export const dynamic = "force-dynamic";

export default async function HeirloomAccessPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (!token) {
    return <InvalidView reason="No token in the link." />;
  }

  const grant = await prisma.heirloomAccess.findUnique({
    where: { unlockToken: token },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!grant) return <InvalidView reason="This link is not recognized." />;
  if (grant.revokedAt) return <InvalidView reason="This link has been revoked." />;
  if (grant.expiresAt < new Date()) {
    return <InvalidView reason="This link has expired." />;
  }

  // First visit: mark unlocked
  if (!grant.unlockedAt) {
    await prisma.heirloomAccess.update({
      where: { id: grant.id },
      data: { unlockedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: grant.ownerId,
        action: "heirloom.opened",
        targetId: grant.heirEmail,
      },
    });
  }

  const notes = await prisma.note.findMany({
    where: {
      userId: grant.ownerId,
      deletedAt: null,
      isHeirloomVisible: true,
      status: { in: ["saved", "published"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      bodyMd: true,
      aiSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const ownerName = grant.owner.name ?? grant.owner.email ?? "Someone";

  return (
    <main className="mx-auto max-w-3xl px-6 sm:px-10 pt-8 pb-32">
      <header className="mb-12 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
          A keepsake
        </p>
        <h1 className="text-4xl sm:text-5xl tracking-tight mb-4">
          The notebook of {ownerName}.
        </h1>
        <p className="text-[var(--color-muted)] italic">
          {notes.length} {notes.length === 1 ? "note" : "notes"}, kept here for you to read.
        </p>
      </header>

      {notes.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-[var(--color-muted)] italic">
            No notes were shared.
          </p>
        </Card>
      ) : (
        <div className="space-y-12">
          {notes.map((n) => (
            <article key={n.id}>
              <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-1">
                  {format(n.createdAt, "MMMM yyyy")}
                </p>
                <h2 className="text-3xl tracking-tight">{n.title ?? "Untitled"}</h2>
              </header>
              <NoteBody bodyMd={n.bodyMd} />
            </article>
          ))}
        </div>
      )}

      <footer className="mt-20 text-center text-xs font-[var(--font-ui)] text-[var(--color-whisper)]">
        <p>This is a private keepsake. The link is for your eyes only.</p>
        <p className="mt-2">
          <Link
            href={`/api/export?heirloomToken=${encodeURIComponent(token)}`}
            className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
          >
            Download all notes as text
          </Link>
        </p>
      </footer>
    </main>
  );
}

function InvalidView({ reason }: { reason: string }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-md">
        <h1 className="text-3xl tracking-tight mb-4">
          This link doesn&apos;t work.
        </h1>
        <p className="text-[var(--color-muted)]">{reason}</p>
      </div>
    </main>
  );
}
