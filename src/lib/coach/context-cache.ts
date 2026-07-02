// Single-tenant app — one league configured via env, so one cached context
// snapshot serves every chat session. Built lazily on first use, invalidated
// only by the explicit /api/refresh action (mirrors the CLI's /refresh command).

import { buildLeagueContext } from "./context";
import { contextToMarkdown } from "./format";

let cachedMarkdown: string | null = null;

export async function getLeagueContextMarkdown(): Promise<string> {
  if (cachedMarkdown !== null) return cachedMarkdown;

  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  const username = process.env.SLEEPER_USERNAME;
  const season = process.env.NFL_SEASON ?? "2026";
  if (!leagueId || !username) {
    throw new Error("SLEEPER_LEAGUE_ID and SLEEPER_USERNAME must be set in .env");
  }

  const ctx = await buildLeagueContext(leagueId, username, season);
  cachedMarkdown = contextToMarkdown(ctx);
  return cachedMarkdown;
}

export function invalidateLeagueContextCache(): void {
  cachedMarkdown = null;
}
