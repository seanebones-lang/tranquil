import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, Inter, Amiri } from "next/font/google";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "A Tranquil Space",
  description: "A quiet place to think, write, and reflect.",
  applicationName: "A Tranquil Space",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "Tranquil",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1f26" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let fontScale = 1.0;
  let reducedMotion = false;
  let contrast: "standard" | "high" = "standard";

  try {
    const session = await auth();
    if (session?.user?.id) {
      const prefs = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { fontScale: true, reducedMotion: true, contrast: true },
      });
      if (prefs) {
        fontScale = prefs.fontScale;
        reducedMotion = prefs.reducedMotion;
        contrast = (prefs.contrast as "standard" | "high") ?? "standard";
      }
    }
  } catch {
    /* unauthenticated or DB unavailable — fall through with defaults */
  }

  return (
    <ClerkProvider
      signInUrl="/signin"
      signUpUrl="/signup"
      afterSignOutUrl="/signin"
    >
      <html
        lang="en"
        className={`${cormorant.variable} ${inter.variable} ${amiri.variable}`}
        data-font-scale={fontScale.toString()}
        data-reduced-motion={reducedMotion.toString()}
        data-contrast={contrast}
      >
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
