"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

const settingsSchema = z.object({
  fontScale: z.number().min(1.0).max(1.5).optional(),
  contrast: z.enum(["standard", "high"]).optional(),
  reducedMotion: z.boolean().optional(),
  ambientSound: z.string().max(40).nullable().optional(),
  heirloomContactEmail: z
    .string()
    .email()
    .max(120)
    .nullable()
    .optional(),
  heirloomUnlockAfterDays: z.number().int().min(30).max(3650).optional(),
});

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const userId = await requireUserId();
  const data = settingsSchema.parse(input);

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fontScale !== undefined && { fontScale: data.fontScale }),
      ...(data.contrast !== undefined && { contrast: data.contrast }),
      ...(data.reducedMotion !== undefined && { reducedMotion: data.reducedMotion }),
      ...(data.ambientSound !== undefined && { ambientSound: data.ambientSound }),
      ...(data.heirloomContactEmail !== undefined && {
        heirloomContactEmail: data.heirloomContactEmail,
      }),
      ...(data.heirloomUnlockAfterDays !== undefined && {
        heirloomUnlockAfterDays: data.heirloomUnlockAfterDays,
      }),
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function revokeActiveHeirloomGrants() {
  const userId = await requireUserId();
  await prisma.heirloomAccess.updateMany({
    where: { ownerId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { userId, action: "heirloom.revoked.all" },
  });
  revalidatePath("/settings");
  return { ok: true };
}
