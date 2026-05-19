"use server";

import { z } from "zod";
import { auth } from "~/auth";
import { lookupVerse, lookupTafsir, searchHadith } from "@/lib/islamic";
import type { CitationBlock } from "@/lib/slash-commands";

const schema = z.object({
  command: z.enum(["verse", "tafsir", "hadith"]),
  argument: z.string().min(1).max(60),
});

export async function expandSlashCommand(
  input: z.infer<typeof schema>,
): Promise<{ block: CitationBlock } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const { command, argument } = schema.parse(input);

  if (command === "verse") {
    if (!/^\d{1,3}:\d{1,3}$/.test(argument)) {
      return { error: `Expected surah:ayah like "2:255"` };
    }
    const verse = await lookupVerse(argument);
    if (!verse) return { error: `Couldn't find verse ${argument}` };
    return {
      block: {
        kind: "quran",
        reference: verse.reference,
        arabic: verse.arabic,
        translation: verse.translations.sahih ?? "",
        translator: "Sahih International",
      },
    };
  }

  if (command === "tafsir") {
    if (!/^\d{1,3}:\d{1,3}$/.test(argument)) {
      return { error: `Expected surah:ayah like "2:255"` };
    }
    const tafsir = await lookupTafsir(argument);
    if (!tafsir) return { error: `Couldn't find tafsir for ${argument}` };
    return {
      block: {
        kind: "tafsir",
        reference: tafsir.reference,
        text: tafsir.text,
      },
    };
  }

  // Hadith: argument is a search-style fragment. For now we do a small search
  // and return the top result.
  const results = await searchHadith(argument, 1);
  if (results.length === 0) {
    return { error: `Couldn't find a hadith matching "${argument}"` };
  }
  const h = results[0];
  return {
    block: {
      kind: "hadith",
      reference: h.reference,
      translation: h.english,
      arabic: h.arabic,
      grade: h.grade,
    },
  };
}
