"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Clerk default URLs use `/sign-in` (hyphen). OAuth and some redirects land here.
 * Primary branded entry remains `/signin`; this route prevents 404 on those flows.
 */
export default function ClerkHyphenSignInPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col items-center">
        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl tracking-tight mb-2">
            A Tranquil Space
          </h1>
          <p className="text-[var(--color-muted)]">
            A quiet place to think, write, and reflect.
          </p>
        </header>

        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
        />

        <p className="mt-8 text-xs text-[var(--color-whisper)] font-[var(--font-ui)] text-center">
          Prefer this URL without a hyphen?{" "}
          <Link
            href="/signin"
            className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
          >
            Use /signin
          </Link>
        </p>
      </div>
    </main>
  );
}
