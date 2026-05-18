import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Match everything except: API auth routes, Next.js internals, and static assets
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|webmanifest)$).*)"],
};
