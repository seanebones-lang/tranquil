"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { enqueueOrganize } from "@/lib/queue";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

const updateSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().max(200).nullable().optional(),
  bodyMd: z.string().max(120_000).optional(),
});

export async function updateNote(input: z.infer<typeof updateSchema>) {
  const userId = await requireUserId();
  const { noteId, title, bodyMd } = updateSchema.parse(input);

  const note = await prisma.note.update({
    where: { id: noteId, userId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(bodyMd !== undefined ? { bodyMd, status: bodyMd.trim() ? "saved" : "draft" } : {}),
      organizeStatus: "pending",
    },
    select: { id: true, bodyMd: true, updatedAt: true },
  });

  // Debounced background organize (30s of editing inactivity)
  if (note.bodyMd.trim().length > 20) {
    await enqueueOrganize(noteId, 30_000).catch(() => { /* non-fatal */ });
  }

  return { ok: true, updatedAt: note.updatedAt.toISOString() };
}

export async function deleteNote(noteId: string) {
  const userId = await requireUserId();
  await prisma.note.update({
    where: { id: noteId, userId },
    data: { deletedAt: new Date(), status: "archived" },
  });
  revalidatePath("/notes");
  redirect("/notes");
}

export async function archiveNote(noteId: string) {
  const userId = await requireUserId();
  await prisma.note.update({
    where: { id: noteId, userId },
    data: { status: "archived" },
  });
  revalidatePath("/notes");
}

const heirloomSchema = z.object({
  noteId: z.string().min(1),
  visible: z.boolean(),
});

export async function setHeirloomVisible(
  input: z.infer<typeof heirloomSchema>,
) {
  const userId = await requireUserId();
  const { noteId, visible } = heirloomSchema.parse(input);
  await prisma.note.update({
    where: { id: noteId, userId },
    data: { isHeirloomVisible: visible },
  });
  return { ok: true };
}
