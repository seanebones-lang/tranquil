import type { Job } from "bullmq";
import { prisma } from "../../src/lib/db";
import { ensureUserCollection } from "../../src/lib/user-collection";
import { uploadDocument, searchCollections } from "../../src/lib/collections";
import type { EmbedJob } from "../../src/lib/queue";

const SIMILARITY_THRESHOLD = 0.72;
const MAX_RELATED = 5;

export async function embedProcessor(job: Job<EmbedJob>) {
  const { noteId } = job.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      userId: true,
      title: true,
      bodyMd: true,
      aiSummary: true,
      aiTags: true,
      aiTopic: true,
      collectionDocId: true,
    },
  });
  if (!note) throw new Error(`Note ${noteId} not found`);
  if (!note.bodyMd?.trim()) return;

  const collectionId = await ensureUserCollection(note.userId);

  // Compose the document body for retrieval. We include AI-derived metadata so
  // hybrid (semantic + keyword) search can match either the prose or the tags.
  const composed = composeDocument(note);

  // Skip re-uploading if collectionDocId already exists and content is short
  // enough to assume unchanged. For simplicity (Phase 2), always re-upload
  // when re-organized; xAI Collections will treat each as a fresh document.
  // Phase 3 will add a content-hash check.
  const doc = await uploadDocument(
    collectionId,
    `note:${note.id}`,
    composed,
  );

  await prisma.note.update({
    where: { id: noteId },
    data: { collectionDocId: doc.document_id },
  });

  // Find related notes via the user's collection
  const queryText = [
    note.aiSummary,
    note.title,
    (note.aiTags ?? []).join(" "),
    note.bodyMd.slice(0, 1000),
  ]
    .filter(Boolean)
    .join("\n");

  let hits;
  try {
    hits = await searchCollections([collectionId], queryText, 10, "hybrid");
  } catch (e) {
    console.warn(`[embed] search failed for ${noteId}: ${(e as Error).message}`);
    return; // Non-fatal; embedding still succeeded
  }

  // Resolve hits to note ids in our DB. Hit names are "note:<noteId>".
  const candidateIds = hits
    .map((h) => h.name)
    .filter((n) => n.startsWith("note:"))
    .map((n) => n.slice(5))
    .filter((id) => id !== noteId);

  if (candidateIds.length === 0) return;

  // Confirm those candidates exist and belong to the same user
  const related = await prisma.note.findMany({
    where: {
      id: { in: candidateIds },
      userId: note.userId,
      deletedAt: null,
    },
    select: { id: true },
  });
  const relatedIds = new Set(related.map((r) => r.id));

  // Build similarity map from hits
  const sims = new Map<string, number>();
  for (const h of hits) {
    if (!h.name.startsWith("note:")) continue;
    const id = h.name.slice(5);
    if (id === noteId || !relatedIds.has(id)) continue;
    if (h.score >= SIMILARITY_THRESHOLD) {
      sims.set(id, Math.max(sims.get(id) ?? 0, h.score));
    }
  }

  const top = [...sims.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RELATED);

  if (top.length === 0) return;

  // Rewrite relations for this note (replace prior set)
  await prisma.$transaction([
    prisma.relatedNote.deleteMany({ where: { noteId } }),
    prisma.relatedNote.createMany({
      data: top.map(([relatedNoteId, similarity]) => ({
        noteId,
        relatedNoteId,
        similarity,
      })),
      skipDuplicates: true,
    }),
  ]);
}

function composeDocument(n: {
  title: string | null;
  bodyMd: string;
  aiSummary: string | null;
  aiTags: string[];
  aiTopic: string | null;
}): string {
  const parts: string[] = [];
  if (n.title) parts.push(`Title: ${n.title}`);
  if (n.aiTopic) parts.push(`Topic: ${n.aiTopic}`);
  if (n.aiTags?.length) parts.push(`Tags: ${n.aiTags.join(", ")}`);
  if (n.aiSummary) parts.push(`Summary: ${n.aiSummary}`);
  parts.push("");
  parts.push(n.bodyMd);
  return parts.join("\n");
}
