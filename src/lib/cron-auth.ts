/**
 * Cron endpoint authorization.
 *
 * Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` on every scheduled
 * invocation. We verify against the env var. Same handler also runs fine when
 * triggered manually from a service like Upstash QStash or a curl call —
 * just set the matching CRON_SECRET locally.
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
