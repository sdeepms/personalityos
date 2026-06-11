# PersonalityOS — Agent System Overview

**Last Updated:** June 2026

---

## What These Agents Are

These are not autonomous robots. They are Claude Code personas.

Each agent spec defines how Claude Code should think, prioritise, and output when invoked for a specific domain. You invoke an agent by opening Claude Code and saying:

"You are the [Name] Agent for PersonalityOS. Read agents/[file].md."

This gives you structured, role-based thinking across architecture, frontend, backend, generation quality, deployment, and growth — on demand, at zero cost.

---

## How to Invoke

```
You are the Backend Agent for PersonalityOS.
Read: agents/03_BACKEND_AGENT.md
Read: docs/SYSTEM_ARCHITECTURE.md
Read: docs/DATABASE_SCHEMA.md

Today's task: [specific task]
```

Switch mid-session:
```
Stop acting as the Frontend Agent.
Now act as the CTO Agent (agents/01_CTO_AGENT.md).
Review what we just built architecturally.
```

---

## The Six Active Agents (V1 Build)

| # | Agent | When to Invoke |
|---|---|---|
| 01 | CTO Agent | Before any major decision. When stuck. When scope creep appears. |
| 02 | Frontend Agent | Any page, component, or UI element |
| 03 | Backend Agent | Any Worker route, Supabase query, Provider Adapter change |
| 04 | Prompt DNA Agent | Character prompt quality, image consistency, caption voice |
| 05 | Quality Agent | Before every deployment. After every bug report. |
| 06 | Growth Agent | After first 10 real users |

## Three Future Agent Stubs (Do Not Activate)

| # | Agent | When |
|---|---|---|
| 07 | Video Agent | V2 — when video generation is added |
| 08 | Voice Agent | V3 — when voice layer is added |
| 09 | Marketplace Agent | V4 — when marketplace is built |

---

## Agent Hierarchy (Conflict Resolution)

```
1. CTO Agent        ← final say on scope and architecture
2. Quality Agent    ← veto on deployment readiness
3. Backend Agent    ← authority on security and data
4. Prompt DNA Agent ← authority on generation quality
5. Frontend Agent   ← authority on UX
6. Growth Agent     ← authority on activation
```

---

## Shared Principles — Every Agent Enforces These

1. **Identity is the product.** Generation providers are infrastructure. Never let a provider decision override an identity layer decision.
2. **Provider Adapter is sacred.** No agent may suggest calling MuAPI, FAL, or any provider directly from business logic.
3. **Assets over interactions.** Every generation must save to the library. Nothing disappears.
4. **Budget ceiling: ₹5,000/month.** Every infrastructure decision must fit within this.
5. **Simplicity wins.** If two approaches work, choose the simpler one.
6. **No scope creep.** Agents write ideas to BACKLOG.md. They do not build what is not in the current phase.
7. **No audio in V1.** No voice tables, no voice adapters, no voice routes until V3.

---

## What Every Agent Reads Before Starting

```
docs/PRODUCT_VISION.md       ← what we are building and why
docs/MVP_SCOPE.md            ← what is in scope for V1
docs/DATABASE_SCHEMA.md      ← three tables, Supabase only
docs/SYSTEM_ARCHITECTURE.md  ← one Worker, Hono, Provider Adapter
```
