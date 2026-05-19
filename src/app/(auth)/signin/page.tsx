import { redirect } from "next/navigation";
import { signIn } from "~/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Next.js `redirect()` throws a digest starting with NEXT_REDIRECT — must rethrow. */
function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

const ERROR_HELP: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  send_failed:
    "Could not send the sign-in email. Check server logs and verify AUTH_RESEND_KEY, EMAIL_FROM, DATABASE_URL, AUTH_SECRET, and NEXTAUTH_URL on Vercel.",
};

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const errorCode = sp.error;
  const errorMessage =
    errorCode && ERROR_HELP[errorCode] ? ERROR_HELP[errorCode] : null;

  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      redirect("/signin?error=invalid_email");
    }

    try {
      await signIn("resend", { email, redirectTo: "/" });
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      console.error("[signIn resend]", error);
      redirect("/signin?error=send_failed");
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl tracking-tight mb-2">
            A Tranquil Space
          </h1>
          <p className="text-[var(--color-muted)]">
            A quiet place to think, write, and reflect.
          </p>
        </header>

        <Card>
          {errorMessage && (
            <p
              role="alert"
              className="mb-5 rounded-[var(--radius-md)] bg-[var(--color-danger)]/12 px-4 py-3 text-sm text-[var(--color-danger)] font-[var(--font-ui)]"
            >
              {errorMessage}
            </p>
          )}
          <form action={sendMagicLink} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm mb-2 text-[var(--color-muted)]"
              >
                Your email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Send my link
            </Button>
            <p className="text-xs text-[var(--color-whisper)] text-center font-[var(--font-ui)] pt-1">
              No password to remember. Open the email we send and tap the link.
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
