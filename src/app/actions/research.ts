"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { answerWithCitations, type ResearchAnswer } from "@/lib/research";
import {
  lookupVerse,
  lookupTafsir,
  type QuranCitation,
  type TafsirCitation,
} from "@/lib/islamic";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

const askSchema = z.object({
  question: z.string().min(3).max(500),
});

export async function askResearch(
  input: z.infer<typeof askSchema>,
): Promise<ResearchAnswer> {
  await requireUserId();
  const { question } = askSchema.parse(input);
  return answerWithCitations(question);
}

const refSchema = z.object({
  reference: z.string().regex(/^\d{1,3}:\d{1,3}$/),
});

export async function lookupVerseAction(
  input: z.infer<typeof refSchema>,
): Promise<{ verse: QuranCitation | null; tafsir: TafsirCitation | null }> {
  await requireUserId();
  const { reference } = refSchema.parse(input);
  const [verse, tafsir] = await Promise.all([
    lookupVerse(reference),
    lookupTafsir(reference),
  ]);
  return { verse, tafsir };
}

// ---- Library: save / unsave / list ----

const saveSchema = z.object({
  kind: z.enum(["quran", "hadith", "tafsir"]),
  reference: z.string().min(1).max(60),
  arabic: z.string().max(8000).nullable().optional(),
  translation: z.string().max(8000).nullable().optional(),
  translator: z.string().max(80).nullable().optional(),
  grade: z.string().max(80).nullable().optional(),
  note: z.string().max(800).nullable().optional(),
});

export async function saveCitation(input: z.infer<typeof saveSchema>) {
  const userId = await requireUserId();
  const data = saveSchema.parse(input);

  await prisma.savedCitation.upsert({
    where: {
      userId_kind_reference: {
        userId,
        kind: data.kind,
        reference: data.reference,
      },
    },
    create: { userId, ...data },
    update: {
      arabic: data.arabic ?? null,
      translation: data.translation ?? null,
      translator: data.translator ?? null,
      grade: data.grade ?? null,
      note: data.note ?? null,
    },
  });
  revalidatePath("/library");
  return { ok: true };
}

export async function unsaveCitation(input: {
  kind: "quran" | "hadith" | "tafsir";
  reference: string;
}) {
  const userId = await requireUserId();
  await prisma.savedCitation.deleteMany({
    where: { userId, kind: input.kind, reference: input.reference },
  });
  revalidatePath("/library");
  return { ok: true };
}

export async function isSaved(
  kind: "quran" | "hadith" | "tafsir",
  reference: string,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const found = await prisma.savedCitation.findUnique({
    where: {
      userId_kind_reference: {
        userId: session.user.id,
        kind,
        reference,
      },
    },
    select: { id: true },
  });
  return !!found;
}
