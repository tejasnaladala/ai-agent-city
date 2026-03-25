"""Profession assignment — unemployed agents find jobs. Every 100 ticks."""

from __future__ import annotations
import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine.world_state import WorldState
    from ..engine.event_bus import EventBus

# Available professions and their requirements
PROFESSIONS = {
    "farmer":       {"primary_skill": "farming",       "min_skill": 0.1, "wage": 0.8},
    "miner":        {"primary_skill": "mining",        "min_skill": 0.1, "wage": 0.9},
    "builder":      {"primary_skill": "construction",  "min_skill": 0.2, "wage": 1.0},
    "craftsman":    {"primary_skill": "crafting",      "min_skill": 0.2, "wage": 1.1},
    "trader":       {"primary_skill": "trading",       "min_skill": 0.15,"wage": 1.2},
    "teacher":      {"primary_skill": "teaching",      "min_skill": 0.4, "wage": 1.0},
    "doctor":       {"primary_skill": "medicine",      "min_skill": 0.5, "wage": 2.0},
    "engineer":     {"primary_skill": "engineering",   "min_skill": 0.4, "wage": 1.8},
    "logistics":    {"primary_skill": "logistics",     "min_skill": 0.1, "wage": 0.85},
    "factory_worker":{"primary_skill": "manufacturing","min_skill": 0.15,"wage": 0.95},
}


class ProfessionAssignmentSystem:
    """
    Unemployed adult agents evaluate and choose professions.
    Frequency: 100 (every 100 ticks).
    """

    def update(self, world: "WorldState", tick: int, event_bus: "EventBus") -> None:
        from ..engine.event_bus import Event

        unemployed = [
            a for a in world.get_alive_agents()
            if a.biology.lifecycle_stage in ("adult", "elder")
            and a.economy.profession is None
            and a.economy.employer_id is None
        ]

        for agent in unemployed:
            best_profession = self._choose_profession(agent, world)
            if best_profession:
                new_econ = agent.economy.set_profession(
                    best_profession,
                    PROFESSIONS[best_profession]["wage"]
                )
                new_agent = agent.with_economy(new_econ)
                world.agents[agent.identity.agent_id] = new_agent

                event_bus.emit(Event(
                    tick=tick,
                    event_type="agent.employed",
                    data={
                        "name": agent.identity.name,
                        "profession": best_profession,
                        "wage": PROFESSIONS[best_profession]["wage"],
                    },
                    source_agent_id=agent.identity.agent_id,
                ))

    def _choose_profession(self, agent, world) -> str | None:
        """Score each profession and pick the best fit."""
        scores: dict[str, float] = {}

        for prof_name, spec in PROFESSIONS.items():
            skill_level = agent.skills.skills.get(spec["primary_skill"], 0)
            talent = agent.skills.talent.get(spec["primary_skill"], 0.5)

            # Must meet minimum or have high talent
            if skill_level < spec["min_skill"] and talent < 0.6:
                continue

            # Scoring: skill match + talent + wage + personality
            skill_score = skill_level * 0.3 + talent * 0.3
            wage_score = spec["wage"] / 2.0 * 0.2

            # Personality fit (simplified)
            personality_score = self._personality_fit(agent.personality, prof_name) * 0.2

            scores[prof_name] = skill_score + wage_score + personality_score

        if not scores:
            # Fallback: take any available low-skill job
            return random.choice(["farmer", "miner", "logistics"])

        return max(scores, key=scores.get)

    def _personality_fit(self, personality, profession: str) -> float:
        """Quick personality-profession compatibility."""
        fits = {
            "farmer": personality.conscientiousness,
            "miner": 1 - personality.neuroticism,
            "builder": personality.conscientiousness,
            "craftsman": personality.openness,
            "trader": personality.extraversion,
            "teacher": personality.agreeableness,
            "doctor": personality.conscientiousness * 0.5 + personality.agreeableness * 0.5,
            "engineer": personality.openness * 0.5 + personality.conscientiousness * 0.5,
            "logistics": 1 - personality.neuroticism,
            "factory_worker": personality.conscientiousness,
        }
        return fits.get(profession, 0.5)
