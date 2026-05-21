/**
 * Clerk-backed session bridge for the rest of the app.
 *
 * Exposes `auth()` with the same shape the codebase expected from Auth.js:
 * `{ user: { id, name, email } } | null` where `id` is the Prisma `User.id`.
 */
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

function clerkFallbackEmail(clerkUserId: string): string {
  const safe = clerkUserId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${safe}@users.clerk`;
}

export async function auth(): Promise<{
  user: { id: string; name: string | null; email: string };
} | null> {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  const cu = await currentUser();
  const email =
    cu?.primaryEmailAddress?.emailAddress ?? clerkFallbackEmail(userId);
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
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          clerkUserId: userId,
          name: name ?? byEmail.name,
          image: image ?? byEmail.image,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email,
          name,
          image,
        },
      });
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
}
