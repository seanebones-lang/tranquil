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
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
