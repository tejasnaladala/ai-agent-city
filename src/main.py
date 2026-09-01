"""
AI Agent City — Main Entry Point

Bootstraps the simulation with a founding population and runs it.
"""

from __future__ import annotations

import argparse
import random
import sys
import time


def _force_utf8_stdout() -> None:
    """Make stdout/stderr UTF-8 so emoji status lines do not crash on the
    Windows console (cp1252), which raises UnicodeEncodeError by default."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def main() -> None:
    _force_utf8_stdout()

    parser = argparse.ArgumentParser(description="AI Agent City — Civilization Simulator")
    parser.add_argument("--population", type=int, default=50, help="Initial population size")
    parser.add_argument("--ticks", type=int, default=1000, help="Number of ticks to simulate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--tps", type=float, default=10.0,
                        help="Target ticks per second (0=unlimited)")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    print("\n🏙️  AI Agent City v0.1.0")
    print(f"   Seed: {args.seed}")
    print(f"   Population: {args.population}")
    print(f"   Ticks: {args.ticks}")
    print(f"   Target TPS: {args.tps}")
    print()

    from .agents.factory import create_founder_population
    from .engine.event_bus import EventBus
    from .engine.simulation import SimulationEngine
    from .engine.world_state import WorldState
    from .systems import (
        AgentCognitionSystem,
        DeathSystem,
        NeedDecaySystem,
        ProductionUpdateSystem,
        ProfessionAssignmentSystem,
        ReproductionSystem,
        StatusReporterSystem,
    )

    world = WorldState(seed=args.seed)
    event_bus = EventBus()
    founders = create_founder_population(args.population, tick=0, rng=rng)
    for agent in founders:
        world.agents[agent.identity.agent_id] = agent
    print(f"✅ Created {len(founders)} founding agents")

    engine = SimulationEngine(world, event_bus)
    engine.register_system("need_decay", 1, NeedDecaySystem())
    engine.register_system("cognition", 1, AgentCognitionSystem())
    engine.register_system("production", 10, ProductionUpdateSystem())
    engine.register_system(
        "profession_assignment", 100, ProfessionAssignmentSystem(rng=rng)
    )
    engine.register_system("death", 100, DeathSystem(rng=rng))
    engine.register_system("status_reporter", 100, StatusReporterSystem())
    engine.register_system("reproduction", 1000, ReproductionSystem(rng=rng))
    print("✅ 7 simulation systems registered")

    # Run simulation
    print("\n🚀 Starting simulation...\n")
    start_time = time.perf_counter()

    try:
        engine.run(ticks=args.ticks, target_tps=args.tps)
    except KeyboardInterrupt:
        print("\n\n⏸️  Simulation paused by user")

    elapsed = time.perf_counter() - start_time
    actual_tps = world.current_tick / elapsed if elapsed > 0 else 0

    print("\n📊 Simulation Complete")
    print(f"   Ticks: {world.current_tick}")
    print(f"   Time: {elapsed:.1f}s ({actual_tps:.1f} ticks/sec)")

    stats = engine.get_stats()
    print(f"   Population: {stats['population']}")
    print(f"   Events logged: {stats['events_logged']}")
    print()


if __name__ == "__main__":
    main()
