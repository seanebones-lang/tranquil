import { notFound, redirect } from "next/navigation";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { ChatWidgetFab } from "@/components/chat-widget-fab";
import { NoteEditor } from "@/components/note-editor";
import { RelatedNotesPanel } from "@/components/related-notes-panel";
import { NotePageChrome } from "@/components/note-page-chrome";

type Params = { params: Promise<{ id: string }> };

export default async function NotePage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const note = await prisma.note.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      audio: { select: { r2Key: true, durationSec: true } },
      relatedFrom: {
        include: {
          related: {
            select: {
              id: true,
              title: true,
              aiSummary: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { similarity: "desc" },
        take: 5,
      },
    },
  });
  if (!note) notFound();

  return (
    <NotePageChrome
      noteId={note.id}
      heirloomVisible={note.isHeirloomVisible}
      header={<Nav userName={session.user.name} />}
      side={
        <RelatedNotesPanel
          related={note.relatedFrom.map((r) => ({
            id: r.related.id,
            title: r.related.title,
            summary: r.related.aiSummary,
            similarity: r.similarity,
          }))}
        />
      }
      fab={<ChatWidgetFab />}
    >
      <NoteEditor
        noteId={note.id}
        initialTitle={note.title ?? ""}
        initialBody={note.bodyMd}
        initialTranscriptionStatus={note.transcriptionStatus}
        initialOrganizeStatus={note.organizeStatus}
        initialTags={note.aiTags}
        initialSummary={note.aiSummary}
        initialTopic={note.aiTopic}
        hasAudio={!!note.audio}
      />
    </NotePageChrome>
  );
}
