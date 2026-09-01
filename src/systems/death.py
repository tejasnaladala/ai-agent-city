"""Death system — checks for agent deaths and handles inheritance. Every 100 ticks."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine.event_bus import EventBus
    from ..engine.world_state import WorldState


class DeathSystem:
    """
    Check for deaths, process inheritance, and handle population events.
    Frequency: 100 (every 100 ticks).
    """

    BASE_DEATH_RATE = 0.00001
    ELDER_MULTIPLIER = 5.0
    STARVATION_THRESHOLD = 0.05

    def __init__(self, rng: random.Random | None = None) -> None:
        self._rng = rng if rng is not None else random
        self._finalized_deaths: set[str] = set()

    def update(self, world: "WorldState", tick: int, event_bus: "EventBus") -> None:
        for agent_id in list(world.agents):
            agent = world.agents[agent_id]
            if not agent.biology.is_alive:
                self._finalize_death(agent, world, tick, event_bus)
                continue

            if self._should_die(agent):
                cause = self._determine_cause(agent)
                new_bio = agent.biology.die(cause)
                new_agent = agent.with_biology(new_bio)
                world.agents[agent_id] = new_agent
                self._finalize_death(new_agent, world, tick, event_bus)

    def _finalize_death(self, deceased, world, tick, event_bus) -> None:
        """Emit lifecycle effects once, including deaths caused by other systems."""
        from ..engine.event_bus import Event

        agent_id = deceased.identity.agent_id
        if agent_id in self._finalized_deaths:
            return
        self._finalized_deaths.add(agent_id)

        self._handle_inheritance(deceased, world, tick, event_bus)
        cause = deceased.biology.cause_of_death or self._determine_cause(deceased)
        event_bus.emit(Event(
            tick=tick,
            event_type="agent.died",
            data={
                "name": deceased.identity.name,
                "age": deceased.biology.age_ticks,
                "cause": cause,
                "generation": deceased.identity.generation,
            },
            source_agent_id=agent_id,
        ))

    def _should_die(self, agent) -> bool:
        death_prob = self.BASE_DEATH_RATE

        if agent.biology.lifecycle_stage == "elder":
            age_beyond = agent.biology.age_ticks - 16000
            death_prob *= self.ELDER_MULTIPLIER * (1 + age_beyond / 5000)

        if agent.biology.health < 0.2:
            death_prob *= 10

        if agent.needs.food < self.STARVATION_THRESHOLD:
            death_prob *= 20

        return self._rng.random() < death_prob

    def _determine_cause(self, agent) -> str:
        if agent.needs.food < self.STARVATION_THRESHOLD:
            return "starvation"
        if agent.biology.health < 0.1:
            return "illness"
        if agent.biology.lifecycle_stage == "elder":
            return "old_age"
        return "unknown"

    def _handle_inheritance(self, deceased, world, tick, event_bus) -> None:
        from ..engine.event_bus import Event

        heirs: list[str] = []
        if deceased.social.partner_id:
            partner = world.agents.get(deceased.social.partner_id)
            if partner is not None and partner.biology.is_alive:
                heirs.append(deceased.social.partner_id)
        for child_id in deceased.social.children_ids:
            if (
                child_id not in heirs
                and child_id in world.agents
                and world.agents[child_id].biology.is_alive
            ):
                heirs.append(child_id)

        if heirs and deceased.economy.cash > 0:
            share = deceased.economy.cash / len(heirs)
            for heir_id in heirs:
                heir = world.agents[heir_id]
                new_econ = heir.economy.add_cash(share)
                world.agents[heir_id] = heir.with_economy(new_econ)

                event_bus.emit(Event(
                    tick=tick,
                    event_type="agent.inherited",
                    data={"heir": heir.identity.name, "amount": share},
                    source_agent_id=heir_id,
                ))

            current = world.agents[deceased.identity.agent_id]
            world.agents[deceased.identity.agent_id] = current.with_economy(
                current.economy.add_cash(-deceased.economy.cash)
            )
