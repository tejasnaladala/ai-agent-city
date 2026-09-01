"""
AI Agent City — Main Simulation Engine

The simulation loop that orchestrates all systems each tick.
Follows the tiered update schedule from the architecture doc.
"""

from __future__ import annotations

import copy
import random
import time
from typing import Any, NoReturn

from .event_bus import Event, EventBus
from .world_state import WorldState


class SimulationSystemError(RuntimeError):
    """Raised when a registered system cannot complete its tick."""


class _BufferedEventBus(EventBus):
    """Provide the EventBus API while staging a tick's events for commit."""


class SimulationEngine:
    """
    Core simulation loop. Orchestrates all subsystems.

    Update frequencies:
    - EVERY TICK:      Agent reactive cognition, need decay, movement
    - EVERY 10 TICKS:  Agent deliberation, social interactions
    - EVERY 100 TICKS: Agent strategic thinking, market order matching,
                       economic indicators, construction progress
    - EVERY 1000 TICKS: Population updates (births/deaths), labor market
                        rebalancing, memory compaction, season changes
    """

    def __init__(self, world: WorldState, event_bus: EventBus | None = None) -> None:
        self.world = world
        self.event_bus = event_bus or EventBus()
        self._running = False
        self._systems: list[tuple[str, int, Any]] = []  # (name, frequency, system)
        self._tick_callbacks: list[Any] = []

    def register_system(self, name: str, frequency: int, system: Any) -> None:
        """
        Register a subsystem to run at a given frequency.

        Args:
            name: Human-readable system name
            frequency: Run every N ticks (1=every tick, 10=every 10 ticks, etc.)
            system: Object with an update(world, tick, event_bus) method
        """
        if isinstance(frequency, bool) or not isinstance(frequency, int) or frequency <= 0:
            raise ValueError("frequency must be a positive integer")

        snapshot = getattr(system, "snapshot_state", None)
        restore = getattr(system, "restore_state", None)
        if callable(snapshot) != callable(restore):
            raise ValueError(
                "systems must implement both snapshot_state() and restore_state(), "
                "or neither"
            )

        self._systems.append((name, frequency, system))
        self._systems.sort(key=lambda s: s[1])  # Run frequent systems first

    def on_tick(self, callback: Any) -> None:
        """Register a callback that fires after every tick."""
        self._tick_callbacks.append(callback)

    def run(self, ticks: int, target_tps: float = 10.0) -> None:
        """
        Run the simulation for a fixed number of ticks.

        Args:
            ticks: Number of ticks to simulate
            target_tps: Target ticks per second (0 = unlimited)
        """
        self._running = True
        tick_duration = 1.0 / target_tps if target_tps > 0 else 0
        start_tick = self.world.current_tick

        try:
            for _ in range(ticks):
                if not self._running:
                    break

                tick_start = time.perf_counter()
                self._run_tick()
                tick_elapsed = time.perf_counter() - tick_start

                # Rate limiting
                if tick_duration > 0 and tick_elapsed < tick_duration:
                    time.sleep(tick_duration - tick_elapsed)
        finally:
            self._running = False

        elapsed_total = self.world.current_tick - start_tick
        print(f"[Simulation] Ran {elapsed_total} ticks")

    def run_until(self, condition: Any, max_ticks: int = 1_000_000) -> int:
        """Run until a condition is met or max ticks reached."""
        self._running = True
        ticks_run = 0

        try:
            while self._running and ticks_run < max_ticks:
                self._run_tick()
                ticks_run += 1
                if condition(self.world):
                    break
        finally:
            self._running = False

        return ticks_run

    def step(self) -> None:
        """Run a single tick. Useful for debugging."""
        self._run_tick()

    def pause(self) -> None:
        """Pause the simulation."""
        self._running = False

    def _run_tick(self) -> None:
        """Execute one simulation tick."""
        tick = self.world.current_tick
        candidate_world = self._copy_world_for_tick()
        module_random_state = random.getstate()
        system_checkpoints: list[tuple[str, Any, Any]] = []
        for name, frequency, system in self._systems:
            if tick % frequency != 0:
                continue
            snapshot = getattr(system, "snapshot_state", None)
            if callable(snapshot):
                try:
                    checkpoint = snapshot()
                except Exception as error:
                    self._abort_tick(
                        tick=tick,
                        system_name=name,
                        error=error,
                        checkpoints=system_checkpoints,
                        module_random_state=module_random_state,
                        phase="checkpoint",
                    )
                system_checkpoints.append((name, system, checkpoint))
        staged_events = _BufferedEventBus()

        # Emit tick start event
        staged_events.emit(Event(
            tick=tick,
            event_type="tick.start",
            data={"population": self.world.population_count()},
        ))

        # Run all registered systems at their scheduled frequency
        for name, frequency, system in self._systems:
            if tick % frequency == 0:
                try:
                    system.update(candidate_world, tick, staged_events)
                except Exception as error:
                    self._abort_tick(
                        tick=tick,
                        system_name=name,
                        error=error,
                        checkpoints=system_checkpoints,
                        module_random_state=module_random_state,
                    )

        # Emit tick end event
        staged_events.emit(Event(
            tick=tick,
            event_type="tick.end",
            data={},
        ))

        self.world.__dict__.clear()
        self.world.__dict__.update(candidate_world.__dict__)
        self.event_bus.emit_many(staged_events.get_log())

        # Fire callbacks
        for callback in self._tick_callbacks:
            try:
                callback(self.world, tick)
            except Exception as e:
                print(f"[Simulation] Callback error at tick {tick}: {e}")

        # Advance tick
        self.world.current_tick += 1

        # Periodic memory management
        if tick % 10000 == 0 and tick > 0:
            self.event_bus.truncate_log(keep_last_n=50000)

    def _copy_world_for_tick(self) -> WorldState:
        """Create an isolated candidate using immutable entity registries."""
        candidate = copy.copy(self.world)
        candidate.agents = self.world.agents.copy()
        candidate.buildings = self.world.buildings.copy()
        candidate.firms = self.world.firms.copy()
        candidate.households = copy.deepcopy(self.world.households)
        candidate.world_map = copy.deepcopy(self.world.world_map)
        candidate.districts = self.world.districts.copy()
        candidate.ledger = copy.deepcopy(self.world.ledger)
        candidate.market = copy.deepcopy(self.world.market)
        candidate.labor_market = copy.deepcopy(self.world.labor_market)
        candidate.government = copy.deepcopy(self.world.government)
        candidate.metrics_history = copy.deepcopy(self.world.metrics_history)
        candidate.config = copy.deepcopy(self.world.config)
        return candidate

    def _restore_system_checkpoints(
        self, checkpoints: list[tuple[str, Any, Any]]
    ) -> list[dict[str, str]]:
        """Attempt every explicit checkpoint restore and report any failures."""
        failures: list[dict[str, str]] = []
        for name, system, checkpoint in reversed(checkpoints):
            try:
                system.restore_state(checkpoint)
            except Exception as error:
                failures.append({"system": name, "error": str(error)})
        return failures

    def _abort_tick(
        self,
        *,
        tick: int,
        system_name: str,
        error: Exception,
        checkpoints: list[tuple[str, Any, Any]],
        module_random_state: object,
        phase: str = "update",
    ) -> NoReturn:
        """Unwind a failed candidate tick without masking its original error."""
        rollback_errors = self._restore_system_checkpoints(checkpoints)
        random.setstate(module_random_state)
        self._running = False

        event_data: dict[str, Any] = {
            "system": system_name,
            "error": str(error),
        }
        if phase != "update":
            event_data["phase"] = phase
        if rollback_errors:
            event_data["rollback_errors"] = rollback_errors

        self.event_bus.emit(Event(
            tick=tick,
            event_type="system.error",
            data=event_data,
        ))

        action = "checkpoint failed" if phase == "checkpoint" else "failed"
        rollback_detail = ""
        if rollback_errors:
            failures = ", ".join(
                f"{item['system']}: {item['error']}" for item in rollback_errors
            )
            rollback_detail = f"; rollback failed for {failures}"

        raise SimulationSystemError(
            f"System {system_name!r} {action} at tick {tick}: "
            f"{error}{rollback_detail}"
        ) from error

    def get_stats(self) -> dict:
        """Current simulation statistics."""
        return {
            "tick": self.world.current_tick,
            "population": self.world.population_count(),
            "adults": self.world.adult_count(),
            "children": self.world.child_count(),
            "buildings": len(self.world.buildings),
            "firms": len(self.world.firms),
            "events_logged": self.event_bus.get_log_size(),
            "running": self._running,
        }
