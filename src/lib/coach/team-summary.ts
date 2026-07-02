import * as sc from "@/lib/sleeper/client";
import { playerName } from "./context";

export async function getMyTeamSummary(leagueId: string, username: string): Promise<string> {
  const user = await sc.getUser(username);
  const myUserId = user.user_id ?? "";
  const [rosters, allPlayers] = await Promise.all([sc.getRosters(leagueId), sc.getAllPlayers()]);

  const myRoster = rosters.find((r) => r.owner_id === myUserId);
  if (!myRoster) {
    return "Could not find your roster.";
  }

  const s = myRoster.settings ?? {};
  const players = myRoster.players ?? [];
  const starters = myRoster.starters ?? [];
  const taxi = myRoster.taxi ?? [];
  const reserve = myRoster.reserve ?? [];
  const bench = players.filter((p) => !starters.includes(p) && !taxi.includes(p) && !reserve.includes(p));

  const fpts = (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100;
  const fptsAgainst = (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100;

  const lines = [
    `Your record: ${s.wins ?? 0}-${s.losses ?? 0}-${s.ties ?? 0}`,
    `Points for: ${fpts.toFixed(1)}`,
    `Points against: ${fptsAgainst.toFixed(1)}`,
    `FAAB remaining: $${s.waiver_budget_used ?? 0} used`,
    "",
    "Starters: " + (starters.filter((p) => p !== "0").map((p) => playerName(p, allPlayers)).join(", ") || "none"),
    "Bench: " + (bench.map((p) => playerName(p, allPlayers)).join(", ") || "none"),
    "Taxi: " + (taxi.map((p) => playerName(p, allPlayers)).join(", ") || "none"),
    "IR/Reserve: " + (reserve.map((p) => playerName(p, allPlayers)).join(", ") || "none"),
  ];
  return lines.join("\n");
}
