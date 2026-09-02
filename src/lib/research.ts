import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./xai";
import {
  searchQuran,
  searchHadith,
  searchTafsir,
  isIslamicResearchConfigured,
  type QuranCitation,
  type HadithCitation,
  type TafsirCitation,
} from "./islamic";

/**
 * Citation-enforced research.
 *
 * The contract: Grok composes a short, plain-prose answer drawing ONLY from
 * the verses/hadiths/tafsir passages we hand it via RAG. Every citation it
 * returns must have a collectionDocId that appears in the hits we provided.
 *
 * If Grok hallucinates a citation (returns a doc id we didn't give it), we
 * reject and retry once with a stricter system prompt. If it still fails, we
 * return the raw hits without commentary rather than risk fabrication.
 */

export type ResearchCitation =
  | { kind: "quran";  citation: QuranCitation }
  | { kind: "hadith"; citation: HadithCitation }
  | { kind: "tafsir"; citation: TafsirCitation };

export type ResearchAnswer = {
  prose: string;                    // 2-5 sentences max, no claims without citations
  citations: ResearchCitation[];
  refused?: boolean;                // true if no citations could be grounded
};

const AnswerSchema = z.object({
  prose: z
    .string()
    .min(1)
    .max(1200)
    .describe(
      "2-5 sentences. Plain prose answering the question, woven around the provided citations. " +
      "Do NOT include verse text or hadith text inline — the UI shows those separately. " +
      "Do NOT make any claim that isn't directly supported by one of the provided citations.",
    ),
  citation_ids: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe(
      "List of collection_doc_ids from the provided citations that you actually drew on. " +
      "These must be exact ids from the list given — copy them verbatim.",
    ),
});

const SYSTEM_BASE = `You are a careful research assistant for a thoughtful Muslim writer.

You will be given a question and a set of CANDIDATE CITATIONS retrieved from
canonical sources (Quran, Sahih Sittah hadith, Tafsir Ibn Kathir). Each citation
has a collection_doc_id.

Your job: compose a short, plain-prose answer (2-5 sentences) using ONLY what
the candidate citations support. Cite by listing the collection_doc_ids you
relied on.

Hard rules:
- Do not quote verses or hadith text inline. The UI will show them separately.
- Do not make claims not directly supported by the candidate citations.
- If the candidates don't support a useful answer, return prose explaining what
  WAS found — never invent additional sources.
- Cite only collection_doc_ids that appear in the candidates list — never
  invent or modify them.
- Respect the gradings on hadith. If a hadith is graded da'if or unspecified,
  note that briefly.
- Tone: thoughtful, plain, contemplative. Not preachy.`;

export async function answerWithCitations(
  question: string,
): Promise<ResearchAnswer> {
  if (!isIslamicResearchConfigured()) {
    return {
      prose:
        "Research isn’t connected here yet. Add XAI_API_KEY and " +
        "QURAN_COLLECTION_ID, HADITH_COLLECTION_ID, and TAFSIR_COLLECTION_ID to .env.local " +
        "(Phase 0 corpus upload — see seeds/README.md in the repo). Until then this page can’t query the Grok collections.",
      citations: [],
      refused: true,
    };
  }

  // 1. Retrieve from all three Collections in parallel
  const [quran, hadith, tafsir] = await Promise.all([
    searchQuran(question,  5).catch(() => []),
    searchHadith(question, 5).catch(() => []),
    searchTafsir(question, 3).catch(() => []),
  ]);

  const allCitations: ResearchCitation[] = [
    ...quran.map((c)  => ({ kind: "quran"  as const, citation: c })),
    ...hadith.map((c) => ({ kind: "hadith" as const, citation: c })),
    ...tafsir.map((c) => ({ kind: "tafsir" as const, citation: c })),
  ];

  if (allCitations.length === 0) {
    return {
      prose:
        "I couldn't find sources for that in the Quran, the Sahih Sittah, or " +
        "Tafsir Ibn Kathir. Try rephrasing — sometimes a different keyword helps." +
        queryTypoHint(question),
      citations: [],
      refused: true,
    };
  }

  // 2. Compose prompt with candidate list
  const candidatesBlock = allCitations
    .map((c, i) => formatCandidate(c, i))
    .join("\n\n---\n\n");

  const validIds = new Set(allCitations.map((c) => c.citation.collectionDocId));

  // 3. First attempt
  let composed = await composeAnswer(question, candidatesBlock, SYSTEM_BASE);
  let usedCitations = filterCitations(allCitations, composed.citation_ids, validIds);

  // 4. If the model invented an ID, retry once with stricter framing
  if (usedCitations.length === 0) {
    const strict =
      SYSTEM_BASE +
      "\n\nYour previous attempt cited document IDs that were not in the candidates list. " +
      "This time, copy citation_doc_ids EXACTLY from the candidates. Do not modify them.";
    composed = await composeAnswer(question, candidatesBlock, strict);
    usedCitations = filterCitations(allCitations, composed.citation_ids, validIds);
  }

  // 5. If still nothing valid, refuse to add commentary and return the raw hits
  if (usedCitations.length === 0) {
    return {
      prose:
        "Here are passages I found relevant. I'm declining to summarize them so " +
        "I don't accidentally misrepresent the sources — please read them directly.",
      citations: allCitations.slice(0, 5),
      refused: true,
    };
  }

  return {
    prose: composed.prose,
    citations: usedCitations,
  };
}

async function composeAnswer(
  question: string,
  candidatesBlock: string,
  system: string,
): Promise<{ prose: string; citation_ids: string[] }> {
  const { object } = await generateObject({
    model: chatModel(),
    schema: AnswerSchema,
    system,
    prompt:
      `Question: ${question}\n\n` +
      `Candidate citations:\n\n${candidatesBlock}\n\n` +
      `Compose the answer.`,
    temperature: 0.2,
  });
  return object;
}

/** Light-touch hints when the query wording likely blocks retrieval. */
function queryTypoHint(question: string): string {
  if (/\bquorum\b/i.test(question)) {
    return " If you meant the Quran, try that spelling — “quorum” is a different word.";
  }
  return "";
}

function filterCitations(
  all: ResearchCitation[],
  usedIds: string[],
  validIds: Set<string>,
): ResearchCitation[] {
  const wanted = new Set(usedIds.filter((id) => validIds.has(id)));
  return all.filter((c) => wanted.has(c.citation.collectionDocId));
}

function formatCandidate(c: ResearchCitation, i: number): string {
  const id = c.citation.collectionDocId;
  if (c.kind === "quran") {
    const q = c.citation;
    return (
      `[#${i + 1}] collection_doc_id: ${id}\n` +
      `Type: Quran\n` +
      `Reference: ${q.reference} (Surah ${q.surahName})\n` +
      `Sahih International: ${q.translations.sahih ?? ""}\n` +
      `Pickthall: ${q.translations.pickthall ?? ""}`
    );
  }
  if (c.kind === "hadith") {
    const h = c.citation;
    return (
      `[#${i + 1}] collection_doc_id: ${id}\n` +
      `Type: Hadith\n` +
      `Reference: ${h.reference} (${h.collection})\n` +
      `Grade: ${h.grade}\n` +
      `English: ${h.english.slice(0, 600)}`
    );
  }
  const t = c.citation;
  return (
    `[#${i + 1}] collection_doc_id: ${id}\n` +
    `Type: Tafsir\n` +
    `On Quran ${t.reference}\n` +
    `Source: ${t.source}\n` +
    `Excerpt: ${t.text.slice(0, 600)}`
  );
}
