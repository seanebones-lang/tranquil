import type { Job } from "bullmq";
import { generateObject } from "ai";
import { xai } from "@ai-sdk/xai";
import { z } from "zod";
import { prisma } from "../../src/lib/db";
import { MODELS } from "../../src/lib/xai";
import { getEmbedQueue, QUEUES, type OrganizeJob } from "../../src/lib/queue";

const OrganizedNoteSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(80)
    .describe("Title of 2-8 words capturing the core idea. Sentence case."),
  summary: z
    .string()
    .min(8)
    .max(280)
    .describe("One natural sentence summarizing the note."),
  topic: z
    .string()
    .min(2)
    .max(40)
    .describe(
      "One short topic this note belongs to (e.g. 'patience', 'family', 'tafsir-notes', 'business').",
    ),
  tags: z
    .array(z.string().min(2).max(30))
    .min(2)
    .max(7)
    .describe("Lowercase kebab-case tags. No spaces, no hashtags."),
});

const SYSTEM_PROMPT = `You are organizing a personal reflection notebook for a thoughtful Muslim writer.

Your job: read the note and return JSON with:
- title: 2-8 words, sentence case
- summary: one natural sentence (≤280 chars)
- topic: one short topical bucket
- tags: 2-7 lowercased kebab-case tags

Be specific, not generic. Prefer concrete tags like "patience-in-hardship" over
vague ones like "thoughts". If the note mentions Quran verses or hadiths, add a
tag for the subject (e.g. "sabr", "tawakkul"). Never invent content; only
classify what's there.`.trim();

export async function organizeProcessor(job: Job<OrganizeJob>) {
  const { noteId } = job.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      bodyMd: true,
      title: true,
      transcriptionStatus: true,
    },
  });
  if (!note) throw new Error(`Note ${noteId} not found`);

  // Don't try to organize an empty or still-transcribing note
  if (!note.bodyMd?.trim() || note.bodyMd.trim().length < 20) {
    await prisma.note.update({
      where: { id: noteId },
      data: { organizeStatus: "done" },
    });
    return;
  }

  let parsed;
  try {
    const result = await generateObject({
      model: xai(MODELS.cheap),
      schema: OrganizedNoteSchema,
      system: SYSTEM_PROMPT,
      prompt: `Note to organize:\n\n"""${note.bodyMd.slice(0, 8000)}"""`,
      temperature: 0.2,
    });
    parsed = result.object;
  } catch (e) {
    await prisma.note.update({
      where: { id: noteId },
      data: { organizeStatus: "failed" },
    });
    throw e;
  }

  // Only overwrite the title if the user hasn't set one
  const titleToSave = note.title?.trim() ? note.title : parsed.title;

  await prisma.note.update({
    where: { id: noteId },
    data: {
      title: titleToSave,
      aiSummary: parsed.summary,
      aiTopic: parsed.topic,
      aiTags: parsed.tags.map((t) => t.toLowerCase()),
      organizeStatus: "done",
    },
  });

  // Chain embed job to upload this note to user's Collection and link related notes
  await getEmbedQueue().add(QUEUES.embed, { noteId }, {
    jobId: `embed:${noteId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 3_000 },
  });
}
