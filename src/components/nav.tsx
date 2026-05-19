import Link from "next/link";
import { signOut } from "~/auth";

export function Nav({ userName }: { userName?: string | null }) {
  return (
    <nav className="w-full flex items-center justify-between px-6 py-5 sm:px-10">
      <Link
        href="/"
        className="font-[var(--font-display)] text-xl tracking-tight text-[var(--color-ink)] hover:text-[var(--color-sage-deep)]"
      >
        A Tranquil Space
      </Link>

      <div className="flex items-center gap-5 sm:gap-6 text-sm font-[var(--font-ui)]">
        <Link href="/" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          Today
        </Link>
        <Link href="/notes" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          Notes
        </Link>
        <Link href="/research" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          Research
        </Link>
        <Link href="/library" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          Library
        </Link>
        <Link href="/settings" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          Settings
        </Link>
        {userName && (
          <span className="text-[var(--color-whisper)] hidden sm:inline">
            {userName}
          </span>
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
