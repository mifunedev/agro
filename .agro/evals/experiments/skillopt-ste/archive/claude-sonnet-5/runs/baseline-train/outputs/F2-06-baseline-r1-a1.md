---
name: architect
description: |
  Decide what the software becomes before /prd writes an implementation
  plan. Runs inline in the active coding-agent session, grounds every claim in
  current repository sources, and returns one Architecture Brief.
  TRIGGER when: a change alters module/system boundaries, the execution or
  ownership model, persistent state, a security or isolation boundary, a public
  API or compatibility contract, a lifecycle/state machine, provider
  portability, shared vocabulary, cross-skill control-plane behavior, a new
  reusable abstraction, the retirement of an existing one, or any structural
  decision that is expensive to reverse; asked to "design this", "what should
  the architecture be", "is this architecturally significant", "ADR for X",
  before /prd on a structural change.
  Do NOT trigger for ordinary local changes — a bug fix, a copy edit, a new
  test, a contained refactor inside one module.
argument-hint: "<problem | issue number | plan path>"
allowed-tools: Read, Glob, Grep, Bash
---

# Architect

This skill determines what the software becomes before `/prd` writes the
implementation plan. This skill decides architecture. This skill does not
implement the decision.

Arguments received: `$ARGUMENTS`

## Execution model

Run **inline in the active coding-agent session**. The session that invoked
`/architect` keeps ownership of the work and of everything that follows it.

- Do not fork the context, launch another coding-agent process, open a tmux or
  Herdr session, or hand the decision to a separate persistent identity.
- Do not create an `architect` agent definition. The role is this skill; the
  runtime is the session already reading it.
- Use `/delegate` only for bounded, self-contained fan-out — parallel
  independent source reads whose verbose output should stay out of this
  context. This session reconciles every delegated result and writes the
  brief.

Roles are behavior, skills encode behavior, and agents execute behavior. A
second agent context earns its cost only when the change buys isolation or
parallelism.

## 1. Classify

Architecture review is selective, not ceremony. Treat the change as
**ARCHITECTURAL** when it materially affects one or more of:

- system or module boundaries;
- the execution or ownership model;
- persistent state or the data model;
- a security or isolation boundary;
- a public API or compatibility contract;
- a lifecycle or state machine;
- provider portability;
- shared conceptual vocabulary;
- cross-skill or control-plane behavior;
- a new reusable abstraction;
- the replacement or retirement of an existing abstraction;
- a structural decision that is difficult or expensive to reverse.

Otherwise the change is **NOT-ARCHITECTURAL**. Say so in two or three
sentences, name the reason, route the work straight to `/prd`, and stop.
Do not produce the full brief for a small local change.

## 2. Ground the decision

Before reasoning, read real sources. Synthesized recall is advisory; current
source and accepted decision records are authority.

1. Read every applicable `AGENTS.md` from the repository root down to the
   directories the change touches. Local instructions win; in one directory
   `AGENTS.md` is canonical.
2. Read the RFC/ADR index at `docs/rfcs/README.md` and any listed proposal that
   already constrains this decision. An accepted decision is a constraint until
   a new proposal supersedes it.
3. When the repository has tracked knowledge, run
   `/wiki query <subsystem> --patterns`. The command returns failure modes
   this harness has already paid for. Cite the `[[pattern-...]]` slugs that
   changed the recommendation.
4. Inspect the authoritative code, tests, probes, and docs for the surfaces in
   scope. Read the sources directly. Do not infer the shape of a source you
   have not read.
5. Name the actual decision or decisions. A feature request restated is not a
   decision.
6. Label every claim as fact, constraint, assumption, or judgment. An
   unverified assumption must say so.

## 3. Decide

For each material decision, work through:

- **Current state** — what exists now, cited by path.
- **Drivers** — the outcome wanted and why now.
- **Invariants** — what must survive the change untouched.
- **Options** — including reuse, extend, retire, and do-nothing where those are
  live. A single-option brief is not an analysis.
- **Tradeoffs** — complexity, reversibility, portability, security,
  operability, context cost, migration risk.
- **Interaction** — how the option meets existing accepted decisions.
- **Failure modes** — how it breaks, and how it rolls back.
- **Retirement** — what this consolidates or deletes rather than adds beside.
- **Falsification** — the evidence that would show the recommendation wrong.

Favor the smallest architecture that satisfies the actual requirement. Do not
add an orchestration or process layer without evidence it improves outcomes.
Prefer deleting an abstraction to growing a second one next to it.

## 4. Record durable decisions

Durable architecture decisions reuse the existing convention in
[`docs/rfcs/README.md`](../../../docs/rfcs/README.md): a GitHub issue titled
`ADR: <title>` (or `RFC: <title>`), moving through `Draft` → `Accepted` →
`Superseded`, indexed on that page.

Do not invent an architecture database, service, document taxonomy, decision
directory, or per-skill decision store. Do not require a record for every
change. The code and its probes capture most decisions well enough.
Propose a record only when the decision is architecturally significant and
expensive to rediscover.

## 5. Output

Return exactly one compact brief. When the classification is
`NOT-ARCHITECTURAL`, return only the classification, the reason, and the
routing sentence.

```markdown
## Architecture Brief

### Classification
ARCHITECTURAL | NOT-ARCHITECTURAL

### Current State
...

### Decision Drivers
- ...

### Invariants
- ...

### Options Considered
1. ...
2. ...
3. ...

### Recommendation
...

### Tradeoffs / Consequences
- ...

### Retirement / Consolidation
- ...

### Migration / Sequencing
- ...

### Validation
- evidence or PoC needed before/after implementation

### Non-Goals
- ...

### Decision Record
NONE | UPDATE <issue/RFC/ADR> | PROPOSE ADR: <title>
```

## Boundaries

| In scope | Out of scope |
|---|---|
| Naming the decision and the options | Writing the implementation |
| Recommending one option with tradeoffs | Opening branches, worktrees, or PRs |
| Pointing a durable decision at an RFC/ADR issue | Creating a new decision store |
| Handing the accepted direction to `/prd` | Owning the build |

`/architect` decides architecture. `/prd` turns the accepted direction into a
plan, and `/delegate` executes it. Neither is a mandatory phase for the other: a
`NOT-ARCHITECTURAL` change goes straight to `/prd`, and a brief that ends
in a rejected option produces no plan at all.
