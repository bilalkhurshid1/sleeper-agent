"""Thin wrapper around the Sleeper public REST API."""

import time
import requests

BASE_URL = "https://api.sleeper.app/v1"
_PLAYERS_CACHE: dict | None = None


def _get(path: str, retries: int = 3) -> dict | list | None:
    url = f"{BASE_URL}{path}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 429:
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == retries - 1:
                raise RuntimeError(f"Sleeper API error for {path}: {e}") from e
            time.sleep(1)
    return None


# ── User ──────────────────────────────────────────────────────────────────────

def get_user(username_or_id: str) -> dict:
    return _get(f"/user/{username_or_id}")


# ── League ────────────────────────────────────────────────────────────────────

def get_user_leagues(user_id: str, season: str) -> list:
    return _get(f"/user/{user_id}/leagues/nfl/{season}") or []


def get_league(league_id: str) -> dict:
    return _get(f"/league/{league_id}")


def get_rosters(league_id: str) -> list:
    return _get(f"/league/{league_id}/rosters") or []


def get_league_users(league_id: str) -> list:
    return _get(f"/league/{league_id}/users") or []


def get_matchups(league_id: str, week: int) -> list:
    return _get(f"/league/{league_id}/matchups/{week}") or []


def get_transactions(league_id: str, round_num: int) -> list:
    return _get(f"/league/{league_id}/transactions/{round_num}") or []


def get_traded_picks(league_id: str) -> list:
    return _get(f"/league/{league_id}/traded_picks") or []


def get_winners_bracket(league_id: str) -> list:
    return _get(f"/league/{league_id}/winners_bracket") or []


def get_losers_bracket(league_id: str) -> list:
    return _get(f"/league/{league_id}/losers_bracket") or []


# ── Drafts ────────────────────────────────────────────────────────────────────

def get_league_drafts(league_id: str) -> list:
    return _get(f"/league/{league_id}/drafts") or []


def get_draft(draft_id: str) -> dict:
    return _get(f"/draft/{draft_id}")


def get_draft_picks(draft_id: str) -> list:
    return _get(f"/draft/{draft_id}/picks") or []


# ── Players ───────────────────────────────────────────────────────────────────

def get_all_players(sport: str = "nfl") -> dict:
    """Returns the full player database (~5 MB). Cached after first call."""
    global _PLAYERS_CACHE
    if _PLAYERS_CACHE is None:
        _PLAYERS_CACHE = _get(f"/players/{sport}") or {}
    return _PLAYERS_CACHE


def get_trending_players(sport: str = "nfl", trend_type: str = "add", limit: int = 25) -> list:
    return _get(f"/players/{sport}/trending/{trend_type}?limit={limit}") or []


# ── State ─────────────────────────────────────────────────────────────────────

def get_nfl_state() -> dict:
    return _get("/state/nfl") or {}
