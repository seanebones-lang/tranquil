import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;

      if (path.startsWith("/heirloom-access")) return true;
      if (path.startsWith("/api/cron")) return true;
      if (path.startsWith("/api/export") && nextUrl.searchParams.has("heirloomToken"))
        return true;

      const isLoggedIn = !!auth?.user;
      const isOnSignIn = path.startsWith("/signin");

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
