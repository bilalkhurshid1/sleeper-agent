import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sessions = await prisma.coachSession.findMany({
    where: { archivedAt: null, messages: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, archivedAt: true },
  });
  return Response.json(sessions);
}

export async function POST() {
  const session = await prisma.coachSession.create({
    data: {},
    select: { id: true, title: true },
  });
  return Response.json(session, { status: 201 });
}
