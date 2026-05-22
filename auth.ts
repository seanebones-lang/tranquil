/**
 * Clerk-backed session bridge for the rest of the app.
 *
 * Exposes `auth()` with the same shape the codebase expected from Auth.js:
 * `{ user: { id, name, email } } | null` where `id` is the Prisma `User.id`.
 */
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Avoid duplicate Clerk signups racing on the same inbox, or casing drift vs Postgres. */
function isPrismaUniqueConstraint(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

async function findUserByEmailLoose(mail: string): Promise<User | null> {
  const trimmed = mail.trim();
  if (!trimmed) return null;

  let row = await prisma.user.findUnique({ where: { email: trimmed } });
  if (row) return row;

  row = await prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
  });
  return row;
}

function clerkFallbackEmail(clerkUserId: string): string {
  const safe = clerkUserId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${safe}@users.clerk`;
}

export async function auth(): Promise<{
  user: { id: string; name: string | null; email: string };
} | null> {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  try {
    const cu = await currentUser();
    const email = (
      cu?.primaryEmailAddress?.emailAddress ?? clerkFallbackEmail(userId)
    ).trim();
    const name =
      cu?.fullName ??
      cu?.username ??
      cu?.primaryEmailAddress?.emailAddress ??
      null;
    const image = cu?.imageUrl ?? null;

    let user = await prisma.user.findFirst({
      where: { clerkUserId: userId },
    });

    if (!user) {
      let byEmail = await findUserByEmailLoose(email);
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkUserId: userId,
            email,
            name: name ?? byEmail.name,
            image: image ?? byEmail.image,
          },
        });
      } else {
        try {
          user = await prisma.user.create({
            data: {
              clerkUserId: userId,
              email,
              name,
              image,
            },
          });
        } catch (e) {
          if (!isPrismaUniqueConstraint(e)) throw e;

          // Concurrent create OR email matched with different casing in DB only on insert.
          byEmail = await findUserByEmailLoose(email);
          if (!byEmail) throw e;

          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: {
              clerkUserId: userId,
              email,
              name: name ?? byEmail.name,
              image: image ?? byEmail.image,
            },
          });
        }
      }
    } else {
      const data: {
        email?: string;
        name?: string | null;
        image?: string | null;
      } = {};
      if (user.email !== email) data.email = email;
      if (user.name !== name) data.name = name;
      if (user.image !== image) data.image = image;
      if (Object.keys(data).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data,
        });
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  } catch (error) {
    // Prod: Postgres down, wrong DATABASE_URL, or migrations not applied — Clerk still says “signed in”.
    console.error(
      "[auth] Clerk→Prisma bridge failed (DATABASE_URL reachable? prisma migrate deploy?)",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
