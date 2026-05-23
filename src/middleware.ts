import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/signin(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/api/health" || pathname.startsWith("/api/health/"))
    return NextResponse.next();
  if (pathname.startsWith("/api/cron")) return NextResponse.next();
  if (pathname.startsWith("/heirloom-access")) return NextResponse.next();
  if (pathname.startsWith("/api/export") && searchParams.has("heirloomToken"))
    return NextResponse.next();
  if (pathname.startsWith("/api/recitation")) return NextResponse.next();

  if (isPublicRoute(req)) return NextResponse.next();

  await auth.protect();
});

export const config = {
  matcher: [
    // Skip static assets & public JSON (includes /railway-health.json; no Clerk on those).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|json|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
    "/",
  ],
};
