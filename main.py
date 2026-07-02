#!/usr/bin/env python3
"""
Sleeper Dynasty Fantasy Football AI Coach
Usage: python main.py
"""

import os
import sys
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.rule import Rule
from rich.text import Text

import data_fetcher
from coach import Coach

load_dotenv()
console = Console()

COMMANDS = {
    "/refresh": "Re-fetch all league data from Sleeper",
    "/reset":   "Clear conversation history (keep league data)",
    "/myteam":  "Show a quick summary of your team",
    "/help":    "Show this help",
    "/quit":    "Exit",
}


def check_env() -> tuple[str, str, str, str]:
    """Validate required environment variables and return them."""
    missing = []

    username = os.environ.get("SLEEPER_USERNAME", "").strip()
    league_id = os.environ.get("SLEEPER_LEAGUE_ID", "").strip()
    provider = os.environ.get("AI_PROVIDER", "anthropic").strip().lower()
    season = os.environ.get("NFL_SEASON", "2025").strip()

    if not username:
        missing.append("SLEEPER_USERNAME")
    if not league_id:
        missing.append("SLEEPER_LEAGUE_ID")

    if provider == "anthropic" and not os.environ.get("ANTHROPIC_API_KEY"):
        missing.append("ANTHROPIC_API_KEY")
    elif provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")

    if missing:
        console.print(
            f"[bold red]Missing required .env variables:[/bold red] {', '.join(missing)}\n"
            "Copy [bold].env.example[/bold] to [bold].env[/bold] and fill in your values.",
            style="red",
        )
        sys.exit(1)

    return username, league_id, provider, season


def print_welcome(username: str, league_id: str, provider: str):
    console.print(Panel.fit(
        f"[bold cyan]Dynasty Fantasy Football AI Coach[/bold cyan]\n"
        f"League: [yellow]{league_id}[/yellow]  |  "
        f"Manager: [green]{username}[/green]  |  "
        f"AI: [magenta]{provider}[/magenta]\n\n"
        f"Type your question or use a command. Type [bold]/help[/bold] for options.",
        border_style="cyan",
    ))


def print_help():
    lines = ["[bold]Available commands:[/bold]"]
    for cmd, desc in COMMANDS.items():
        lines.append(f"  [cyan]{cmd}[/cyan]  — {desc}")
    console.print("\n".join(lines))


def main():
    username, league_id, provider, season = check_env()
    print_welcome(username, league_id, provider)

    # ── Initial data fetch ─────────────────────────────────────────────────────
    console.print("\n[bold]Fetching league data from Sleeper...[/bold]")
    try:
        league_context = data_fetcher.build_league_context(league_id, username, season)
    except Exception as e:
        console.print(f"[red]Failed to fetch league data: {e}[/red]")
        sys.exit(1)

    console.print("[green]League data loaded.[/green] Starting coach...\n")

    # ── Build coach ────────────────────────────────────────────────────────────
    try:
        coach = Coach(league_context, provider)
    except Exception as e:
        console.print(f"[red]Failed to initialise AI provider: {e}[/red]")
        sys.exit(1)

    console.print(Rule("Chat with your coach"))

    # ── REPL ───────────────────────────────────────────────────────────────────
    while True:
        try:
            user_input = Prompt.ask("\n[bold green]You[/bold green]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if not user_input:
            continue

        cmd = user_input.lower()

        if cmd in ("/quit", "/exit", "/q"):
            console.print("[dim]Goodbye![/dim]")
            break

        elif cmd == "/help":
            print_help()

        elif cmd == "/reset":
            coach.reset()
            console.print("[yellow]Conversation history cleared.[/yellow]")

        elif cmd == "/myteam":
            console.print("\n[bold]Your team:[/bold]")
            summary = data_fetcher.get_my_team_summary(league_id, username, season)
            console.print(summary)

        elif cmd == "/refresh":
            console.print("[bold]Re-fetching league data...[/bold]")
            try:
                league_context = data_fetcher.build_league_context(league_id, username, season)
                coach = Coach(league_context, provider)
                console.print("[green]League data refreshed. Conversation history cleared.[/green]")
            except Exception as e:
                console.print(f"[red]Refresh failed: {e}[/red]")

        else:
            # ── AI response ────────────────────────────────────────────────────
            console.print("\n[bold magenta]Coach[/bold magenta]")
            try:
                reply = coach.chat(user_input)
                console.print(Markdown(reply))
            except Exception as e:
                console.print(f"[red]AI error: {e}[/red]")


if __name__ == "__main__":
    main()
