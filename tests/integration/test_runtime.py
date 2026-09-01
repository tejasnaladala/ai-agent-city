"""Integration coverage for the executable simulation runtime."""

from __future__ import annotations

import inspect
import os
import random
import subprocess
import sys
from collections import Counter

import pytest

from examples.run_demo import run
from src.agents.factory import create_founder_population
from src.engine.event_bus import EventBus
from src.engine.simulation import SimulationEngine
from src.engine.world_state import WorldState
from src.systems.death import DeathSystem
from src.systems.need_decay import NeedDecaySystem
from src.systems.profession_assignment import ProfessionAssignmentSystem


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
