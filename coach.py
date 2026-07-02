"""
Dynasty Fantasy Football AI Coach.
Maintains a multi-turn conversation with full league context injected as
the system prompt.
"""

from __future__ import annotations

import os
from typing import Optional

SYSTEM_PROMPT_TEMPLATE = """\
You are an expert dynasty fantasy football coach and analyst. You have deep knowledge of:
- NFL players, teams, statistics, injury history, and contracts
- Dynasty fantasy football strategy (rookie drafts, trading, long-term roster building)
- Redraft and keeper strategy
- Trade value and negotiation
- Waiver wire pickups
- Positional scarcity and aging curves

You have been given complete data about the user's Sleeper dynasty league below. Use this data
to give specific, actionable, personalized advice. Always reference actual players and teams
from the user's roster and league when answering.

When making recommendations:
- Be direct and confident
- Explain your reasoning briefly
- Consider both short-term (this season) and long-term (dynasty) implications
- Factor in scoring settings and roster construction when evaluating players

=== LEAGUE DATA (fetched live from Sleeper) ===

{league_context}

=== END LEAGUE DATA ===

The user is the manager marked with "(YOU)" or "← YOU" in the data above.
"""


class Coach:
    def __init__(self, league_context: str, provider: str = "anthropic"):
        self.provider = provider.lower()
        self.history: list[dict] = []
        self.system_prompt = SYSTEM_PROMPT_TEMPLATE.format(league_context=league_context)
        self._client = self._build_client()

    def _build_client(self):
        if self.provider == "anthropic":
            import anthropic
            return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        elif self.provider == "openai":
            import openai
            return openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        else:
            raise ValueError(f"Unknown provider: {self.provider!r}. Use 'anthropic' or 'openai'.")

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})

        if self.provider == "anthropic":
            model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-6")
            response = self._client.messages.create(
                model=model,
                max_tokens=2048,
                system=self.system_prompt,
                messages=self.history,
            )
            reply = response.content[0].text

        elif self.provider == "openai":
            model = os.environ.get("OPENAI_MODEL", "gpt-4o")
            messages = [{"role": "system", "content": self.system_prompt}] + self.history
            response = self._client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=2048,
            )
            reply = response.choices[0].message.content

        self.history.append({"role": "assistant", "content": reply})
        return reply

    def reset(self):
        """Clear conversation history (keeps system prompt / league context)."""
        self.history = []
