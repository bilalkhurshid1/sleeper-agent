import { invalidatePlayersCache } from "@/lib/sleeper/client";
import { invalidateLeagueContextCache } from "@/lib/coach/context-cache";

export const runtime = "nodejs";

export async function POST() {
  invalidatePlayersCache();
  invalidateLeagueContextCache();
  return Response.json({ status: "refreshed" });
}
