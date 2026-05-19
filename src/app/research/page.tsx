import { auth } from "~/auth";
import { Nav } from "@/components/nav";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { ResearchSearch } from "@/components/research-search";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const session = await auth();
  return (
    <>
      <Nav userName={session?.user?.name} />
      <main className="mx-auto max-w-3xl px-6 sm:px-10 pt-8 pb-32">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
            Research
          </p>
          <h1 className="text-4xl sm:text-5xl tracking-tight mb-3">
            Quran, Hadith, Tafsir.
          </h1>
          <p className="text-[var(--color-muted)] text-lg italic">
            Ask anything. Answers come only from the sources, with every citation grounded.
          </p>
        </header>

        <ResearchSearch />
      </main>
      <ChatWidgetFab />
    </>
  );
}
