/**
 * Agent tools — registered with Grok 4.3 via the AI SDK's tool() helper.
 *
 * Five tools:
 *   1. search_my_notes  — RAG over the user's personal Grok Collection
 *   2. quran_search     — shared Quran Collection
 *   3. hadith_search    — shared Hadith Collection
 *   4. tafsir_search    — shared Tafsir Collection
 *   5. web_search       — xAI's native server-side web search via Grok tool-use
 *   6. app_help         — static help corpus authored below
 *
 * Each returns structured data the client can render as citations. The agent
 * is told (in the system prompt) to call tools first and never invent.
 */
import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  searchQuran,
  searchHadith,
  searchTafsir,
  type QuranCitation,
  type HadithCitation,
  type TafsirCitation,
} from "@/lib/islamic";
import { ensureUserCollection } from "@/lib/user-collection";
import { searchCollections } from "@/lib/collections";

export type NoteHit = {
  noteId: string;
  title: string | null;
  summary: string | null;
  snippet: string;
  updatedAt: string;
  score: number;
};

export type HelpHit = {
  topic: string;
  body: string;
};

// =====================================================
// Static app help corpus
// =====================================================
const APP_HELP: Record<string, string> = {
  "recording-a-note":
    "On the Today screen, hold the sage button to record. Release when you're done. " +
    "We transcribe with Grok STT, then auto-organize: title, summary, tags, and topic. " +
    "It usually takes 10-20 seconds for the full pipeline.",
  "searching-quran":
    "Go to Research. Type a question in plain English. Answers come only from the " +
    "Quran, Sahih Sittah, and Tafsir Ibn Kathir — never invented. Tap any verse to open " +
    "all four translations side-by-side with tafsir and audio recitation.",
  "inserting-citations":
    "Inside a note, type /verse 2:255 or /tafsir 2:255 or /hadith kindness to neighbors. " +
    "Then tap 'Expand citations' (or press Cmd-Enter on desktop). The slash command " +
    "becomes a structured citation block. Toggle to Read mode to see the rendered card.",
  "saving-citations":
    "Tap the bookmark icon on any verse or hadith card. Find them all in Library, " +
    "grouped by Quran, Hadith, or Tafsir.",
  "related-notes":
    "When you save a note, we embed it into your private Grok Collection and find " +
    "the most similar notes you've written. They appear in the side panel of the editor.",
  "exporting-notes":
    "Coming in Phase 5: you'll be able to export a single note or all of your notes " +
    "as a PDF.",
  "heirloom-access":
    "Coming in Phase 5: set a trusted contact and a dormancy threshold. If you don't " +
    "sign in for that long, they get one-time read access to notes you flag as " +
    "heirloom-visible.",
  "voice-vs-text":
    "Voice is fastest for capturing a thought. Text is better when you want to shape " +
    "and edit. Both auto-save and get the same AI organization.",
};

// =====================================================
// Tool factory — bound to the current user's id
// =====================================================
export function buildToolsForUser(userId: string) {
  return {
    search_my_notes: tool({
      description:
        "Search the user's personal notes by semantic similarity. Use whenever the user " +
        "asks 'what did I write about X', 'find my thoughts on Y', or references their " +
        "own notes implicitly.",
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("Natural language search query."),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }): Promise<NoteHit[]> => {
        const collectionId = await ensureUserCollection(userId).catch(() => null);
        if (!collectionId) return [];
        const hits = await searchCollections(
          [collectionId],
          query,
          limit,
          "hybrid",
        );
        if (hits.length === 0) return [];
        const noteIds = hits
          .filter((h) => h.name.startsWith("note:"))
          .map((h) => h.name.slice(5));
        const notes = await prisma.note.findMany({
          where: {
            id: { in: noteIds },
            userId,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            bodyMd: true,
            aiSummary: true,
            updatedAt: true,
          },
        });
        const byId = new Map(notes.map((n) => [n.id, n]));
        return hits
          .filter((h) => h.name.startsWith("note:"))
          .map((h) => {
            const id = h.name.slice(5);
            const n = byId.get(id);
            if (!n) return null;
            return {
              noteId: n.id,
              title: n.title,
              summary: n.aiSummary,
              snippet: (n.aiSummary ?? n.bodyMd).slice(0, 240),
              updatedAt: n.updatedAt.toISOString(),
              score: h.score,
            };
          })
          .filter((x): x is NoteHit => x !== null);
      },
    }),

    quran_search: tool({
      description:
        "Search the Quran for verses relevant to a question. Returns Arabic + four " +
        "English translations per verse with the canonical reference. Use whenever " +
        "the user asks what the Quran says about a topic, or implies a need for " +
        "scriptural grounding.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(8).default(5),
      }),
      execute: async ({ query, limit }): Promise<QuranCitation[]> =>
        searchQuran(query, limit),
    }),

    hadith_search: tool({
      description:
        "Search the Sahih Sittah (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn " +
        "Majah) for hadith on a topic. Returns grading (sahih/hasan/da'if) with " +
        "every result.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(8).default(5),
      }),
      execute: async ({ query, limit }): Promise<HadithCitation[]> =>
        searchHadith(query, limit),
    }),

    tafsir_search: tool({
      description:
        "Search Tafsir Ibn Kathir (English, abridged) for commentary on a Quran " +
        "topic or specific verse reference.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ query, limit }): Promise<TafsirCitation[]> =>
        searchTafsir(query, limit),
    }),

    app_help: tool({
      description:
        "Look up app guidance — how to record a note, how citations work, how to " +
        "search the Quran, etc. Use when the user asks how to do something inside " +
        "this app specifically.",
      inputSchema: z.object({
        topic: z
          .enum([
            "recording-a-note",
            "searching-quran",
            "inserting-citations",
            "saving-citations",
            "related-notes",
            "exporting-notes",
            "heirloom-access",
            "voice-vs-text",
          ])
          .describe("The help topic to retrieve."),
      }),
      execute: async ({ topic }): Promise<HelpHit> => ({
        topic,
        body: APP_HELP[topic] ?? "No guidance written for that topic yet.",
      }),
    }),
  };
}
