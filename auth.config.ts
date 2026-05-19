import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config used by middleware.
 * Lives separately from auth.ts because middleware runs on the Edge runtime,
 * which can't use the Prisma adapter (Node-only).
 */
export default {
  providers: [], // populated in auth.ts
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  trustHost: true,  // ← This fixes UntrustedHost error on Railway custom domain
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnSignIn = nextUrl.pathname.startsWith("/signin");

      if (isOnSignIn) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
