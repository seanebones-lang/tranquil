import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/email";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly digest. Runs every Sunday morning.
 *
 * For each user with >= 2 notes created in the past 7 days, send an email
 * that summarizes the week:
 *   - count of new notes
 *   - top 3 topics (by note count)
 *   - 3 note titles to revisit
 *
 * Skips users who got a digest in the last 5 days (manual reruns / clock
 * drift safety).
 */

const APP_URL_FALLBACK = "http://localhost:3000";

export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { lastDigestSentAt: null },
        { lastDigestSentAt: { lt: fiveDaysAgo } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const u of users) {
    try {
      const weekNotes = await prisma.note.findMany({
        where: {
          userId: u.id,
          deletedAt: null,
          status: { in: ["saved", "draft"] },
          createdAt: { gte: weekAgo },
        },
        select: {
          id: true,
          title: true,
          aiSummary: true,
          aiTopic: true,
        },
      });
      if (weekNotes.length < 2) {
        skipped++;
        continue;
      }

      const topicCounts = new Map<string, number>();
      for (const n of weekNotes) {
        if (!n.aiTopic) continue;
        topicCounts.set(n.aiTopic, (topicCounts.get(n.aiTopic) ?? 0) + 1);
      }
      const topTopics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);

      const top3 = weekNotes.slice(0, 3);
      const ownerName = (u.name ?? u.email ?? "").split(" ")[0] || "there";
      const appUrl = process.env.NEXTAUTH_URL ?? APP_URL_FALLBACK;

      const topicsLine = topTopics.length > 0
        ? `Your week wove around <strong>${topTopics.map(escape).join(", ")}</strong>.`
        : "";

      const notesHtml = top3
        .map(
          (n) => `
        <li style="margin:0 0 16px 0;list-style:none;">
          <a href="${appUrl}/notes/${n.id}"
             style="text-decoration:none;color:#2C2825;">
            <p style="font-family:Georgia,serif;font-size:18px;font-weight:500;margin:0 0 4px 0;color:#2C2825;">
              ${escape(n.title ?? "Untitled")}
            </p>
            ${n.aiSummary ? `
              <p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6B665F;margin:0;line-height:1.6;">
                ${escape(n.aiSummary)}
              </p>` : ""}
          </a>
        </li>`,
        )
        .join("");

      const body = `
        <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0 0 16px 0;color:#2C2825;">
          A quiet week of writing, ${escape(ownerName)}.
        </h1>
        <p style="font-family:Georgia,serif;font-size:17px;line-height:1.7;margin:0 0 24px 0;color:#2C2825;">
          You wrote <strong>${weekNotes.length} ${weekNotes.length === 1 ? "note" : "notes"}</strong> this week. ${topicsLine}
        </p>
        <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#A39E95;margin:0 0 12px 0;">
          A few worth revisiting
        </p>
        <ul style="padding:0;margin:0 0 32px 0;">${notesHtml}</ul>
        <p>
          <a href="${appUrl}/notes"
             style="display:inline-block;background:#7C9885;color:#FAF7F2;text-decoration:none;
                    padding:12px 24px;border-radius:14px;font-family:Helvetica,Arial,sans-serif;
                    font-size:14px;letter-spacing:0.04em;">
            Open your library
          </a>
        </p>
      `;

      await sendEmail({
        to: u.email!,
        subject: `Your week in A Tranquil Space`,
        html: emailLayout({
          preheader: `${weekNotes.length} new notes, threaded with ${topTopics.join(", ")}.`,
          body,
        }),
      });

      await prisma.user.update({
        where: { id: u.id },
        data: { lastDigestSentAt: now },
      });
      sent++;
    } catch (e) {
      console.error(`[cron/digest] user ${u.id}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors, total: users.length });
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}
