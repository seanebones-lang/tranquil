import { NextResponse } from "next/server";

/** No auth — used when JSON static health is inconvenient. */
export function GET() {
  return NextResponse.json(
    { ok: true, service: "tranquil-space", via: "/api/health" },
    { headers: { "cache-control": "no-store" } },
  );
}
