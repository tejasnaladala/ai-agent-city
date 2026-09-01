# AI Agent City — Executive Summary & System Vision

> **Scope note:** This is a design vision, not a description of the current executable
> runtime. See the repository README for verified implementation status and known gaps.

## What AI Agent City Is

AI Agent City is a **persistent autonomous civilization simulator** where every resident
is an AI agent with memory, goals, needs, skills, relationships, and an economic role.
Agents don't follow scripts — they make decisions, form families, start businesses,
build infrastructure, learn from experience, and collectively grow a settlement from
primitive beginnings into a complex civilization.

The simulation runs on **local compute** using small language models and learned policy
networks, not cloud API calls. It produces emergent macro-scale phenomena (economic
cycles, class stratification, urban sprawl, labor shortages, institutional evolution)
from micro-scale agent decisions.

## What Makes It Non-Trivial

The design goal is causal economics rather than scripted behavior. A few properties
distinguish it from common alternatives:

- Agents carry memory and adaptive goals instead of fixed behavior trees.
- Need satisfaction is not scripted; it flows from a labor market with price discovery.
- An agent's work has consequences. A farmer who does not farm contributes to food scarcity.
- Lives are persistent across time, with births, deaths, and trait inheritance.
- Resource scarcity, price signals, and a labor market are part of the simulation substrate, not cosmetic.

## Core Properties

1. **Causal Economy**: Every resource is produced, transported, consumed, and priced.
   No infinite spawning. Scarcity drives behavior.

2. **Persistent Lifecycle**: Agents are born, learn, work, age, reproduce, and die.
   Knowledge transfers across generations. Population dynamics are endogenous.

3. **Emergent Institutions**: Government, markets, schools, hospitals emerge from
   agent coordination needs, not from hardcoded game mechanics.

4. **Local Learning**: Agents improve through experience using local GPU compute —
   not just prompt engineering. Skills get better with practice.

5. **Multi-Scale Dynamics**: Individual decisions (take job, buy food, have child)
   aggregate into civilization-scale phenomena (urbanization, inequality, technological
   progress) without top-down scripting.

## Design Philosophy

- **Simulation-first, AI-second**: The world runs as a discrete-event simulation with
  real physics (resources, construction time, distance). AI provides the decision-making
  layer, not the world engine.

- **Cheap cognition, expensive actions**: Thinking (LLM inference) happens selectively.
  Most agent behavior uses fast learned policies. Full LLM reasoning triggers only for
  novel situations, social interaction, and planning.

- **Bottom-up emergence**: No global scripts for "create a market" or "start a government."
  These emerge when agents need coordination mechanisms.

- **Falsifiable economics**: The economy must produce recognizable phenomena —
  supply/demand curves, unemployment, inflation, business cycles — or the simulation
  is wrong, not "creative."
