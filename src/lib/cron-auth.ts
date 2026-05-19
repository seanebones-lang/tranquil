/**
 * Cron endpoint authorization.
 *
 * Scheduled HTTP jobs (Railway Cron, an add-on, or manual curl) should send
 * `Authorization: Bearer ${CRON_SECRET}` on every invocation. We verify against
 * the env var. Same handlers work when triggered from Upstash QStash or similar —
 * just set the matching CRON_SECRET.
 */
import { NextResponse } from "next/server";

export function checkCronAuth(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed in production; allow in dev for ergonomics
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("CRON_SECRET not configured", { status: 500 });
    }
    return null;
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return null;
}
