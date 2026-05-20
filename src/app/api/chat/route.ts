import { auth } from "~/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { xai } from "@ai-sdk/xai";
import { MODELS } from "@/lib/xai";
import { buildToolsForUser } from "@/lib/agent-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `
You are the helpful research companion inside "A Tranquil Space", a private
writing and reflection app used by a thoughtful Muslim writer.

Be calm, brief, and concrete. Match the tone of the app — contemplative, not
chatty. Use plain prose. Default to short paragraphs over lists.

Your tools and how to use them:
- search_my_notes  — ALWAYS use when the user references their own notes,
                     their writing, what they've thought before, or asks
                     "what have I said about X". Don't paraphrase notes from
                     memory — search and pull them.
- quran_search     — Use whenever the user asks what the Quran says, mentions
                     a Quranic concept, or implies the need for scriptural
                     grounding.
- hadith_search    — Use for hadith questions. ALWAYS surface the grading
                     (sahih/hasan/da'if) when reporting a hadith.
- tafsir_search    — Use for commentary on a specific verse or theme.
- app_help         — Use when the user asks how to do something inside this app.

A few hard rules:
- NEVER invent verses, hadith, or scholarly opinions. If you don't have
  source-grounded text from a tool result, say you couldn't find it.
- When citing a verse or hadith, ALWAYS include the reference (e.g. "Quran
  2:255" or "Sahih al-Bukhari 1:1:1") so the UI can link it.
- When citing a hadith, ALWAYS include its grading.
- For current events or news, you have native web search available — use it
  freely.
- Don't quote long passages back; one short line is fine. Tool results render
  as separate citation cards in the UI, so don't repeat them.
- If the user asks something the tools can't answer (private personal
  decisions, religious rulings only a scholar should give), say so plainly
  and offer what you CAN do.

You can call multiple tools in one turn. Prefer to do so when the question
spans your notes + scripture.
`.trim();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // Rate limiting (30 req / 60s per user)
  const rate = await checkRateLimit(userId);
  if (!rate.success) {
    return new Response(rate.message, {
      status: 429,
      headers: { "Retry-After": rate.retryAfter.toString() },
    });
  }

  const { messages, threadId: incomingThreadId } = (await req.json()) as {
    messages: UIMessage[];
    threadId?: string;
  };

  // Resolve or create the thread
  let threadId = incomingThreadId ?? null;
  if (!threadId) {
    const firstUser = messages.find((m) => m.role === "user");
    const firstText = extractText(firstUser);
    const thread = await prisma.chatThread.create({
      data: {
        userId,
        title: firstText.slice(0, 60) || "New conversation",
      },
      select: { id: true },
    });
    threadId = thread.id;
  } else {
    // Confirm ownership
    const owned = await prisma.chatThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (!owned) {
      return new Response("Thread not found", { status: 404 });
    }
  }

  // Persist the user's latest message (the only one we haven't stored yet)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const text = extractText(lastUser);
    if (text.trim()) {
      await prisma.chatMessage.create({
        data: { threadId, role: "user", content: text },
      });
    }
  }

  const result = streamText({
    model: xai(MODELS.chat),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: buildToolsForUser(userId),
    // Allow multi-tool reasoning: call tools, get results, then summarize
    stopWhen: stepCountIs(5),
    // xAI native web search — Grok handles this server-side
    providerOptions: {
      xai: {
        searchParameters: {
          mode: "auto",
          returnCitations: true,
        },
      },
    },
    temperature: 0.3,

    onFinish: async ({ text, toolCalls, sources }) => {
      try {
        await prisma.chatMessage.create({
          data: {
            threadId: threadId!,
            role: "assistant",
            content: text,
            toolCalls: toolCalls ? JSON.parse(JSON.stringify(toolCalls)) : null,
            citations: sources ? JSON.parse(JSON.stringify(sources)) : null,
          },
        });
        await prisma.chatThread.update({
          where: { id: threadId! },
          data: { updatedAt: new Date() },
        });
      } catch (e) {
        console.error("[chat] failed to persist assistant message:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: { "x-thread-id": threadId },
  });
}

function extractText(m: UIMessage | undefined): string {
  if (!m) return "";
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
