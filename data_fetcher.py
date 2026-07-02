"""
Fetches all relevant league data from Sleeper and structures it into a
rich text context that can be fed to an AI model.
"""

from __future__ import annotations

import json
from typing import Optional
import sleeper_client as sc
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _player_name(player_id: str, players: dict) -> str:
    p = players.get(str(player_id), {})
    fn = p.get("first_name", "")
    ln = p.get("last_name", "")
    pos = p.get("position", "?")
    team = p.get("team") or "FA"
    name = f"{fn} {ln}".strip() or player_id
    return f"{name} ({pos}, {team})"


def _fmt_settings(settings: dict) -> str:
    lines = []
    for k, v in settings.items():
        lines.append(f"  {k}: {v}")
    return "\n".join(lines)


# ── Main data fetch ────────────────────────────────────────────────────────────

def build_league_context(
    league_id: str,
    username: str,
    season: str,
    max_transaction_weeks: int = 5,
) -> str:
    """
    Returns a multi-section plain-text summary of the entire league state.
    This is passed as context to the AI model.
    """
    sections: list[str] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        transient=True,
        console=console,
    ) as progress:

        # ── NFL state ──────────────────────────────────────────────────────────
        task = progress.add_task("Fetching NFL state...", total=None)
        nfl_state = sc.get_nfl_state()
        current_week = nfl_state.get("week", 1)
        display_week = nfl_state.get("display_week", current_week)
        season_type = nfl_state.get("season_type", "regular")
        progress.update(task, description="NFL state fetched")

        sections.append(
            f"## NFL Season State\n"
            f"- Season: {nfl_state.get('season', season)}\n"
            f"- Season type: {season_type}\n"
            f"- Current week: {current_week} (display week: {display_week})\n"
            f"- League creation season: {nfl_state.get('league_create_season', 'N/A')}"
        )

        # ── User ───────────────────────────────────────────────────────────────
        progress.update(task, description="Fetching user info...")
        user = sc.get_user(username)
        my_user_id = user.get("user_id", "")
        my_display_name = user.get("display_name", username)

        sections.append(
            f"## My Account\n"
            f"- Username: {username}\n"
            f"- Display name: {my_display_name}\n"
            f"- User ID: {my_user_id}"
        )

        # ── League info ────────────────────────────────────────────────────────
        progress.update(task, description="Fetching league info...")
        league = sc.get_league(league_id)
        settings = league.get("settings", {})
        scoring_settings = league.get("scoring_settings", {})
        roster_positions = league.get("roster_positions", [])

        sections.append(
            f"## League Overview\n"
            f"- Name: {league.get('name', 'Unknown')}\n"
            f"- Season: {league.get('season', season)}\n"
            f"- Status: {league.get('status', 'unknown')}\n"
            f"- Total teams: {league.get('total_rosters', '?')}\n"
            f"- Roster positions: {', '.join(roster_positions)}\n"
            f"- Playoff start week: {settings.get('playoff_week_start', 'N/A')}\n"
            f"- Playoff teams: {settings.get('playoff_teams', 'N/A')}\n"
            f"- Trade deadline: {settings.get('trade_deadline', 'N/A')}\n"
            f"- Waiver type: {settings.get('waiver_type', 'N/A')} "
            f"(0=rolling, 1=weekly reset, 2=FAAB)\n"
            f"- FAAB budget: {settings.get('waiver_budget', 'N/A')}\n"
            f"- Taxi squad size: {settings.get('taxi_slots', 0)}\n"
            f"- Reserve/IR slots: {settings.get('reserve_slots', 0)}\n"
            f"- Max keepers: {settings.get('max_keepers', 'N/A')}\n"
        )

        # Selected scoring highlights
        score_lines = []
        key_scoring = [
            ("rec", "Reception"),
            ("pass_td", "Passing TD"),
            ("rush_td", "Rushing TD"),
            ("rec_td", "Receiving TD"),
            ("pass_yd", "Passing yard"),
            ("rush_yd", "Rushing yard"),
            ("rec_yd", "Receiving yard"),
            ("bonus_rec_te", "TE bonus/reception"),
        ]
        for key, label in key_scoring:
            val = scoring_settings.get(key)
            if val is not None:
                score_lines.append(f"  {label}: {val}")
        if score_lines:
            sections.append("## Key Scoring Settings\n" + "\n".join(score_lines))

        # ── Users & rosters ────────────────────────────────────────────────────
        progress.update(task, description="Fetching rosters and managers...")
        users = sc.get_league_users(league_id)
        rosters = sc.get_rosters(league_id)

        # Build lookup maps
        user_map: dict[str, dict] = {u["user_id"]: u for u in users}
        roster_map: dict[str, dict] = {r["roster_id"]: r for r in rosters}

        # Map roster_id -> owner display_name
        owner_name: dict[str, str] = {}
        for r in rosters:
            uid = r.get("owner_id", "")
            u = user_map.get(uid, {})
            owner_name[r["roster_id"]] = (
                u.get("display_name") or u.get("metadata", {}).get("team_name") or uid or "Unknown"
            )

        # Find my roster
        my_roster_id: Optional[str] = None
        for r in rosters:
            if r.get("owner_id") == my_user_id:
                my_roster_id = r["roster_id"]
                break

        # ── Player database ────────────────────────────────────────────────────
        progress.update(task, description="Fetching player database (may take a moment)...")
        all_players = sc.get_all_players()

        # ── Build standings ────────────────────────────────────────────────────
        standings_lines = []
        sorted_rosters = sorted(
            rosters,
            key=lambda r: (
                -(r.get("settings", {}).get("wins", 0)),
                r.get("settings", {}).get("losses", 0),
                -(r.get("settings", {}).get("fpts", 0) + r.get("settings", {}).get("fpts_decimal", 0) / 100),
            ),
        )
        for rank, r in enumerate(sorted_rosters, 1):
            s = r.get("settings", {})
            wins = s.get("wins", 0)
            losses = s.get("losses", 0)
            ties = s.get("ties", 0)
            fpts = s.get("fpts", 0) + s.get("fpts_decimal", 0) / 100
            fptsagainst = s.get("fpts_against", 0) + s.get("fpts_against_decimal", 0) / 100
            waiver_pos = s.get("waiver_position", "N/A")
            waiver_budget = s.get("waiver_budget_used", 0)
            name = owner_name.get(r["roster_id"], "?")
            me_flag = " ← YOU" if r["roster_id"] == my_roster_id else ""
            standings_lines.append(
                f"  {rank}. {name}{me_flag}: {wins}-{losses}-{ties}  "
                f"PF:{fpts:.1f}  PA:{fptsagainst:.1f}  "
                f"FAAB used: ${waiver_budget}  Waiver pos: {waiver_pos}"
            )

        sections.append("## Standings\n" + "\n".join(standings_lines))

        # ── Rosters detail ─────────────────────────────────────────────────────
        progress.update(task, description="Building roster details...")
        roster_sections = []
        for r in sorted_rosters:
            name = owner_name.get(r["roster_id"], "?")
            me_flag = " (YOU)" if r["roster_id"] == my_roster_id else ""
            lines = [f"### {name}{me_flag}"]

            starters = r.get("starters") or []
            players = r.get("players") or []
            taxi = r.get("taxi") or []
            reserve = r.get("reserve") or []
            bench = [p for p in players if p not in starters and p not in taxi and p not in reserve]

            if starters:
                lines.append("  Starters: " + ", ".join(_player_name(p, all_players) for p in starters if p != "0"))
            if bench:
                lines.append("  Bench: " + ", ".join(_player_name(p, all_players) for p in bench))
            if taxi:
                lines.append("  Taxi: " + ", ".join(_player_name(p, all_players) for p in taxi))
            if reserve:
                lines.append("  IR/Reserve: " + ", ".join(_player_name(p, all_players) for p in reserve))

            roster_sections.append("\n".join(lines))

        sections.append("## Rosters\n" + "\n\n".join(roster_sections))

        # ── Current week matchups ─────────────────────────────────────────────
        if display_week and display_week >= 1:
            progress.update(task, description=f"Fetching week {display_week} matchups...")
            matchups = sc.get_matchups(league_id, display_week)
            if matchups:
                matchup_map: dict[int, list] = {}
                for m in matchups:
                    mid = m.get("matchup_id")
                    if mid:
                        matchup_map.setdefault(mid, []).append(m)

                matchup_lines = [f"Week {display_week} matchups:"]
                for mid, pair in sorted(matchup_map.items()):
                    parts = []
                    for m in pair:
                        rid = str(m.get("roster_id", ""))
                        pts = m.get("points", 0)
                        team = owner_name.get(rid, rid)
                        parts.append(f"{team} ({pts:.2f} pts)")
                    matchup_lines.append("  " + " vs ".join(parts))

                sections.append("## Current Week Matchups\n" + "\n".join(matchup_lines))

        # ── Recent transactions ────────────────────────────────────────────────
        progress.update(task, description="Fetching recent transactions...")
        trans_lines = []
        for week in range(max(1, display_week - max_transaction_weeks + 1), display_week + 1):
            transactions = sc.get_transactions(league_id, week)
            for t in transactions[:20]:  # cap per week
                ttype = t.get("type", "")
                status = t.get("status", "")
                adds = t.get("adds") or {}
                drops = t.get("drops") or {}
                waiver_budget = t.get("settings", {}).get("waiver_bid", None)
                consenter_ids = t.get("consenter_ids") or []

                if ttype == "trade":
                    involved = [owner_name.get(str(rid), str(rid)) for rid in consenter_ids]
                    traded_players = list(adds.keys())
                    traded_names = [_player_name(pid, all_players) for pid in traded_players[:6]]
                    trans_lines.append(f"  [Wk{week}] TRADE between {' & '.join(involved)}: {', '.join(traded_names)}")
                elif ttype in ("waiver", "free_agent"):
                    for pid, rid in adds.items():
                        team = owner_name.get(str(rid), str(rid))
                        label = f"WAIVER (${waiver_budget})" if ttype == "waiver" else "FA ADD"
                        trans_lines.append(f"  [Wk{week}] {label}: {team} added {_player_name(pid, all_players)}")
                    for pid, rid in drops.items():
                        team = owner_name.get(str(rid), str(rid))
                        trans_lines.append(f"  [Wk{week}] DROP: {team} dropped {_player_name(pid, all_players)}")

        if trans_lines:
            sections.append(
                f"## Recent Transactions (last {max_transaction_weeks} weeks)\n"
                + "\n".join(trans_lines[-60:])  # cap total
            )

        # ── Traded picks ───────────────────────────────────────────────────────
        progress.update(task, description="Fetching traded picks...")
        traded_picks = sc.get_traded_picks(league_id)
        if traded_picks:
            pick_lines = []
            for pk in traded_picks[:40]:
                owner = owner_name.get(str(pk.get("owner_id", "")), "?")
                prev_owner = owner_name.get(str(pk.get("previous_owner_id", "")), "?")
                orig = owner_name.get(str(pk.get("roster_id", "")), "?")
                pick_lines.append(
                    f"  {pk.get('season')} Rd{pk.get('round')} "
                    f"(orig: {orig}) → now owned by {owner} (from {prev_owner})"
                )
            sections.append("## Traded Draft Picks\n" + "\n".join(pick_lines))

        # ── Draft history ──────────────────────────────────────────────────────
        progress.update(task, description="Fetching draft history...")
        drafts = sc.get_league_drafts(league_id)
        if drafts:
            draft_sections = []
            for draft in drafts[:2]:  # last 2 drafts
                did = draft.get("draft_id", "")
                dtype = draft.get("type", "")
                dstatus = draft.get("status", "")
                dseason = draft.get("season", "")
                picks = sc.get_draft_picks(did)
                d_lines = [f"### {dseason} {dtype} draft ({dstatus})"]
                for pk in picks[:50]:
                    rid = str(pk.get("picked_by", ""))
                    team = owner_name.get(rid, rid)
                    pid = str(pk.get("player_id", ""))
                    d_lines.append(
                        f"  Rd{pk.get('round')} Pk{pk.get('pick_no')}: "
                        f"{team} → {_player_name(pid, all_players)}"
                    )
                draft_sections.append("\n".join(d_lines))
            sections.append("## Recent Drafts\n" + "\n\n".join(draft_sections))

        # ── Trending players ───────────────────────────────────────────────────
        progress.update(task, description="Fetching trending players...")
        trending_adds = sc.get_trending_players("nfl", "add", 15)
        trending_drops = sc.get_trending_players("nfl", "drop", 15)

        if trending_adds:
            add_names = [_player_name(str(t.get("player_id", "")), all_players) for t in trending_adds]
            sections.append("## Trending Adds (NFL-wide)\n  " + ", ".join(add_names))
        if trending_drops:
            drop_names = [_player_name(str(t.get("player_id", "")), all_players) for t in trending_drops]
            sections.append("## Trending Drops (NFL-wide)\n  " + ", ".join(drop_names))

        progress.update(task, description="Done!")

    return "\n\n---\n\n".join(sections)


