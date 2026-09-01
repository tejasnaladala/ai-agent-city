"""Integration coverage for the executable simulation runtime."""

from __future__ import annotations

import inspect
import os
import random
import subprocess
import sys
from collections import Counter
from dataclasses import replace

import pytest

from examples.run_demo import run
from src.agents.agent import Agent
from src.agents.factory import create_founder_population
from src.agents.personality import AgentPersonality
from src.engine.event_bus import Event, EventBus
from src.engine.simulation import SimulationEngine
from src.engine.world_state import WorldState
from src.systems.death import DeathSystem
from src.systems.need_decay import NeedDecaySystem
from src.systems.profession_assignment import ProfessionAssignmentSystem
from src.systems.reproduction import ReproductionSystem


def _stable_summary(result: dict) -> dict:
    """Drop machine-speed measurements from a demo result."""
    return {
        "ticks": result["ticks"],
        "events": result["events"],
        "event_breakdown": Counter(result["event_breakdown"]),
        "professions": Counter(result["professions"]),
        "final_population": result["final_population"],
        "max_generation": result["max_generation"],
    }


def test_seeded_demo_is_reproducible() -> None:
    first = run(population=10, ticks=6_000, seed=7)
    second = run(population=10, ticks=6_000, seed=7)

    assert _stable_summary(first) == _stable_summary(second)


def test_founder_factory_accepts_an_isolated_random_generator() -> None:
    assert "rng" in inspect.signature(create_founder_population).parameters

    first = create_founder_population(5, rng=random.Random(7))
    second = create_founder_population(5, rng=random.Random(7))

    assert first == second


def test_system_failures_abort_the_tick_and_are_logged() -> None:
    class BrokenSystem:
        def update(self, world: WorldState, tick: int, event_bus: EventBus) -> None:
            raise ValueError("broken on purpose")

    event_bus = EventBus()
    engine = SimulationEngine(WorldState(seed=7), event_bus)
    engine.register_system("broken", 1, BrokenSystem())

    with pytest.raises(RuntimeError, match="broken.*tick 0"):
        engine.step()

    errors = event_bus.get_log(event_type="system.error")
    assert len(errors) == 1
    assert errors[0].data == {"system": "broken", "error": "broken on purpose"}
    assert engine.world.current_tick == 0


def test_failed_tick_rolls_back_state_events_rng_and_stops_the_engine() -> None:
    class MutatingSystem:
        def __init__(self) -> None:
            self.rng = random.Random(7)
            self.draws: list[float] = []

        def update(self, world: WorldState, tick: int, event_bus: EventBus) -> None:
            world.config["partial"] = True
            self.draws.append(self.rng.random())
            event_bus.emit(Event(tick=tick, event_type="domain.partial", data={}))

    class BrokenSystem:
        def update(self, world: WorldState, tick: int, event_bus: EventBus) -> None:
            raise ValueError("broken after mutation")

    mutating = MutatingSystem()
    event_bus = EventBus()
    engine = SimulationEngine(WorldState(seed=7), event_bus)
    engine.register_system("mutating", 1, mutating)
    engine.register_system("broken", 1, BrokenSystem())

    with pytest.raises(RuntimeError, match="broken.*tick 0"):
        engine.run(ticks=1, target_tps=0)

    assert engine.world.config == {}
    assert engine.world.current_tick == 0
    assert mutating.draws == []
    assert mutating.rng.random() == pytest.approx(random.Random(7).random())
    assert [event.event_type for event in event_bus.get_log()] == ["system.error"]
    assert engine.get_stats()["running"] is False


def test_need_decay_deaths_are_reported_exactly_once() -> None:
    agent = create_founder_population(1, rng=random.Random(7))[0]
    agent = agent.with_needs(agent.needs.satisfy("food", -agent.needs.food))
    agent = agent.with_biology(agent.biology.with_health(0.001))
    world = WorldState(seed=7, agents={agent.identity.agent_id: agent})
    event_bus = EventBus()

    NeedDecaySystem().update(world, tick=1, event_bus=event_bus)
    assert world.agents[agent.identity.agent_id].biology.is_alive is False

    death_system = DeathSystem(rng=random.Random(7))
    death_system.update(world, tick=100, event_bus=event_bus)
    death_system.update(world, tick=200, event_bus=event_bus)

    deaths = event_bus.get_log(event_type="agent.died")
    assert len(deaths) == 1
    assert deaths[0].source_agent_id == agent.identity.agent_id
    assert deaths[0].data["cause"] == "starvation"


def test_inheritance_moves_cash_out_of_the_deceased_estate() -> None:
    deceased, heir = create_founder_population(2, rng=random.Random(11))
    deceased = deceased.with_social(
        deceased.social.with_partner(heir.identity.agent_id)
    )
    deceased = deceased.with_economy(
        deceased.economy.add_cash(-deceased.economy.cash).add_cash(100)
    )
    deceased = deceased.with_biology(deceased.biology.die("illness"))
    heir_starting_cash = heir.economy.cash
    world = WorldState(
        seed=11,
        agents={
            deceased.identity.agent_id: deceased,
            heir.identity.agent_id: heir,
        },
    )
    event_bus = EventBus()

    death_system = DeathSystem(rng=random.Random(11))
    death_system.update(world, tick=100, event_bus=event_bus)
    death_system.update(world, tick=200, event_bus=event_bus)

    assert world.agents[heir.identity.agent_id].economy.cash == pytest.approx(
        heir_starting_cash + 100
    )
    assert world.agents[deceased.identity.agent_id].economy.cash == 0
    assert len(event_bus.get_log(event_type="agent.inherited")) == 1


