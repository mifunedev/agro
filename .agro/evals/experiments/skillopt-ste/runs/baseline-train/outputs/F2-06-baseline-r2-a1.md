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

Decide the target architecture before `/prd` writes the implementation plan.
This skill decides architecture. This skill does not implement the change.

Arguments received: `$ARGUMENTS`

## Execution model

Run the `/architect` skill **inline in the active coding-agent session**. The session that
invokes `/architect` keeps ownership of the work. The invoking session also
owns every step that follows the brief.

- Do not fork the context.
- Do not launch another coding-agent process.
- Do not open a tmux session or a Herdr session.
- Do not hand the decision to a separate persistent identity.
- Do not create an `architect` agent definition. This skill holds the role. The
  session that reads this skill runs the role.
- Use `/delegate` only for bounded, self-contained fan-out. One example of
  bounded fan-out is a set of parallel, independent source reads. The verbose
  output of those reads must stay out of the invoking session's context.
- Reconcile every delegated result in the invoking session. The invoking
  session writes the brief.

A role is a behavior. A skill encodes a behavior. An agent executes a behavior.
Open a second agent context only when you need isolation or parallelism as the
result itself.

## 1. Classify

Run architecture review only for a qualifying change. Architecture review is
not a ceremony for every change. Classify the change as **ARCHITECTURAL** when
the change materially affects one or more of these surfaces:

- system or module boundaries;
- the execution model or the ownership model;
- persistent state or the data model;
- a security boundary or an isolation boundary;
- a public API or a compatibility contract;
- a lifecycle or a state machine;
- provider portability;
- shared conceptual vocabulary;
- cross-skill behavior or control-plane behavior;
- a new reusable abstraction;
- the replacement or retirement of an existing abstraction;
- a structural decision that costs much time or effort to reverse.

If the change affects none of these surfaces, classify the change as
**NOT-ARCHITECTURAL**. Then do these steps:

1. State the classification in two or three sentences.
2. Name the reason.
3. Route the work directly to `/prd`.
4. Stop.

Do not produce the full brief for a small local change.

## 2. Ground the decision

Read real sources before you reason about the change. Treat synthesized recall
as advice only. Treat current source and accepted decision records as the
authority.

1. Read every applicable `AGENTS.md` file. Start at the repository root. Stop at
   each directory that the change touches. If two files conflict, the file
   nearer to the target path wins. Inside one directory, `AGENTS.md` is the
   canonical context file.
2. Read the RFC/ADR index at `docs/rfcs/README.md`. Read each listed proposal
   that already constrains this decision. Treat each accepted decision as a
   constraint until a new proposal supersedes that decision.
3. If tracked repository knowledge is available, run
   `/wiki query <subsystem> --patterns`. The query returns failure modes that
   this harness already paid for. Cite each `[[pattern-...]]` slug that changed
   the recommendation.
4. Read the authoritative code, tests, probes, and docs for each surface in
   scope. Do not infer the shape of a surface without a read.
5. Name each actual decision. A restated feature request is not a decision.
6. Label each claim as a fact, a constraint, an assumption, or a judgment. Mark
   each unverified assumption as unverified.

## 3. Decide

Work through each of these items for each material decision:

- **Current state** — what exists now, cited by path.
- **Drivers** — the wanted outcome, and the reason to act now.
- **Invariants** — what must survive the change without modification.
- **Options** — include reuse, extend, retire, and do-nothing when each one is a
  live option. A brief with a single option is not an analysis.
- **Tradeoffs** — complexity, reversibility, portability, security,
  operability, context cost, migration risk.
- **Interaction** — how the option meets existing accepted decisions.
- **Failure modes** — how the option breaks, and how the operator rolls the
  option back.
- **Retirement** — what the option consolidates or deletes instead of adding a
  parallel path.
- **Falsification** — the evidence that shows the recommendation is wrong.

Choose the smallest architecture that satisfies the actual requirement. Do not
add an orchestration layer or a process layer without evidence that the layer
improves outcomes. Delete an abstraction in preference to a second abstraction
beside the first.

## 4. Record durable decisions

Record each durable architecture decision with the existing convention in
[`docs/rfcs/README.md`](../../../docs/rfcs/README.md):

1. Open a GitHub issue with the title `ADR: <title>` or `RFC: <title>`.
2. Move the issue through `Draft` → `Accepted` → `Superseded`.
3. Index the issue on that page.

Do not invent an architecture database, a service, a document taxonomy, a
decision directory, or a per-skill decision store. Do not require a record for
every change. For most decisions, the code and its probes hold enough record.
Propose a record only when the decision is architecturally significant and
costs much effort to rediscover.

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

`/architect` decides architecture. `/prd` turns the accepted direction into a
plan. `/delegate` executes the plan. No skill in this chain requires a run of
another skill first. A `NOT-ARCHITECTURAL` change goes directly to `/prd`. A
brief that ends in a rejected option produces no plan.
