"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Mirrors Clerk's default `/sign-up` path so OAuth / verification redirects don't 404.
 */
export default function ClerkHyphenSignUpPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col items-center">
        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl tracking-tight mb-2">
            Join Tranquil
          </h1>
          <p className="text-[var(--color-muted)]">
            Create your space — same calm design, Clerk-secured account.
          </p>
        </header>

        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
        />

        <p className="mt-8 text-xs text-[var(--color-whisper)] font-[var(--font-ui)] text-center">
          Prefer /signup?{" "}
          <Link
            href="/signup"
            className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
          >
            Go there
          </Link>
        </p>
      </div>
    </main>
  );
}
