import type { LeagueContext } from "./context";

export function contextToMarkdown(ctx: LeagueContext): string {
  const sections: string[] = [];

  sections.push(
    [
      "## NFL Season State",
      `- Season: ${ctx.nflState.season}`,
      `- Season type: ${ctx.nflState.seasonType}`,
      `- Current week: ${ctx.nflState.currentWeek} (display week: ${ctx.nflState.displayWeek})`,
      `- League creation season: ${ctx.nflState.leagueCreateSeason}`,
    ].join("\n")
  );

  sections.push(
    [
      "## My Account",
      `- Username: ${ctx.myAccount.username}`,
      `- Display name: ${ctx.myAccount.displayName}`,
      `- User ID: ${ctx.myAccount.userId}`,
    ].join("\n")
  );

  const lo = ctx.leagueOverview;
  sections.push(
    [
      "## League Overview",
      `- Name: ${lo.name}`,
      `- Season: ${lo.season}`,
      `- Status: ${lo.status}`,
      `- Total teams: ${lo.totalRosters}`,
      `- Roster positions: ${lo.rosterPositions.join(", ")}`,
      `- Playoff start week: ${lo.playoffWeekStart}`,
      `- Playoff teams: ${lo.playoffTeams}`,
      `- Trade deadline: ${lo.tradeDeadline}`,
      `- Waiver type: ${lo.waiverType} (0=rolling, 1=weekly reset, 2=FAAB)`,
      `- FAAB budget: ${lo.faabBudget}`,
      `- Taxi squad size: ${lo.taxiSlots}`,
      `- Reserve/IR slots: ${lo.reserveSlots}`,
      `- Max keepers: ${lo.maxKeepers}`,
    ].join("\n")
  );

  if (ctx.scoringHighlights.length > 0) {
    sections.push(
      "## Key Scoring Settings\n" + ctx.scoringHighlights.map((l) => `  ${l}`).join("\n")
    );
  }

  sections.push(
    "## Standings\n" +
      ctx.standings
        .map((s) => {
          const meFlag = s.isMe ? " ← YOU" : "";
          return (
            `  ${s.rank}. ${s.name}${meFlag}: ${s.wins}-${s.losses}-${s.ties}  ` +
            `PF:${s.pointsFor.toFixed(1)}  PA:${s.pointsAgainst.toFixed(1)}  ` +
            `FAAB used: $${s.faabUsed}  Waiver pos: ${s.waiverPosition}`
          );
        })
        .join("\n")
  );

  sections.push(
    "## Rosters\n" +
      ctx.rosters
        .map((r) => {
          const meFlag = r.isMe ? " (YOU)" : "";
          const lines = [`### ${r.name}${meFlag}`];
          if (r.starters.length > 0) lines.push("  Starters: " + r.starters.join(", "));
          if (r.bench.length > 0) lines.push("  Bench: " + r.bench.join(", "));
          if (r.taxi.length > 0) lines.push("  Taxi: " + r.taxi.join(", "));
          if (r.reserve.length > 0) lines.push("  IR/Reserve: " + r.reserve.join(", "));
          return lines.join("\n");
        })
        .join("\n\n")
  );

  if (ctx.currentWeekMatchups) {
    sections.push(
      "## Current Week Matchups\n" +
        [`Week ${ctx.currentWeekMatchups.week} matchups:`, ...ctx.currentWeekMatchups.lines].join("\n")
    );
  }

  if (ctx.recentTransactions.lines.length > 0) {
    sections.push(
      `## Recent Transactions (last ${ctx.recentTransactions.maxWeeks} weeks)\n` +
        ctx.recentTransactions.lines.join("\n")
    );
  }

  if (ctx.tradedPicks.length > 0) {
    sections.push("## Traded Draft Picks\n" + ctx.tradedPicks.join("\n"));
  }

  if (ctx.recentDrafts.length > 0) {
    sections.push(
      "## Recent Drafts\n" +
        ctx.recentDrafts.map((d) => [`### ${d.title}`, ...d.lines].join("\n")).join("\n\n")
    );
  }

  if (ctx.trendingAdds.length > 0) {
    sections.push("## Trending Adds (NFL-wide)\n  " + ctx.trendingAdds.join(", "));
  }
  if (ctx.trendingDrops.length > 0) {
    sections.push("## Trending Drops (NFL-wide)\n  " + ctx.trendingDrops.join(", "));
  }

  return sections.join("\n\n---\n\n");
}
