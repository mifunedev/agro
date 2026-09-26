---
name: architect
description: |
  Decide what the system should become before /prd writes an implementation
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

Decide the target architecture of the repository before `/prd` writes the implementation
plan. This skill decides the architecture. This skill does not implement the
architecture.

Arguments received: `$ARGUMENTS`

## Execution model

Run `/architect` **inline in the active coding-agent session**. The session that
invoked `/architect` keeps ownership of the work. That session also keeps
ownership of every step that follows the work.

- Do not fork the context.
- Do not launch another coding-agent process.
- Do not open a tmux session or a Herdr session.
- Do not hand the decision to a separate persistent identity.
- Do not create an `architect` agent definition. This skill is the role. The
  session that reads this skill is the runtime.
- Use `/delegate` only for bounded, self-contained fan-out. One example is a
  set of parallel, independent source reads. The verbose output of those reads
  must stay out of the context of this session. This session reconciles every delegated result. This
  session writes the brief.

Roles are behavior. Skills encode behavior. Agents execute behavior. Open a
second agent context only when the task needs isolation or parallelism as the
direct result.

## 1. Classify

Run an architecture review only for a selected change, not as a ritual for
every change. Classify the change as **ARCHITECTURAL** when the change
materially affects one or more of these surfaces:

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

If the change affects none of these surfaces, classify the change as
**NOT-ARCHITECTURAL**. Then do these steps:

1. State the classification in two or three sentences.
2. Name the reason.
3. Route the work directly to `/prd`.
4. Stop.

Do not produce the full brief for a small local change.

## 2. Ground the decision

Read real sources before you reason. Treat synthesized recall as advice only.
Treat current source and accepted decision records as the authority.

1. Read every applicable `AGENTS.md` from the repository root down to each
   directory that the change touches. When two files conflict, the file closer
   to the target path wins. Inside one directory, `AGENTS.md` is the canonical
   file.
2. Read the RFC/ADR index at `docs/rfcs/README.md`. Read each listed proposal
   that already constrains this decision. An accepted decision stays a
   constraint until a new proposal supersedes the accepted decision.
3. If tracked repository knowledge is available, run
   `/wiki query <subsystem> --patterns`. The query returns failure modes that
   this harness already paid for. Cite each `[[pattern-...]]` slug that
   changed the recommendation.
4. Read the authoritative code, tests, probes, and docs for each surface in
   scope. Do not infer the shape of a surface.
5. Name the actual decision or decisions. A restated feature request is not a
   decision.
6. Label every claim as fact, constraint, assumption, or judgment. Mark each
   unverified assumption as unverified.

## 3. Decide

For each material decision, answer each of these items:

- **Current state** — what exists now, cited by path.
- **Drivers** — the outcome that the operator wants, and the reason for the
  change now.
- **Invariants** — what must survive the change unchanged.
- **Options** — include reuse, extend, retire, and do-nothing when each one is
  a real option. A brief with one option is not an analysis.
- **Tradeoffs** — complexity, reversibility, portability, security,
  operability, context cost, migration risk.
- **Interaction** — how the option meets existing accepted decisions.
- **Failure modes** — how the option breaks, and how the operator rolls the
  option back.
- **Retirement** — what the option consolidates or deletes instead of adding a
  new part next to the old part.
- **Falsification** — the evidence that shows the recommendation to be wrong.

Choose the smallest architecture that satisfies the actual requirement. Do not
add an orchestration layer or a process layer without evidence that the layer
improves outcomes. Delete an existing abstraction instead of adding a second
abstraction next to the first abstraction.

## 4. Record durable decisions

Record each durable architecture decision with the existing convention in
[`docs/rfcs/README.md`](../../../docs/rfcs/README.md). The convention has three
parts:

- a GitHub issue titled `ADR: <title>` or `RFC: <title>`;
- a status that moves through `Draft` → `Accepted` → `Superseded`;
- an entry in the index on that page.

Do not invent an architecture database, a service, a document taxonomy, a
decision directory, or a per-skill decision store. Do not require a record for
every change. For most decisions, the code and the probes of the code hold
enough record. Propose a record only when the decision is architecturally
significant and expensive to rediscover.

## 5. Output

Return exactly one compact brief. If the classification is
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

`/architect` decides the architecture. `/prd` turns the accepted direction into
a plan. `/delegate` executes the plan. No skill in this chain requires a run of
another skill first. A `NOT-ARCHITECTURAL` change goes directly to `/prd`. A
brief that ends in a rejected option produces no plan.
