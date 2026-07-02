import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { prisma } from "@/lib/db";
import { getModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getLeagueContextMarkdown } from "@/lib/coach/context-cache";

export const runtime = "nodejs";

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = m.parts ?? [];
    return parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
  }
  return "";
}

export async function POST(req: Request) {
  const { messages, sessionId } = (await req.json()) as {
    messages: UIMessage[];
    sessionId?: string;
  };

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    return new Response("Settings row missing. Run `npx tsx prisma/seed.ts`.", { status: 500 });
  }

  const userMsg = lastUserText(messages);
  const contextMarkdown = await getLeagueContextMarkdown();
  const system = buildSystemPrompt(contextMarkdown, settings.systemPromptOverride);

  await prisma.chatMessage.create({
    data: { role: "user", content: userMsg, sessionId: sessionId ?? null },
  });

  if (sessionId) {
    const userMsgCount = await prisma.chatMessage.count({ where: { sessionId, role: "user" } });
    const sessionData = { archivedAt: null as Date | null, updatedAt: new Date() };
    if (userMsgCount === 1) {
      await prisma.coachSession.update({
        where: { id: sessionId },
        data: { ...sessionData, title: userMsg.slice(0, 40).trim() || "New session" },
      });
    } else {
      await prisma.coachSession.update({ where: { id: sessionId }, data: sessionData });
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: getModel(settings),
    system,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      await prisma.chatMessage.create({
        data: {
          role: "assistant",
          content: text,
          provider: settings.provider,
          model: settings.model,
          sessionId: sessionId ?? null,
        },
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
