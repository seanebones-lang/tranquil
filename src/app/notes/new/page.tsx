import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewNotePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      title: null,
      bodyMd: "",
      source: "text",
      status: "draft",
      organizeStatus: "pending",
    },
    select: { id: true },
  });
  redirect(`/notes/${note.id}`);
}
