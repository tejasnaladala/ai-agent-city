"""
Simulation subsystems — each implements update(world, tick, event_bus).
Registered with the SimulationEngine at different frequencies.
"""
from .agent_cognition import AgentCognitionSystem
from .death import DeathSystem
from .need_decay import NeedDecaySystem
from .production import ProductionUpdateSystem
from .profession_assignment import ProfessionAssignmentSystem
from .reproduction import ReproductionSystem
from .status_reporter import StatusReporterSystem

__all__ = [
    "AgentCognitionSystem",
    "DeathSystem",
    "NeedDecaySystem",
    "ProductionUpdateSystem",
    "ProfessionAssignmentSystem",
    "ReproductionSystem",
    "StatusReporterSystem",
]
