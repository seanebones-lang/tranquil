import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/email";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily heirloom dormancy check.
 *
 * For every user with a heirloomContactEmail set:
 *   - compute days since lastSeenAt (fall back to createdAt)
 *   - if >= heirloomUnlockAfterDays:
 *       - check whether an unexpired, non-revoked grant already exists
 *       - if not, mint a new grant + email the heir a magic link
 *
 * Idempotent: re-running the same day won't send duplicate emails because
 * we only mint a new grant if no active grant exists.
 *
 * Wire this to a daily Vercel cron at 09:00 UTC.
 */

const GRANT_TTL_DAYS = 30;     // heir has 30 days to use the link
const APP_URL_FALLBACK = "http://localhost:3000";

export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { heirloomContactEmail: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      heirloomContactEmail: true,
      heirloomUnlockAfterDays: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  let granted = 0;
  let skipped = 0;
  let errors = 0;

  for (const u of users) {
    try {
      const last = u.lastSeenAt ?? u.createdAt;
      const days = Math.floor(
        (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days < u.heirloomUnlockAfterDays) {
        skipped++;
        continue;
      }

      // Existing active grant?
      const active = await prisma.heirloomAccess.findFirst({
        where: {
          ownerId: u.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (active) {
        skipped++;
        continue;
      }

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        now.getTime() + GRANT_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      await prisma.heirloomAccess.create({
        data: {
          ownerId: u.id,
          heirEmail: u.heirloomContactEmail!,
          unlockToken: token,
          expiresAt,
        },
      });

      const appUrl = process.env.NEXTAUTH_URL ?? APP_URL_FALLBACK;
      const link = `${appUrl}/heirloom-access?token=${encodeURIComponent(token)}`;
      const ownerName = u.name ?? u.email ?? "someone you know";

      const body = `
        <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0 0 16px 0;color:#2C2825;">
          A keepsake from ${escape(ownerName)}.
        </h1>
        <p style="font-family:Georgia,serif;font-size:17px;line-height:1.7;margin:0 0 16px 0;color:#2C2825;">
          ${escape(ownerName)} kept a personal journal in A Tranquil Space — a private place to think,
          write, and reflect. They asked us to share these notes with you in case they were ever
          away from the app for a long while.
        </p>
        <p style="font-family:Georgia,serif;font-size:17px;line-height:1.7;margin:0 0 24px 0;color:#2C2825;">
          You can read them at the link below. They are yours to keep.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="${link}"
             style="display:inline-block;background:#7C9885;color:#FAF7F2;text-decoration:none;
                    padding:12px 24px;border-radius:14px;font-family:Helvetica,Arial,sans-serif;
                    font-size:14px;letter-spacing:0.04em;">
            Open the notebook
          </a>
        </p>
        <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B665F;margin:0;">
          This link is for your eyes only. It opens read-only access — you can read and download,
          but nothing can be changed. The link is valid for ${GRANT_TTL_DAYS} days.
        </p>
      `;

      await sendEmail({
        to: u.heirloomContactEmail!,
        subject: `A keepsake from ${ownerName}`,
        html: emailLayout({
          preheader: `A private journal shared with you by ${ownerName}.`,
          body,
        }),
      });

      await prisma.auditLog.create({
        data: {
          userId: u.id,
          action: "heirloom.granted",
          targetId: u.heirloomContactEmail!,
          meta: { dormancyDays: days, expiresAt: expiresAt.toISOString() },
        },
      });
      granted++;
    } catch (e) {
      console.error(`[cron/dormancy] user ${u.id}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, granted, skipped, errors, total: users.length });
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}
