"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
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

        <SignUp routing="path" path="/signup" signInUrl="/signin" />

        <p className="mt-8 text-xs text-[var(--color-whisper)] font-[var(--font-ui)] text-center">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-[var(--color-dusk)] hover:text-[var(--color-sage-deep)]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
