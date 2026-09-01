"""Reproducible demo: run a fixed-seed civilization and print summary metrics.

This is the script behind the numbers quoted in the README. It runs a
10,000-tick simulation with 50 founders on seed 7, then prints the event
breakdown, the final profession distribution, and population stats.

Usage:
    python -m examples.run_demo
    python -m examples.run_demo --ticks 20000 --population 80 --seed 1
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from collections import Counter


def _force_utf8_stdout() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def run(population: int, ticks: int, seed: int) -> dict:
    """Run a headless simulation and return summary metrics."""
    from src.agents.factory import create_founder_population
    from src.engine.event_bus import EventBus
    from src.engine.simulation import SimulationEngine
    from src.engine.world_state import WorldState
    from src.systems import (
        AgentCognitionSystem,
        DeathSystem,
        NeedDecaySystem,
        ProductionUpdateSystem,
        ProfessionAssignmentSystem,
        ReproductionSystem,
    )

    rng = random.Random(seed)
    world = WorldState(seed=seed)
    event_bus = EventBus()
    for agent in create_founder_population(population, tick=0, rng=rng):
        world.agents[agent.identity.agent_id] = agent

    engine = SimulationEngine(world, event_bus)
    engine.register_system("need_decay", 1, NeedDecaySystem())
    engine.register_system("cognition", 1, AgentCognitionSystem())
    engine.register_system("production", 10, ProductionUpdateSystem())
    engine.register_system(
        "profession_assignment", 100, ProfessionAssignmentSystem(rng=rng)
    )
    engine.register_system("death", 100, DeathSystem(rng=rng))
    engine.register_system("reproduction", 1000, ReproductionSystem(rng=rng))

    start = time.perf_counter()
    engine.run(ticks=ticks, target_tps=0)
    elapsed = time.perf_counter() - start

    log = event_bus.get_log()
    alive = world.get_alive_agents()
    return {
        "ticks": ticks,
        "seconds": elapsed,
        "ticks_per_second": ticks / elapsed if elapsed else 0.0,
        "events": len(log),
        "event_breakdown": Counter(ev.event_type for ev in log),
        "professions": Counter(a.economy.profession for a in alive),
        "final_population": len(alive),
        "max_generation": max((a.identity.generation for a in alive), default=0),
    }


def main() -> None:
    _force_utf8_stdout()
    parser = argparse.ArgumentParser(description="AI Agent City demo run")
    parser.add_argument("--population", type=int, default=50)
    parser.add_argument("--ticks", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    m = run(args.population, args.ticks, args.seed)

    print(f"\nseed={args.seed}  founders={args.population}  ticks={m['ticks']}")
    print(f"ran in {m['seconds']:.1f}s ({m['ticks_per_second']:.0f} ticks/sec)")
    print(f"final population: {m['final_population']}  (max generation {m['max_generation']})")
    print(f"total events: {m['events']}")

    print("\nevent breakdown (excluding tick.start/tick.end):")
    for name, count in sorted(m["event_breakdown"].items(), key=lambda kv: -kv[1]):
        if name in ("tick.start", "tick.end"):
            continue
        print(f"  {name:<20} {count}")

    print("\nprofessions held:")
    for name, count in sorted(m["professions"].items(), key=lambda kv: -kv[1]):
        display_name = name or "unassigned"
        print(f"  {display_name:<16} {count}")


if __name__ == "__main__":
    main()
