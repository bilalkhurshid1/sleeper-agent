import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: RouteContext<"/api/chat/sessions/[id]">) {
  const { id } = await ctx.params;
  const { archived } = (await req.json()) as { archived?: boolean };

  if (typeof archived !== "boolean") {
    return new Response("`archived` must be a boolean.", { status: 400 });
  }

  const session = await prisma.coachSession.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
    select: { id: true, title: true, archivedAt: true },
  });

  return Response.json(session);
}