def get_my_team_summary(league_id: str, username: str, season: str) -> str:
    """Returns a focused summary of just the user's own team."""
    user = sc.get_user(username)
    my_user_id = user.get("user_id", "")
    rosters = sc.get_rosters(league_id)
    all_players = sc.get_all_players()

    my_roster = next((r for r in rosters if r.get("owner_id") == my_user_id), None)
    if not my_roster:
        return "Could not find your roster."

    s = my_roster.get("settings", {})
    players = my_roster.get("players") or []
    starters = my_roster.get("starters") or []
    taxi = my_roster.get("taxi") or []
    reserve = my_roster.get("reserve") or []
    bench = [p for p in players if p not in starters and p not in taxi and p not in reserve]

    lines = [
        f"Your record: {s.get('wins',0)}-{s.get('losses',0)}-{s.get('ties',0)}",
        f"Points for: {s.get('fpts',0) + s.get('fpts_decimal',0)/100:.1f}",
        f"Points against: {s.get('fpts_against',0) + s.get('fpts_against_decimal',0)/100:.1f}",
        f"FAAB remaining: ${s.get('waiver_budget_used',0)} used",
        "",
        "Starters: " + (", ".join(_player_name(p, all_players) for p in starters if p != "0") or "none"),
        "Bench: " + (", ".join(_player_name(p, all_players) for p in bench) or "none"),
        "Taxi: " + (", ".join(_player_name(p, all_players) for p in taxi) or "none"),
        "IR/Reserve: " + (", ".join(_player_name(p, all_players) for p in reserve) or "none"),
    ]
    return "\n".join(lines)
