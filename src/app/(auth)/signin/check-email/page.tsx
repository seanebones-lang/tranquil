import { Card } from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl sm:text-5xl tracking-tight mb-3">
          Check your email
        </h1>
        <p className="text-[var(--color-muted)] mb-8">
          We sent a link that will sign you in.
        </p>
        <Card>
          <p className="text-base leading-relaxed">
            Open the message and tap the link. It expires after a short while,
            so do it soon. You can close this tab once you're signed in on the
            other side.
          </p>
        </Card>
        <p className="text-xs text-[var(--color-whisper)] mt-6 font-[var(--font-ui)]">
          Didn't receive anything? Check spam, or try again from the sign-in page.
        </p>
      </div>
    </main>
  );
}
