import * as sc from "@/lib/sleeper/client";
import type { SleeperPlayers, SleeperRoster } from "@/lib/sleeper/types";

function playerName(playerId: string, players: SleeperPlayers): string {
  const p = players[String(playerId)] ?? {};
  const fn = p.first_name ?? "";
  const ln = p.last_name ?? "";
  const pos = p.position ?? "?";
  const team = p.team || "FA";
  const name = `${fn} ${ln}`.trim() || playerId;
  return `${name} (${pos}, ${team})`;
}

export interface LeagueContext {
  nflState: {
    season: string;
    seasonType: string;
    currentWeek: number;
    displayWeek: number;
    leagueCreateSeason: string;
  };
  myAccount: { username: string; displayName: string; userId: string };
  leagueOverview: {
    name: string;
    season: string;
    status: string;
    totalRosters: number | string;
    rosterPositions: string[];
    playoffWeekStart: number | string;
    playoffTeams: number | string;
    tradeDeadline: number | string;
    waiverType: number | string;
    faabBudget: number | string;
    taxiSlots: number;
    reserveSlots: number;
    maxKeepers: number | string;
  };
  scoringHighlights: string[];
  standings: {
    rank: number;
    name: string;
    isMe: boolean;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    faabUsed: number;
    waiverPosition: number | string;
  }[];
  rosters: {
    name: string;
    isMe: boolean;
    starters: string[];
    bench: string[];
    taxi: string[];
    reserve: string[];
  }[];
  currentWeekMatchups: { week: number; lines: string[] } | null;
  recentTransactions: { maxWeeks: number; lines: string[] };
  tradedPicks: string[];
  recentDrafts: { title: string; lines: string[] }[];
  trendingAdds: string[];
  trendingDrops: string[];
}

const KEY_SCORING: [string, string][] = [
  ["rec", "Reception"],
  ["pass_td", "Passing TD"],
  ["rush_td", "Rushing TD"],
  ["rec_td", "Receiving TD"],
  ["pass_yd", "Passing yard"],
  ["rush_yd", "Rushing yard"],
  ["rec_yd", "Receiving yard"],
  ["bonus_rec_te", "TE bonus/reception"],
];

