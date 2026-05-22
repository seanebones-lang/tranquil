import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/signin(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/api/cron")) return;
  if (pathname.startsWith("/heirloom-access")) return;
  if (pathname.startsWith("/api/export") && searchParams.has("heirloomToken"))
    return;
  if (pathname.startsWith("/api/recitation")) return;

  if (isPublicRoute(req)) return;

  await auth.protect();
});

export const config = {
  matcher: [
    // Align with Clerk + Next recommendation: skip static assets and internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
    "/",
  ],
};
