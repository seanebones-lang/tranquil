import type { Job } from "bullmq";
import { prisma } from "../../src/lib/db";
import { fetchObject } from "../../src/lib/r2";
import { transcribe } from "../../src/lib/stt";
import { enqueueOrganize, type TranscribeJob } from "../../src/lib/queue";

export async function transcribeProcessor(job: Job<TranscribeJob>) {
  const { noteId } = job.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { audio: true },
  });
  if (!note) throw new Error(`Note ${noteId} not found`);
  if (!note.audio) throw new Error(`Note ${noteId} has no audio`);

  // Mark as in-flight (client polling shows "Thinking…")
  await prisma.note.update({
    where: { id: noteId },
    data: { transcriptionStatus: "pending" },
  });

  let audio: Buffer;
  try {
    audio = await fetchObject(note.audio.r2Key);
  } catch (e) {
    await prisma.note.update({
      where: { id: noteId },
      data: { transcriptionStatus: "failed" },
    });
    throw e;
  }

  const mime = guessMime(note.audio.r2Key);
  const filename = note.audio.r2Key.split("/").pop() ?? "audio";

  let result;
  try {
    result = await transcribe(audio, filename, mime, note.audio.language);
  } catch (e) {
    await prisma.note.update({
      where: { id: noteId },
      data: { transcriptionStatus: "failed" },
    });
    throw e;
  }

  await prisma.$transaction([
    prisma.note.update({
      where: { id: noteId },
      data: {
        bodyMd: result.text,
        status: "saved",
        transcriptionStatus: "done",
        organizeStatus: "pending",
      },
    }),
    prisma.noteAudio.update({
      where: { noteId },
      data: {
        transcriptSegments: result.segments,
        language: result.language,
        durationSec: Math.round(result.duration_sec) || note.audio.durationSec,
      },
    }),
  ]);

  // Chain organize immediately for voice notes
  await enqueueOrganize(noteId, 0);
}

function guessMime(key: string): string {
  if (key.endsWith(".webm")) return "audio/webm";
  if (key.endsWith(".m4a") || key.endsWith(".mp4")) return "audio/mp4";
  if (key.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}
