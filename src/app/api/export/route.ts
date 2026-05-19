import { NextResponse } from "next/server";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { splitBodyByCitations } from "@/lib/slash-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export endpoint.
 *
 * GET /api/export?noteId=...           -> single note (authenticated owner)
 * GET /api/export                       -> all notes for authenticated user
 * GET /api/export?heirloomToken=...     -> all heirloom-visible notes for the
 *                                          token's owner
 *
 * Returns plain markdown as `text/markdown` attachment. PDF export is a
 * follow-on (the markdown serves as the canonical export format; converting
 * to PDF is one shell command client-side or via a separate worker job).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const noteId = url.searchParams.get("noteId");
  const heirloomToken = url.searchParams.get("heirloomToken");

  let ownerId: string | null = null;
  let ownerLabel = "Notebook";

  if (heirloomToken) {
    const grant = await prisma.heirloomAccess.findUnique({
      where: { unlockToken: heirloomToken },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    if (!grant || grant.revokedAt || grant.expiresAt < new Date()) {
      return new NextResponse("Invalid or expired link", { status: 403 });
    }
    ownerId = grant.ownerId;
    ownerLabel = grant.owner.name ?? grant.owner.email ?? "Notebook";
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    ownerId = session.user.id;
    ownerLabel = session.user.name ?? session.user.email ?? "Notebook";
  }

  const where = noteId
    ? { id: noteId, userId: ownerId, deletedAt: null }
    : heirloomToken
      ? { userId: ownerId, deletedAt: null, isHeirloomVisible: true, status: { in: ["saved", "published"] as const } }
      : { userId: ownerId, deletedAt: null, status: { in: ["saved", "draft", "published"] as const } };

  const notes = await prisma.note.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      bodyMd: true,
      aiTopic: true,
      aiTags: true,
      aiSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const md = renderMarkdown(notes, ownerLabel);
  const filename = noteId
    ? `${slug(notes[0]?.title ?? "note")}.md`
    : `${slug(ownerLabel)}-notebook-${format(new Date(), "yyyy-MM-dd")}.md`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function renderMarkdown(
  notes: Array<{
    id: string;
    title: string | null;
    bodyMd: string;
    aiTopic: string | null;
    aiTags: string[];
    aiSummary: string | null;
    createdAt: Date;
  }>,
  ownerLabel: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${ownerLabel} — A Tranquil Space`);
  lines.push("");
  lines.push(`*Exported ${format(new Date(), "PPP")}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const n of notes) {
    lines.push(`## ${n.title ?? "Untitled"}`);
    lines.push("");
    lines.push(`*${format(n.createdAt, "PPP")}*`);
    if (n.aiTopic) lines.push(`*Topic: ${n.aiTopic}*`);
    if (n.aiTags?.length) lines.push(`*Tags: ${n.aiTags.join(", ")}*`);
    lines.push("");

    // Render body, converting fenced citation blocks into readable prose
    const parts = splitBodyByCitations(n.bodyMd);
    for (const p of parts) {
      if (p.kind === "text") {
        if (p.value.trim()) {
          lines.push(p.value.trim());
          lines.push("");
        }
      } else {
        const c = p.value;
        if (c.kind === "quran") {
          lines.push(`> **Quran ${c.reference}**`);
          if (c.arabic) lines.push(`> ${c.arabic}`);
          if (c.translation) lines.push(`> ${c.translation} — ${c.translator ?? "translation"}`);
        } else if (c.kind === "hadith") {
          lines.push(`> **Hadith ${c.reference}** _(${c.grade ?? "ungraded"})_`);
          if (c.translation) lines.push(`> ${c.translation}`);
        } else {
          lines.push(`> **Tafsir on ${c.reference}**`);
          if (c.text) lines.push(`> ${c.text.slice(0, 600)}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "notebook";
}
