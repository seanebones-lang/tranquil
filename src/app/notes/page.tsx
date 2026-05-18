import { auth } from "~/auth";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { ChatWidgetFab } from "@/components/chat-widget-fab";

export default async function NotesPage() {
  const session = await auth();

  return (
    <>
      <Nav userName={session?.user?.name} />
      <main className="mx-auto max-w-3xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-12">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Notes
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight">Your library.</h1>
        </header>
        <Card className="text-center py-16">
          <p className="text-[var(--color-muted)] text-lg italic">
            Empty for now.
          </p>
          <p className="text-[var(--color-whisper)] mt-4 text-sm font-[var(--font-ui)]">
            Coming in Phase 2 — note CRUD, auto-save, search, timeline view.
          </p>
        </Card>
      </main>
      <ChatWidgetFab />
    </>
  );
}
