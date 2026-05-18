import { signIn } from "~/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    await signIn("resend", { email, redirectTo: "/" });
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
