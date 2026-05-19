import { prisma } from "./db";
import { createCollection } from "./collections";

/**
 * Ensure the user has a personal notes Collection in Grok.
 * Provisions one lazily on first use. Idempotent.
 */
export async function ensureUserCollection(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notesCollectionId: true, email: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.notesCollectionId) return user.notesCollectionId;

  const safeName = `tranquil-notes-${userId.slice(0, 12)}`;
  const col = await createCollection(
    safeName,
    `Personal notes for ${user.email}. Created by A Tranquil Space.`,
  );

  await prisma.user.update({
    where: { id: userId },
    data: { notesCollectionId: col.collection_id },
  });

  return col.collection_id;
}
