import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "~/auth.config";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // trustHost + middleware callbacks live on auth.config — merge them here so
  // route handlers match middleware behavior in production (e.g. Railway).
  ...authConfig,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: process.env.EMAIL_FROM ?? (process.env.NODE_ENV === "production"
        ? (() => { throw new Error("EMAIL_FROM not set in production"); })()
        : "onboarding@resend.dev"),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  // pages defined once in authConfig — don't re-declare here to avoid ambiguity
  events: {
    async signIn({ user }) {
      // Stamp lastSeenAt for heirloom dormancy detection
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });
      }
    },
  },
});
