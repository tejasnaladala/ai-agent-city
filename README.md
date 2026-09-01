# AI Agent City

AI Agent City is a deterministic, fixed-timestep agent-based simulation prototype written
in Python. Residents have immutable component state for identity, biology, needs,
personality, skills, finances, relationships, and goals. Registered systems age residents,
decay and satisfy needs, select professions, form partnerships, create children, and record
deaths.

The current runtime uses symbolic rules. It does not call a language model, a paid API, or
any remote service. The architecture documents describe a much larger system vision; they
are not a statement that every designed subsystem is implemented or integrated.

## Verified demo

After installation, run the canonical seed:

```bash
python -m examples.run_demo
```

With Python 3.12, the event and profession counts below are deterministic. Wall-clock speed
is intentionally omitted because it depends on the machine.

```text
[Simulation] Ran 10000 ticks

seed=7  founders=50  ticks=10000
final population: 50  (max generation 0)
total events: 23464

event breakdown (excluding tick.start/tick.end):
  agent.ate                  3259
  agent.starving              104
  agent.profession_selected    50
  agent.partnered              25
  agent.born                   13
  agent.died                   13

professions held:
  doctor           10
  engineer          8
  miner             7
  factory_worker    6
  farmer            5
  logistics         4
  craftsman         4
  builder           3
  trader             2
  teacher            1
```

These numbers need careful interpretation:

- Critical food, water, and rest are restored by symbolic cognition actions. Those actions
  do not currently consume inventory or place market orders.
- A selected profession is an occupation label, not a job at a firm. The default runtime
  creates no firms, employer links, or wage transfers.
- Thirteen children are born and thirteen residents die in this run. There is no dependent
  care system yet, so no generation-one resident remains alive at tick 10,000.

The integration suite runs the same long seed twice and compares all non-timing summary
fields. Random identity generation and every stochastic lifecycle system share an isolated,
seeded random stream.

## Quickstart

Requires Python 3.12 or newer.

```bash
python -m venv .venv
python -m pip install -e ".[dev]"

# Installed console entry point
agent-city --population 50 --ticks 10000 --seed 7 --tps 0

# Deterministic headless summary
python -m examples.run_demo

# Verification
pytest
ruff check src examples tests
```

`--tps 0` runs without rate limiting. A positive value sets a target tick rate.

The core package has no third-party runtime dependencies. The `dev` extra contains the test,
coverage, and lint tools.

## Runtime architecture

`Agent` is a frozen dataclass composed of eight frozen components. Systems replace an agent
in `WorldState` rather than mutating that agent in place. `SimulationEngine` schedules systems
by tick frequency and records events through `EventBus`. A system exception emits one
`system.error` event and aborts the tick; failed simulations no longer continue with partial
state while appearing successful.

The command-line runtime registers these systems:

| System | Frequency | Current behavior |
|---|---:|---|
| Need decay | 1 | Ages residents, decays needs, and applies critical-need health loss |
| Agent cognition | 1 | Handles emergency needs, otherwise practices the selected profession or wanders |
| Production update | 10 | Processes caller-supplied firms and ledgers; inert in the default runtime |
| Profession selection | 100 | Scores profession labels from skills, talent, wage weight, and personality |
| Death | 100 | Finalizes deaths from any system, emits one death event, and transfers cash to living heirs |
| Status reporter | 100 | Prints population and aggregate health/food data in `agent-city` |
| Reproduction | 1000 | Forms compatible pairs and creates children with inherited traits |

## Component status

| Capability | Status |
|---|---|
| Fixed-timestep engine, event bus, immutable agent updates | Integrated and tested |
| Need decay, symbolic cognition, aging, death, cash inheritance | Integrated and tested |
| Profession scoring and selection | Integrated; not connected to employers or payroll |
| Partnership, birth, and trait inheritance | Integrated; dependent care is missing |
| Order-book market, double-entry ledger, labor market, indicators | Implemented as standalone modules and unit-tested; not wired into the demo |
| World map, resources, districts, construction models | Standalone modules; not wired into the demo |
| Tabular learning and replay buffer | Prototype module; not registered by the runtime and does not control actions |
| React/Three.js voxel interface | Build-checked prototype; no compatible WebSocket server ships in this tree |
| Persistence or deterministic event replay | Design only |
| Language-model cognition and GPU policy networks | Design only |
| Emergent institutions and a causally closed economy | Design only |

## Frontend prototype

The `frontend/` directory contains a Vite, React, and Three.js visualization shell. It compiles
and renders its local voxel scene, but its client expects a simulation WebSocket at
`ws://localhost:8765`, and this repository does not currently provide a compatible server.
It should not be presented as an end-to-end live visualization.

```bash
cd frontend
npm ci
npm run build
```

The committed lockfile is used by CI. The Vite toolchain is kept on a patched release and
`npm audit` is part of release verification.

## Project layout

```text
src/
  agents/      immutable agent components and symbolic cognition
  engine/      simulation scheduler, event bus, and world state
  systems/     runtime lifecycle and behavior systems
  economy/     standalone market, ledger, labor, production, and indicators
  world/       standalone map, resource, district, and construction models
examples/
  run_demo.py  deterministic headless run and summary
frontend/      buildable Three.js visualization prototype
docs/          system vision and implementation plans
tests/         unit and executable integration coverage
```

## Reproducibility and security boundary

- CI runs on Python 3.12 and Node 20, installs the frontend with `npm ci`, builds a wheel,
  installs it, and executes the console script outside the checkout.
- GitHub Actions are pinned to exact revisions, use read-only repository permissions, and do
  not persist checkout credentials.
- The Python runtime opens no sockets, reads no secrets, and makes no network requests.
- The frontend is a local development artifact, not a hardened or authenticated network
  service. Do not expose a development server to an untrusted network.

## License

MIT. See [LICENSE](LICENSE).
