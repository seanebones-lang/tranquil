import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchQuran } from "@/lib/islamic";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily reflection generator.
 *
 * For each user with at least 3 notes:
 *   1. Pick a topic — prefer the user's most-used aiTopic; fall back to a
 *      recent tag if no topic exists yet.
 *   2. Search the Quran Collection for verses relevant to that topic.
 *   3. Store one reflection per (user, today) with the prompt = the verse
 *      reference + a one-line Sahih International translation.
 *
 * Idempotent: the unique constraint (userId, date) prevents double-runs.
 * Today screen reads from this table; if no row exists, it falls back to a
 * static reflection.
 *
 * Wire to a daily Vercel cron at 06:00 UTC (or whatever the user's morning is).
 */
export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const today = startOfTodayUTC();
  const users = await prisma.user.findMany({
    select: { id: true },
    where: { notes: { some: { deletedAt: null } } },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const u of users) {
    try {
      // Skip if already generated for today
      const existing = await prisma.dailyReflection.findUnique({
        where: { userId_date: { userId: u.id, date: today } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const topic = await pickTopic(u.id);
      if (!topic) {
        skipped++;
        continue;
      }

      const verses = await searchQuran(topic, 3).catch(() => []);
      if (verses.length === 0) {
        skipped++;
        continue;
      }
      const v = verses[0];
      const translation = v.translations.sahih ?? v.translations.pickthall ?? "";
      const prompt =
        `Quran ${v.reference}: "${translation.slice(0, 240)}"` +
        (translation.length > 240 ? "…" : "");

      await prisma.dailyReflection.create({
        data: {
          userId: u.id,
          date: today,
          prompt,
        },
      });
      created++;
    } catch (e) {
      console.error(`[cron/reflection] user ${u.id}:`, e);
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    errors,
    total: users.length,
  });
}

async function pickTopic(userId: string): Promise<string | null> {
  const topics = await prisma.note.groupBy({
    by: ["aiTopic"],
    where: { userId, deletedAt: null, aiTopic: { not: null } },
    _count: { aiTopic: true },
    orderBy: { _count: { aiTopic: "desc" } },
    take: 5,
  });
  if (topics.length === 0) {
    // fall back to most recent note's first tag
    const recent = await prisma.note.findFirst({
      where: { userId, deletedAt: null, aiTags: { isEmpty: false } },
      orderBy: { updatedAt: "desc" },
      select: { aiTags: true },
    });
    return recent?.aiTags?.[0] ?? null;
  }
  // Randomize a bit so the same topic doesn't dominate
  const top = topics.slice(0, 3);
  return top[Math.floor(Math.random() * top.length)].aiTopic;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
