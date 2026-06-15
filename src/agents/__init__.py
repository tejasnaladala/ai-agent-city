"""Agent components — the ECS pieces composed into a single Agent entity."""

from .agent import Agent
from .biology import AgentBiology
from .cognition import AgentCognition
from .economy import AgentEconomy
from .goals import AgentGoals, Goal, Plan, PlanStep
from .identity import AgentIdentity
from .needs import AgentNeeds
from .personality import AgentPersonality
from .skills import AgentSkills, SkillSystem
from .social import AgentSocial

__all__ = [
    "Agent",
    "AgentBiology",
    "AgentCognition",
    "AgentEconomy",
    "AgentGoals",
    "Goal",
    "Plan",
    "PlanStep",
    "AgentIdentity",
    "AgentNeeds",
    "AgentPersonality",
    "AgentSkills",
    "SkillSystem",
    "AgentSocial",
]
