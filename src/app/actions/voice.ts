"use server";

import { z } from "zod";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { audioKey, isR2Configured, signedUploadUrl } from "@/lib/r2";
import { enqueueTranscribe } from "@/lib/queue";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/**
 * Phase 1: prepare an upload.
 * Creates a placeholder Note + NoteAudio row, returns a signed PUT URL for the
 * browser to push the audio bytes to R2 directly.
 */
const prepareSchema = z.object({
  mimeType: z.string().min(1).max(80),
  durationSec: z.number().int().min(1).max(60 * 60),
});

export async function prepareVoiceNoteUpload(
  input: z.infer<typeof prepareSchema>,
) {
  const userId = await requireUserId();
  const { mimeType, durationSec } = prepareSchema.parse(input);

  if (!isR2Configured()) {
    throw new Error(
      "Voice uploads use Cloudflare R2. Confirm R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are set, then restart the dev server so env reloads.",
    );
  }

  const note = await prisma.note.create({
    data: {
      userId,
      source: "voice",
      status: "draft",
      bodyMd: "",
      transcriptionStatus: "pending",
      organizeStatus: "pending",
    },
    select: { id: true },
  });

  const key = audioKey(userId, note.id, mimeType);
  await prisma.noteAudio.create({
    data: { noteId: note.id, r2Key: key, durationSec, language: "en" },
  });

  const uploadUrl = await signedUploadUrl(key, mimeType);
  return { noteId: note.id, uploadUrl, key };
}

/**
 * Phase 2: confirm upload completed.
 * Enqueues the transcribe job. Worker picks it up, calls Grok STT, writes
 * transcript into the Note, then chains the organize job.
 */
const finalizeSchema = z.object({ noteId: z.string().min(1) });

export async function finalizeVoiceNoteUpload(
  input: z.infer<typeof finalizeSchema>,
) {
  const userId = await requireUserId();
  const { noteId } = finalizeSchema.parse(input);

  // Belt and suspenders: confirm ownership
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });
  if (!note) throw new Error("Note not found");

  await enqueueTranscribe(noteId);

  return { ok: true };
}

/**
 * Poll endpoint for the editor: returns the latest pipeline state.
 * Used by the note editor to refresh after voice upload + transcribe finish.
 */
export async function getNoteStatus(noteId: string) {
  const userId = await requireUserId();
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: {
      id: true,
      title: true,
      bodyMd: true,
      aiTags: true,
      aiSummary: true,
      aiTopic: true,
      transcriptionStatus: true,
      organizeStatus: true,
      updatedAt: true,
    },
  });
  return note;
}
