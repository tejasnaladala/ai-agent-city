"""Agent economy component — financial state, assets, and employment."""

from __future__ import annotations

from dataclasses import dataclass, replace

# Rough per-asset value estimate for net worth calculation
ESTIMATED_ASSET_VALUE: float = 100.0


@dataclass(frozen=True, slots=True)
class AgentEconomy:
    """Immutable economic state for an agent.

    Attributes:
        cash: Liquid currency units on hand.
        assets: Tuple of asset IDs (buildings, land, tools) owned.
        employer_id: ID of employing firm/institution, or None if unemployed.
        profession: Current profession name, or None.
        wage: Per-tick income from employment.
        daily_expenses: Running average of daily spending.
        savings_target: Goal amount the agent aims to save.
        debt: Outstanding debt amount.
        owned_firm_id: ID of firm the agent owns, or None.
    """

    cash: float
    assets: tuple[str, ...]
    employer_id: str | None
    profession: str | None
    wage: float
    daily_expenses: float
    savings_target: float
    debt: float
    owned_firm_id: str | None

    def __post_init__(self) -> None:
        if self.cash < 0:
            raise ValueError(f"cash cannot be negative, got {self.cash}")
        if self.debt < 0:
            raise ValueError(f"debt cannot be negative, got {self.debt}")
        if self.wage < 0:
            raise ValueError(f"wage cannot be negative, got {self.wage}")

    def net_worth(self) -> float:
        """Calculate net worth: cash + estimated asset value - debt."""
        asset_value = len(self.assets) * ESTIMATED_ASSET_VALUE
        return self.cash + asset_value - self.debt

    def can_afford(self, amount: float) -> bool:
        """Check whether the agent has enough cash for a purchase.

        Args:
            amount: The cost to check against available cash.

        Returns:
            True if cash >= amount.
        """
        return self.cash >= amount

    def add_cash(self, amount: float) -> AgentEconomy:
        """Return a new economy state with cash adjusted by ``amount``.

        Args:
            amount: Cash to add (positive) or remove (negative). The result
                is floored at zero so cash never goes negative.

        Returns:
            A new AgentEconomy with updated cash.
        """
        return replace(self, cash=max(0.0, self.cash + amount))

    def with_profession(
        self,
        profession: str,
        wage: float,
        employer_id: str | None = None,
    ) -> AgentEconomy:
        """Return a new economy state with the agent employed in a profession.

        Args:
            profession: The profession name to assign.
            wage: Per-tick income from the new role.
            employer_id: ID of the employing firm, if any.

        Returns:
            A new AgentEconomy with profession, wage, and employer set.
        """
        return replace(
            self,
            profession=profession,
            wage=wage,
            employer_id=employer_id,
        )
