/**
 * Slash command parsing for the note editor.
 *
 * Recognized commands at the start of a line (or after whitespace):
 *   /verse 2:255
 *   /tafsir 2:255
 *   /hadith bukhari:1
 *
 * On parse, we replace the slash command in-text with a structured citation
 * block written as fenced JSON:
 *
 *   ```citation
 *   {"kind":"quran","reference":"2:255","arabic":"…","translation":"…","translator":"Sahih International"}
 *   ```
 *
 * The renderer (in note-body.tsx) detects these blocks and renders the
 * appropriate card. This keeps notes portable plain text and easy to export.
 */

export type SlashMatch = {
  command: "verse" | "tafsir" | "hadith";
  argument: string;
  start: number; // index in source string where command starts
  end: number;   // index where command ends (exclusive)
};

const COMMAND_RE = /(^|\s)\/(verse|tafsir|hadith)\s+([^\s]+)/g;

export function findSlashCommands(text: string): SlashMatch[] {
  const out: SlashMatch[] = [];
  let m: RegExpExecArray | null;
  COMMAND_RE.lastIndex = 0;
  while ((m = COMMAND_RE.exec(text)) !== null) {
    const leadWs = m[1];
    const command = m[2] as SlashMatch["command"];
    const argument = m[3];
    const start = m.index + leadWs.length;
    const end = start + 1 + command.length + 1 + argument.length;
    out.push({ command, argument, start, end });
  }
  return out;
}

export type CitationBlock = {
  kind: "quran" | "hadith" | "tafsir";
  reference: string;
  arabic?: string;
  translation?: string;
  translator?: string;
  grade?: string;
  text?: string; // for tafsir
};

/** Render a citation block as fenced markdown for storage. */
export function formatCitationBlock(c: CitationBlock): string {
  return "```citation\n" + JSON.stringify(c) + "\n```";
}

/** Parse fenced citation blocks out of a body. */
const BLOCK_RE = /```citation\n([\s\S]*?)\n```/g;

export function splitBodyByCitations(body: string): Array<
  | { kind: "text"; value: string }
  | { kind: "citation"; value: CitationBlock }
> {
  const out: Array<
    | { kind: "text"; value: string }
    | { kind: "citation"; value: CitationBlock }
  > = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(body)) !== null) {
    if (m.index > cursor) {
      out.push({ kind: "text", value: body.slice(cursor, m.index) });
    }
    try {
      const parsed = JSON.parse(m[1]) as CitationBlock;
      out.push({ kind: "citation", value: parsed });
    } catch {
      out.push({ kind: "text", value: m[0] });
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < body.length) {
    out.push({ kind: "text", value: body.slice(cursor) });
  }
  if (out.length === 0) out.push({ kind: "text", value: "" });
  return out;
}
