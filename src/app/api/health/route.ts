// Lightweight liveness probe polled by deploy/deploy-production.sh after a restart.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok" });
}
