import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  return Response.json(settings);
}

export async function PATCH(req: Request) {
  const { provider, model, systemPromptOverride } = (await req.json()) as {
    provider?: string;
    model?: string;
    systemPromptOverride?: string | null;
  };

  if (provider && provider !== "anthropic" && provider !== "openai") {
    return new Response('`provider` must be "anthropic" or "openai".', { status: 400 });
  }

  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(systemPromptOverride !== undefined ? { systemPromptOverride } : {}),
    },
    create: {
      id: "default",
      provider: provider ?? "anthropic",
      model: model ?? "claude-opus-4-8",
      systemPromptOverride: systemPromptOverride ?? null,
    },
  });

  return Response.json(settings);
}
