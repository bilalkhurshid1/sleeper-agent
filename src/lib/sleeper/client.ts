// Thin wrapper around the Sleeper public REST API.

import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperPlayers,
  SleeperRoster,
  SleeperTradedPick,
  SleeperTransaction,
  SleeperTrendingPlayer,
  SleeperUser,
} from "./types";

const BASE_URL = "https://api.sleeper.app/v1";
const PLAYERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — the Sleeper player DB rarely changes

let playersCache: SleeperPlayers | null = null;
let playersCacheAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get<T>(path: string, retries = 3): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (resp.status === 429) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`${resp.status} ${resp.statusText}`);
      }
      return (await resp.json()) as T;
    } catch (err) {
      if (attempt === retries - 1) {
        throw new Error(`Sleeper API error for ${path}: ${err instanceof Error ? err.message : err}`);
      }
      await sleep(1000);
    }
  }
  return null;
}

// ── User ──────────────────────────────────────────────────────────────────

export async function getUser(usernameOrId: string): Promise<SleeperUser> {
  return (await get<SleeperUser>(`/user/${usernameOrId}`))!;
}

// ── League ────────────────────────────────────────────────────────────────

export async function getUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  return (await get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`)) ?? [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return (await get<SleeperLeague>(`/league/${leagueId}`))!;
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (await get<SleeperRoster[]>(`/league/${leagueId}/rosters`)) ?? [];
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  return (await get<SleeperUser[]>(`/league/${leagueId}/users`)) ?? [];
}

export async function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return (await get<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`)) ?? [];
}

export async function getTransactions(leagueId: string, roundNum: number): Promise<SleeperTransaction[]> {
  return (await get<SleeperTransaction[]>(`/league/${leagueId}/transactions/${roundNum}`)) ?? [];
}

export async function getTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
  return (await get<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`)) ?? [];
}

export async function getWinnersBracket(leagueId: string): Promise<unknown[]> {
  return (await get<unknown[]>(`/league/${leagueId}/winners_bracket`)) ?? [];
}

export async function getLosersBracket(leagueId: string): Promise<unknown[]> {
  return (await get<unknown[]>(`/league/${leagueId}/losers_bracket`)) ?? [];
}

// ── Drafts ────────────────────────────────────────────────────────────────

export async function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return (await get<SleeperDraft[]>(`/league/${leagueId}/drafts`)) ?? [];
}

export async function getDraft(draftId: string): Promise<SleeperDraft> {
  return (await get<SleeperDraft>(`/draft/${draftId}`))!;
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return (await get<SleeperDraftPick[]>(`/draft/${draftId}/picks`)) ?? [];
}

// ── Players ───────────────────────────────────────────────────────────────

/** Returns the full player database (~5 MB). Cached in-process with a 24h TTL. */
export async function getAllPlayers(sport = "nfl"): Promise<SleeperPlayers> {
  if (playersCache && Date.now() - playersCacheAt < PLAYERS_CACHE_TTL_MS) {
    return playersCache;
  }
  playersCache = (await get<SleeperPlayers>(`/players/${sport}`)) ?? {};
  playersCacheAt = Date.now();
  return playersCache;
}

export function invalidatePlayersCache(): void {
  playersCache = null;
  playersCacheAt = 0;
}

export async function getTrendingPlayers(
  sport = "nfl",
  trendType: "add" | "drop" = "add",
  limit = 25
): Promise<SleeperTrendingPlayer[]> {
  return (await get<SleeperTrendingPlayer[]>(`/players/${sport}/trending/${trendType}?limit=${limit}`)) ?? [];
}

// ── State ─────────────────────────────────────────────────────────────────

export async function getNflState(): Promise<SleeperNflState> {
  return (await get<SleeperNflState>("/state/nfl")) ?? {};
}