function fpts(s: { fpts?: number; fpts_decimal?: number }): number {
  return (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100;
}

function fptsAgainst(s: { fpts_against?: number; fpts_against_decimal?: number }): number {
  return (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100;
}

export async function buildLeagueContext(
  leagueId: string,
  username: string,
  season: string,
  maxTransactionWeeks = 5
): Promise<LeagueContext> {
  const nflState = await sc.getNflState();
  const currentWeek = nflState.week ?? 1;
  const displayWeek = nflState.display_week ?? currentWeek;
  const seasonType = nflState.season_type ?? "regular";

  const user = await sc.getUser(username);
  const myUserId = user.user_id ?? "";
  const myDisplayName = user.display_name ?? username;

  const league = await sc.getLeague(leagueId);
  const settings = league.settings ?? {};
  const scoringSettings = league.scoring_settings ?? {};
  const rosterPositions = league.roster_positions ?? [];

  const scoringHighlights: string[] = [];
  for (const [key, label] of KEY_SCORING) {
    const val = scoringSettings[key];
    if (val !== undefined) scoringHighlights.push(`${label}: ${val}`);
  }

  const [users, rosters, allPlayers] = await Promise.all([
    sc.getLeagueUsers(leagueId),
    sc.getRosters(leagueId),
    sc.getAllPlayers(),
  ]);

  const userMap = new Map(users.map((u) => [u.user_id, u]));
  const ownerName = new Map<number, string>();
  for (const r of rosters) {
    const u = r.owner_id ? userMap.get(r.owner_id) : undefined;
    ownerName.set(r.roster_id, u?.display_name || u?.metadata?.team_name || r.owner_id || "Unknown");
  }

  const myRosterId = rosters.find((r) => r.owner_id === myUserId)?.roster_id;

  const sortedRosters = [...rosters].sort((a, b) => {
    const sa = a.settings ?? {};
    const sb = b.settings ?? {};
    const winsDiff = (sb.wins ?? 0) - (sa.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;
    const lossesDiff = (sa.losses ?? 0) - (sb.losses ?? 0);
    if (lossesDiff !== 0) return lossesDiff;
    return fpts(sb) - fpts(sa);
  });

  const standings = sortedRosters.map((r, idx) => {
    const s = r.settings ?? {};
    return {
      rank: idx + 1,
      name: ownerName.get(r.roster_id) ?? "?",
      isMe: r.roster_id === myRosterId,
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      ties: s.ties ?? 0,
      pointsFor: fpts(s),
      pointsAgainst: fptsAgainst(s),
      faabUsed: s.waiver_budget_used ?? 0,
      waiverPosition: s.waiver_position ?? "N/A",
    };
  });

  function rosterGroups(r: SleeperRoster) {
    const starters = r.starters ?? [];
    const players = r.players ?? [];
    const taxi = r.taxi ?? [];
    const reserve = r.reserve ?? [];
    const bench = players.filter((p) => !starters.includes(p) && !taxi.includes(p) && !reserve.includes(p));
    return { starters, bench, taxi, reserve };
  }

  const rosterSections = sortedRosters.map((r) => {
    const { starters, bench, taxi, reserve } = rosterGroups(r);
    return {
      name: ownerName.get(r.roster_id) ?? "?",
      isMe: r.roster_id === myRosterId,
      starters: starters.filter((p) => p !== "0").map((p) => playerName(p, allPlayers)),
      bench: bench.map((p) => playerName(p, allPlayers)),
      taxi: taxi.map((p) => playerName(p, allPlayers)),
      reserve: reserve.map((p) => playerName(p, allPlayers)),
    };
  });

  let currentWeekMatchups: LeagueContext["currentWeekMatchups"] = null;
  if (displayWeek >= 1) {
    const matchups = await sc.getMatchups(leagueId, displayWeek);
    if (matchups.length > 0) {
      const matchupMap = new Map<number, typeof matchups>();
      for (const m of matchups) {
        if (m.matchup_id == null) continue;
        const arr = matchupMap.get(m.matchup_id) ?? [];
        arr.push(m);
        matchupMap.set(m.matchup_id, arr);
      }
      const lines = [...matchupMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, pair]) => {
          const parts = pair.map((m) => {
            const team = ownerName.get(m.roster_id) ?? String(m.roster_id);
            return `${team} (${(m.points ?? 0).toFixed(2)} pts)`;
          });
          return `  ${parts.join(" vs ")}`;
        });
      currentWeekMatchups = { week: displayWeek, lines };
    }
  }

  const transLines: string[] = [];
  const startWeek = Math.max(1, displayWeek - maxTransactionWeeks + 1);
  for (let week = startWeek; week <= displayWeek; week++) {
    const transactions = await sc.getTransactions(leagueId, week);
    for (const t of transactions.slice(0, 20)) {
      const ttype = t.type ?? "";
      const adds = t.adds ?? {};
      const drops = t.drops ?? {};
      const waiverBudget = t.settings?.waiver_bid;
      const consenterIds = t.consenter_ids ?? [];

      if (ttype === "trade") {
        const involved = consenterIds.map((rid) => ownerName.get(rid) ?? String(rid));
        const tradedPlayers = Object.keys(adds).slice(0, 6);
        const tradedNames = tradedPlayers.map((pid) => playerName(pid, allPlayers));
        transLines.push(`  [Wk${week}] TRADE between ${involved.join(" & ")}: ${tradedNames.join(", ")}`);
      } else if (ttype === "waiver" || ttype === "free_agent") {
        for (const [pid, rid] of Object.entries(adds)) {
          const team = ownerName.get(Number(rid)) ?? String(rid);
          const label = ttype === "waiver" ? `WAIVER ($${waiverBudget})` : "FA ADD";
          transLines.push(`  [Wk${week}] ${label}: ${team} added ${playerName(pid, allPlayers)}`);
        }
        for (const [pid, rid] of Object.entries(drops)) {
          const team = ownerName.get(Number(rid)) ?? String(rid);
          transLines.push(`  [Wk${week}] DROP: ${team} dropped ${playerName(pid, allPlayers)}`);
        }
      }
    }
  }

  const tradedPicksData = await sc.getTradedPicks(leagueId);
  const tradedPicks = tradedPicksData.slice(0, 40).map((pk) => {
    const owner = ownerName.get(pk.owner_id) ?? "?";
    const prevOwner = ownerName.get(pk.previous_owner_id) ?? "?";
    const orig = ownerName.get(pk.roster_id) ?? "?";
    return `  ${pk.season} Rd${pk.round} (orig: ${orig}) → now owned by ${owner} (from ${prevOwner})`;
  });

  const drafts = await sc.getLeagueDrafts(leagueId);
  const recentDrafts = await Promise.all(
    drafts.slice(0, 2).map(async (draft) => {
      const picks = await sc.getDraftPicks(draft.draft_id);
      const lines = picks.slice(0, 50).map((pk) => {
        const rid = pk.picked_by ?? "";
        const team = ownerName.get(Number(rid)) ?? rid;
        const pid = pk.player_id ?? "";
        return `  Rd${pk.round} Pk${pk.pick_no}: ${team} → ${playerName(pid, allPlayers)}`;
      });
      return { title: `${draft.season} ${draft.type} draft (${draft.status})`, lines };
    })
  );

  const [trendingAddsData, trendingDropsData] = await Promise.all([
    sc.getTrendingPlayers("nfl", "add", 15),
    sc.getTrendingPlayers("nfl", "drop", 15),
  ]);
  const trendingAdds = trendingAddsData.map((t) => playerName(t.player_id, allPlayers));
  const trendingDrops = trendingDropsData.map((t) => playerName(t.player_id, allPlayers));

  return {
    nflState: {
      season: nflState.season ?? season,
      seasonType,
      currentWeek,
      displayWeek,
      leagueCreateSeason: nflState.league_create_season ?? "N/A",
    },
    myAccount: { username, displayName: myDisplayName, userId: myUserId },
    leagueOverview: {
      name: league.name ?? "Unknown",
      season: league.season ?? season,
      status: league.status ?? "unknown",
      totalRosters: league.total_rosters ?? "?",
      rosterPositions,
      playoffWeekStart: settings.playoff_week_start ?? "N/A",
      playoffTeams: settings.playoff_teams ?? "N/A",
      tradeDeadline: settings.trade_deadline ?? "N/A",
      waiverType: settings.waiver_type ?? "N/A",
      faabBudget: settings.waiver_budget ?? "N/A",
      taxiSlots: settings.taxi_slots ?? 0,
      reserveSlots: settings.reserve_slots ?? 0,
      maxKeepers: settings.max_keepers ?? "N/A",
    },
    scoringHighlights,
    standings,
    rosters: rosterSections,
    currentWeekMatchups,
    recentTransactions: { maxWeeks: maxTransactionWeeks, lines: transLines.slice(-60) },
    tradedPicks,
    recentDrafts,
    trendingAdds,
    trendingDrops,
  };
}

export { playerName };