def test_chained_deaths_conserve_cash_in_the_same_update() -> None:
    class ChainedDeathSystem(DeathSystem):
        def __init__(self, doomed_ids: set[str]) -> None:
            super().__init__(rng=random.Random(17))
            self._doomed_ids = doomed_ids

        def _should_die(self, agent) -> bool:
            return agent.identity.agent_id in self._doomed_ids

    first, second, heir = create_founder_population(3, rng=random.Random(17))
    first = first.with_social(first.social.with_partner(second.identity.agent_id))
    second = second.with_social(second.social.with_partner(heir.identity.agent_id))
    first = first.with_economy(
        first.economy.add_cash(-first.economy.cash).add_cash(100)
    )
    second = second.with_economy(
        second.economy.add_cash(-second.economy.cash).add_cash(10)
    )
    heir = heir.with_economy(heir.economy.add_cash(-heir.economy.cash))
    world = WorldState(
        seed=17,
        agents={agent.identity.agent_id: agent for agent in (first, second, heir)},
    )

    ChainedDeathSystem(
        {first.identity.agent_id, second.identity.agent_id}
    ).update(world, tick=100, event_bus=EventBus())

    balances = [agent.economy.cash for agent in world.agents.values()]
    assert sum(balances) == pytest.approx(110)
    assert world.agents[first.identity.agent_id].economy.cash == 0
    assert world.agents[second.identity.agent_id].economy.cash == 0
    assert world.agents[heir.identity.agent_id].economy.cash == pytest.approx(110)


def test_reproduction_requires_both_partners_to_be_eligible() -> None:
    class CertainReproductionSystem(ReproductionSystem):
        def _should_reproduce(self, parent_a, parent_b, world) -> bool:
            return True

    eligible, capped = create_founder_population(2, rng=random.Random(19))
    eligible = replace(
        eligible,
        identity=replace(eligible.identity, agent_id="a-eligible"),
        biology=replace(
            eligible.biology,
            age_ticks=6000,
            lifecycle_stage="adult",
            fertility=1.0,
        ),
        social=replace(
            eligible.social,
            partner_id="z-capped",
            children_ids=(),
        ),
    )
    capped = replace(
        capped,
        identity=replace(capped.identity, agent_id="z-capped"),
        biology=replace(
            capped.biology,
            age_ticks=6000,
            lifecycle_stage="adult",
            fertility=1.0,
        ),
        social=replace(
            capped.social,
            partner_id="a-eligible",
            children_ids=("child-1", "child-2", "child-3", "child-4"),
        ),
    )
    world = WorldState(
        seed=19,
        agents={eligible.identity.agent_id: eligible, capped.identity.agent_id: capped},
    )
    event_bus = EventBus()

    CertainReproductionSystem(rng=random.Random(19)).update(
        world, tick=1000, event_bus=event_bus
    )

    assert set(world.agents) == {"a-eligible", "z-capped"}
    assert event_bus.get_log(event_type="agent.born") == []


def test_founder_constructor_accepts_an_isolated_random_generator() -> None:
    assert "rng" in inspect.signature(Agent.create_founder).parameters
    personality = AgentPersonality.random(random.Random(23))

    first = Agent.create_founder(
        "Ada", {"engineering": 0.9}, personality, rng=random.Random(23)
    )
    second = Agent.create_founder(
        "Ada", {"engineering": 0.9}, personality, rng=random.Random(23)
    )

    assert first == second


def test_profession_choice_does_not_claim_employment_without_an_employer() -> None:
    agent = create_founder_population(1, rng=random.Random(13))[0]
    world = WorldState(seed=13, agents={agent.identity.agent_id: agent})
    event_bus = EventBus()

    ProfessionAssignmentSystem(rng=random.Random(13)).update(
        world, tick=0, event_bus=event_bus
    )

    updated = world.agents[agent.identity.agent_id]
    assert updated.economy.profession is not None
    assert updated.economy.employer_id is None
    assert len(event_bus.get_log(event_type="agent.profession_selected")) == 1
    assert event_bus.get_log(event_type="agent.employed") == []


def test_installed_module_runs_outside_the_checkout(tmp_path) -> None:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)

    result = subprocess.run(
        [
            sys.executable,
            "-I",
            "-m",
            "src.main",
            "--population",
            "1",
            "--ticks",
            "0",
            "--seed",
            "7",
            "--tps",
            "0",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "Created 1 founding agents" in result.stdout
    assert "Map:" not in result.stdout

    help_result = subprocess.run(
        [sys.executable, "-I", "-m", "src.main", "--help"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert help_result.returncode == 0, help_result.stderr
    assert "--map-size" not in help_result.stdout
    assert "--verbose" not in help_result.stdout
