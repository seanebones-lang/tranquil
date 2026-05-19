import { NextResponse, type NextRequest } from "next/server";

/**
 * Recitation audio.
 *
 * Maps "2:255" → an MP3 from everyayah.com (Mishary Al-Afasy, 128kbps).
 * Issues a 302 redirect so the browser <audio> streams directly from the CDN.
 *
 * To self-host later, pre-download once into Cloudflare R2 and redirect to
 * the R2 public URL — same shape, different host.
 */

const RECITER_BASE = "https://everyayah.com/data/Alafasy_128kbps";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) return new NextResponse("Missing ref", { status: 400 });

  const m = ref.match(/^(\d{1,3}):(\d{1,3})$/);
  if (!m) return new NextResponse("Invalid ref. Expected surah:ayah", { status: 400 });

  const surah = m[1].padStart(3, "0");
  const ayah  = m[2].padStart(3, "0");
  const url = `${RECITER_BASE}/${surah}${ayah}.mp3`;

  return NextResponse.redirect(url, 302);
}
