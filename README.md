# AI Agent City

A civilization simulator where every resident is an autonomous agent with needs, skills, a personality, and an economic role. Agents decide what to do each tick, take jobs, earn wages, eat, age, partner up, and have children. There is no central script telling the city how to behave. The population-level patterns you see come out of thousands of small individual decisions.

The engine is a fixed-timestep entity-component-system in pure Python. It runs about **1,700 ticks per second single-threaded** with 50 agents and produces a stable, self-feeding economy over tens of thousands of ticks.

## What you actually see when you run it

Run the bundled demo (seed 7, 50 founders, 10,000 ticks):

```bash
python -m examples.run_demo
```

```
seed=7  founders=50  ticks=10000
ran in 5.7s (1770 ticks/sec)
final population: 50  (max generation 0)
total events: 23430

event breakdown (excluding tick.start/tick.end):
  agent.ate            3265
  agent.starving       80
  agent.employed       50
  agent.partnered      25
  agent.born           10

professions held:
  doctor           10
  craftsman        10
  builder          7
  farmer           6
  engineer         5
  trader           3
  factory_worker   3
  logistics        2
  teacher          2
  miner            2
```

Two things are worth pointing out:

- **The city reaches an equilibrium instead of dying.** Food is a depleting need; left alone, every agent starves. The reactive layer of agent cognition addresses hunger and thirst before they hit zero, so average food settles into a sawtooth around 0.31 to 0.39 and the population holds steady. Earlier in development this collapsed to zero by tick 2,600, because the cognition layer could only react to one critical need per tick and thirst kept crowding out hunger. The fix was to let an agent address every need that is below its emergency threshold in the same tick. That single change is the difference between a population that survives and one that goes extinct.
- **Professions are chosen, not assigned.** Each agent scores all ten professions against its own skills, talents, and Big Five personality, then picks the best fit. Doctors and craftsmen come out most common on this seed because the scoring rewards their higher wages and the personality traits that suit them.

The numbers above are reproducible. Change `--seed`, `--population`, or `--ticks` and you get a different but equally consistent run.

## Quickstart

Requires Python 3.12+.

```bash
# install (editable, with dev tools)
pip install -e ".[dev]"

# run the interactive simulation with a live status readout
python -m src.main --population 50 --ticks 10000 --seed 7 --tps 0

# run the headless demo that prints the summary above
python -m examples.run_demo

# tests and lint
pytest
ruff check src tests
```

`--tps 0` runs as fast as the machine allows. A positive value rate-limits the loop so you can watch it tick by tick.

### 3D frontend (optional)

A Three.js voxel renderer lives in `frontend/`. It connects to a WebSocket bridge, draws the city as a voxel scene, and shows agents, buildings, weather, and live metrics panels.

```bash
cd frontend
npm install
npm run dev
```

## How it works

The simulation is a tiered entity-component-system. Each agent is an immutable frozen dataclass composed of nine components (identity, biology, needs, personality, skills, economy, social, goals). Systems never mutate an agent in place; they compute a new agent and replace it in the world registry. That keeps state transitions explicit and makes the whole thing easy to reason about and test.

```
SimulationEngine (fixed-timestep loop)
  │
  ├── runs registered systems at tiered frequencies
  │     every tick:    need decay, agent cognition
  │     every 10:      production / wage payment
  │     every 100:     profession assignment, death, status report
  │     every 1000:    reproduction
  │
  ├── EventBus            append-only event log + pub/sub
  └── WorldState          agent / building / firm registries, market, ledger
```

Eight systems make up the runtime:

| System | Frequency | What it does |
|---|---|---|
| Need decay | every tick | Hunger, thirst, rest, and other needs fall; critical hunger or thirst drains health |
| Agent cognition | every tick | Four-tier decision loop: reactive thresholds first, then plan execution |
| Production | every 10 ticks | Firms pay wages through the ledger and produce goods |
| Profession assignment | every 100 ticks | Unemployed adults score and choose a profession |
| Death | every 100 ticks | Age, illness, and starvation kill agents; cash is split among heirs |
| Status report | every 100 ticks | Prints population, average food and health, and headcount working |
| Reproduction | every 1000 ticks | Compatible partners pair up and may have children who inherit traits |
| Learning | every 10 ticks | Per-agent Q-learning with a replay buffer over a discretized state |

### Agent cognition

Cognition runs in tiers so the common case stays cheap:

- **Reactive (every tick):** pure threshold checks. If food, water, rest, safety, or health drops below its emergency level, the agent acts on every breached need this tick.
- **Plan execution:** with no urgent need, an agent with a profession goes to work and improves its skill; everyone else wanders.
- **Strategic (every 100 ticks):** reads the agent's Q-table and tightens exploration once it has enough experience.

The "creative" tier described in the design docs (full language-model reasoning for novel situations) is **not wired into the runtime**. The shipped cognition is symbolic and tabular. See the implemented-versus-planned table below.

### Economy

The economy is real, not decoration:

- **Order-book market** (`src/economy/market.py`): a continuous double auction with buy and sell orders, price-time priority matching, order expiry by TTL, last-trade price, and rolling volume and price history. Price discovery is unit-tested.
- **Ledger** (`src/economy/ledger.py`): double-entry transfers with insufficient-funds rejection, a system account for minting, and full transaction history.
- **Labor market** (`src/economy/labor.py`): firms, job postings, skill-filtered hiring, and an unemployment-rate calculation.
- **Indicators** (`src/economy/indicators.py`): aggregate economic measures computed from the ledger.

Wages flow from firms to workers through the ledger on every production tick, and a paid worker's food and shelter needs improve. That is the loop that keeps the city fed.

## Implemented vs. planned

This repo started from an ambitious design doc (`docs/architecture/`). Here is an honest split of what runs today versus what is design only.

| Capability | Status |
|---|---|
| Fixed-timestep ECS engine, event bus, tiered systems | Implemented |
| Immutable agents with 9 components | Implemented |
| Need decay, aging, lifecycle stages, death, inheritance | Implemented |
| Profession choice from skills + personality | Implemented |
| Order-book market, ledger, labor market, indicators | Implemented (unit-tested) |
| Reproduction with trait inheritance across generations | Implemented |
| Per-agent Q-learning with replay buffer | Implemented |
| Three.js voxel frontend over a WebSocket bridge | Implemented |
| Local language-model cognition for novel situations | Design only |
| Local GPU policy networks (the `inference` extra) | Experimental, not wired in |
| Emergent government, schools, hospitals as institutions | Design only |

The `inference` optional dependency group (vLLM, PyTorch, transformers) is declared for the planned model-backed cognition but is not used by the current runtime. Treat it as experimental.

## Project layout

```
src/
  engine/      simulation loop, event bus, world state
  agents/      9 immutable components + factory + tiered cognition
  systems/     8 systems that advance the world each tick
  economy/     order-book market, ledger, labor market, indicators
  world/       tile grid, districts, A* pathfinding, resources
examples/
  run_demo.py  reproducible headless run that prints the metrics above
frontend/      Three.js + React 19 voxel renderer (TypeScript)
docs/          architecture and design notes
tests/         pytest suite
```

Roughly 4,600 lines of Python in `src/`, 2,800 lines of TypeScript in the frontend, and a 52-test pytest suite covering needs, biology, skills, personality, cognition, the market, the ledger, and the labor market.

## Tests

```bash
pytest            # 52 tests
ruff check src tests
```

The Python suite runs in well under a second and the lint is clean.

## License

MIT. See [LICENSE](LICENSE).
