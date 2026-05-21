/**
 * Islamic source RAG.
 *
 * Wraps the three shared Grok Collections seeded in Phase 0:
 *   - tranquil-quran    (one document per verse, 4 translations + Arabic)
 *   - tranquil-hadith   (one document per hadith, with grading)
 *   - tranquil-tafsir   (one document per verse, Ibn Kathir)
 *
 * Returns *structured* citations parsed from the document bodies — never
 * free-form prose. This is the substrate on which citation-enforced answers
 * are built.
 */
import { searchCollections, type SearchHit } from "./collections";

/** True when Grok Collections search can run (Phase 0 IDs + real xAI key). */
export function isIslamicResearchConfigured(): boolean {
  const raw = process.env.XAI_API_KEY?.trim() ?? "";
  if (!raw || isPlaceholderXaiKey(raw)) return false;
  const quran = process.env.QURAN_COLLECTION_ID?.trim();
  const hadith = process.env.HADITH_COLLECTION_ID?.trim();
  const tafsir = process.env.TAFSIR_COLLECTION_ID?.trim();
  return Boolean(quran && hadith && tafsir);
}

function isPlaceholderXaiKey(v: string): boolean {
  const n = v.toLowerCase();
  return (
    n === "your_xai_key_here" ||
    n === "your-api-key" ||
    n.startsWith("replace_") ||
    n === "xxx"
  );
}

export type QuranCitation = {
  kind: "quran";
  reference: string;        // "2:255"
  surahNumber: number;
  ayahNumber: number;
  surahName: string;        // English
  arabic: string;
  translations: {
    sahih?: string;
    pickthall?: string;
    yusufali?: string;
    asad?: string;
  };
  collectionDocId: string;  // proves it came from RAG
  score: number;
};

export type HadithCitation = {
  kind: "hadith";
  reference: string;        // "bukhari:1234"
  collection: string;       // "Sahih al-Bukhari"
  arabic?: string;
  english: string;
  grade: string;            // "Sahih" | "Sahih (collection consensus)" | "Hasan" | "Da'if" | ...
  collectionDocId: string;
  score: number;
};

export type TafsirCitation = {
  kind: "tafsir";
  reference: string;        // "2:255"
  text: string;
  source: string;           // e.g. "Tafsir Ibn Kathir"
  collectionDocId: string;
  score: number;
};

const collectionIds = () => ({
  quran:  required("QURAN_COLLECTION_ID"),
  hadith: required("HADITH_COLLECTION_ID"),
  tafsir: required("TAFSIR_COLLECTION_ID"),
});

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set. Run the Phase 0 seed scripts.`);
  return v;
}

// =================================================================
// Search
// =================================================================

export async function searchQuran(
  query: string,
  limit = 5,
): Promise<QuranCitation[]> {
  const hits = await searchCollections(
    [collectionIds().quran],
    query,
    limit,
    "hybrid",
  );
  return hits.map(parseQuranHit).filter((x): x is QuranCitation => x !== null);
}

export async function searchHadith(
  query: string,
  limit = 5,
): Promise<HadithCitation[]> {
  const hits = await searchCollections(
    [collectionIds().hadith],
    query,
    limit,
    "hybrid",
  );
  return hits.map(parseHadithHit).filter((x): x is HadithCitation => x !== null);
}

export async function searchTafsir(
  query: string,
  limit = 5,
): Promise<TafsirCitation[]> {
  const hits = await searchCollections(
    [collectionIds().tafsir],
    query,
    limit,
    "hybrid",
  );
  return hits.map(parseTafsirHit).filter((x): x is TafsirCitation => x !== null);
}

// =================================================================
// Direct lookup by reference (for /verse slash command and verse modal)
// =================================================================

export async function lookupVerse(reference: string): Promise<QuranCitation | null> {
  const m = reference.match(/^(\d{1,3}):(\d{1,3})$/);
  if (!m) return null;
  // We seeded one doc per verse; a search on the reference plus surrounding
  // text returns it as top hit reliably.
  const hits = await searchCollections(
    [collectionIds().quran],
    `Reference: ${reference}`,
    3,
    "hybrid",
  );
  const wanted = hits.find((h) => h.name === `quran:${reference}`);
  return wanted ? parseQuranHit(wanted) : (hits[0] ? parseQuranHit(hits[0]) : null);
}

export async function lookupTafsir(reference: string): Promise<TafsirCitation | null> {
  const m = reference.match(/^(\d{1,3}):(\d{1,3})$/);
  if (!m) return null;
  const hits = await searchCollections(
    [collectionIds().tafsir],
    `On Quran ${reference}`,
    3,
    "hybrid",
  );
  const wanted = hits.find((h) => h.name === `tafsir:${reference}`);
  return wanted ? parseTafsirHit(wanted) : (hits[0] ? parseTafsirHit(hits[0]) : null);
}

// =================================================================
// Parsing — extracts structured data from the seeded document bodies
// =================================================================
// The Phase 0 seed scripts wrote bodies in a stable, labeled format.
// These parsers read those labels back out.

function parseQuranHit(hit: SearchHit): QuranCitation | null {
  const body = hit.content;
  const ref = extractField(body, /Reference:\s*(\d+:\d+)/);
  if (!ref) return null;
  const [s, a] = ref.split(":").map(Number);

  const surahName = extractField(
    body,
    /Surah\s+\d+\s+\(([^—)]+)/,
  )?.trim() ?? "";

  return {
    kind: "quran",
    reference: ref,
    surahNumber: s,
    ayahNumber: a,
    surahName,
    arabic: extractBlock(body, "ARABIC (Uthmani)"),
    translations: {
      sahih:     extractBlock(body, "ENGLISH — Sahih International"),
      pickthall: extractBlock(body, "ENGLISH — Pickthall"),
      yusufali:  extractBlock(body, "ENGLISH — Yusuf Ali"),
      asad:      extractBlock(body, "ENGLISH — Muhammad Asad"),
    },
    collectionDocId: hit.document_id,
    score: hit.score,
  };
}

function parseHadithHit(hit: SearchHit): HadithCitation | null {
  const body = hit.content;
  const ref = extractField(body, /Reference:\s*([\w-]+:\d+)/);
  if (!ref) return null;
  const collectionLine = extractField(body, /Hadith from (.+)/);
  const grade = extractField(body, /Grade:\s*(.+)/) ?? "(not specified)";
  const arabic = extractBlock(body, "ARABIC");
  const english = extractBlock(body, "ENGLISH");
  if (!english) return null;

  return {
    kind: "hadith",
    reference: ref,
    collection: collectionLine ?? "",
    arabic: arabic || undefined,
    english,
    grade,
    collectionDocId: hit.document_id,
    score: hit.score,
  };
}

function parseTafsirHit(hit: SearchHit): TafsirCitation | null {
  const body = hit.content;
  const ref = extractField(body, /On Quran (\d+:\d+)/);
  if (!ref) return null;
  const firstLine = body.split("\n")[0]?.trim() ?? "Tafsir";

  // Body after the two-line header is the tafsir text
  const lines = body.split("\n");
  const text = lines.slice(2).join("\n").trim();

  return {
    kind: "tafsir",
    reference: ref,
    text,
    source: firstLine,
    collectionDocId: hit.document_id,
    score: hit.score,
  };
}

function extractField(body: string, re: RegExp): string | null {
  const m = body.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractBlock(body: string, label: string): string {
  // Matches "LABEL:\n<content>\n\n" up to the next blank-line boundary.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}:\\s*\\n([\\s\\S]*?)(?:\\n\\n|$)`);
  return body.match(re)?.[1]?.trim() ?? "";
}
