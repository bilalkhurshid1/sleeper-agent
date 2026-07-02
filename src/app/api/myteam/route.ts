import { getMyTeamSummary } from "@/lib/coach/team-summary";

export const runtime = "nodejs";

export async function GET() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  const username = process.env.SLEEPER_USERNAME;
  if (!leagueId || !username) {
    return new Response("SLEEPER_LEAGUE_ID and SLEEPER_USERNAME must be set in .env", { status: 500 });
  }

  const summary = await getMyTeamSummary(leagueId, username);
  return Response.json({ summary });
}
