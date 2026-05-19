import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "~/auth.config";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // trustHost + middleware callbacks live on auth.config — merge them here too so
  // route handlers match middleware behavior on Vercel.
  ...authConfig,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
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
  pages: authConfig.pages,
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
