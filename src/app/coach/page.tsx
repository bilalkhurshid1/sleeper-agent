import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CoachLayout } from "@/components/chat/coach-layout";
import type { UIMessage } from "ai";

type SearchParams = Promise<{ session?: string }>;

export default async function CoachPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session: sessionId } = await searchParams;

  if (!sessionId) {
    const s = await prisma.coachSession.create({ data: {} });
    redirect(`/coach?session=${s.id}`);
  }

  const session = await prisma.coachSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    const s = await prisma.coachSession.create({ data: {} });
    redirect(`/coach?session=${s.id}`);
  }

  const [sessions, archivedSessions, dbMessages, settings] = await Promise.all([
    prisma.coachSession.findMany({
      where: { archivedAt: null, messages: { some: {} } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, archivedAt: true },
    }),
    prisma.coachSession.findMany({
      where: { archivedAt: { not: null }, messages: { some: {} } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, archivedAt: true },
    }),
    prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true },
    }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  const initialMessages: UIMessage[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Coach</h1>
      <CoachLayout
        sessionId={sessionId}
        sessions={sessions}
        archivedSessions={archivedSessions}
        initialMessages={initialMessages}
        settings={settings}
      />
    </div>
  );
}
