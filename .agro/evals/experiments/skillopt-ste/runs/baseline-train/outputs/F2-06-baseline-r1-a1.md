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

Run `/architect` **inline in the active coding-agent session**. The session that
invoked `/architect` keeps ownership of the work. The invoking session also keeps
ownership of each step that follows the brief.

- Do not fork the context.
- Do not launch another coding-agent process.
- Do not open a tmux session or a Herdr session.
- Do not give the decision to a separate persistent identity.
- Do not create an `architect` agent definition. This skill is the role. The
  session that reads this skill is the runtime.
- Use `/delegate` only for bounded, self-contained fan-out. An example is a set
  of parallel, independent source reads with verbose output. Keep that verbose
  output out of this context. The active session reconciles every delegated result.
  The active session writes the brief.

Roles are behavior. Skills encode behavior. Agents execute behavior. If the task
requires isolation or parallelism as the result, start a second agent
context. Otherwise, keep the work in the active session.

## 1. Classify

Run the architecture review only for a significant change. If the change
materially affects one or more of these surfaces, classify the change as
**ARCHITECTURAL**:

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
- a structural decision that costs much time or effort to reverse.

If the change affects none of these surfaces, classify the change as
**NOT-ARCHITECTURAL**. Then do these steps:

1. State the classification in two or three sentences.
2. Name the reason.
3. Send the work directly to `/prd`.
4. Stop.

Do not write the full brief for a small local change.

## 2. Ground the decision

Read real sources before you reason. Recall from memory or synthesis is
advisory only. Current source and accepted decision records are the authority.

1. Read every applicable `AGENTS.md` from the repository root down to each
   directory that the change touches. A local `AGENTS.md` overrides a more
   general `AGENTS.md`. Inside one directory, `AGENTS.md` is the canonical
   context file.
2. Read the RFC/ADR index at `docs/rfcs/README.md`. Read each listed proposal
   that already constrains this decision. An accepted decision stays a
   constraint until a new proposal supersedes the accepted decision.
3. If tracked repository knowledge is available, query that knowledge with
   `/wiki query <subsystem> --patterns`. The query returns failure modes that
   this harness already experienced. Cite each `[[pattern-...]]` slug that
   changed the recommendation.
4. Inspect the authoritative code, tests, probes, and docs for the surfaces in
   scope. Read these sources. Do not infer the shape of these sources.
5. Name each actual decision. A restated feature request is not a decision.
6. Label every claim as fact, constraint, assumption, or judgment. Mark each
   unverified assumption as unverified.

## 3. Decide

Examine these items for each material decision:

- **Current state** — what exists now, cited by path.
- **Drivers** — the wanted outcome, and the reason to act now.
- **Invariants** — what must stay unchanged through the change.
- **Options** — if reuse, extend, retire, or do-nothing applies, include that
  option. A brief with a single option is not an analysis.
- **Tradeoffs** — complexity, reversibility, portability, security,
  operability, context cost, migration risk.
- **Interaction** — how the option meets existing accepted decisions.
- **Failure modes** — how the option breaks, and how to roll the option back.
- **Retirement** — what the option consolidates or deletes, instead of what
  the option adds next to existing machinery.
- **Falsification** — the evidence that shows the recommendation to be wrong.

Choose the smallest architecture that satisfies the actual requirement. Do not
add an orchestration layer or a process layer without evidence of better
outcomes. Delete an existing abstraction instead of adding a second
abstraction next to the first.

## 4. Record durable decisions

Record each durable architecture decision with the existing convention in
[`docs/rfcs/README.md`](../../../docs/rfcs/README.md). The convention uses a
GitHub issue titled `ADR: <title>` or `RFC: <title>`. The issue moves through
`Draft` → `Accepted` → `Superseded`. The index on that page lists the issue.

Do not invent an architecture database, a service, a document taxonomy, a
decision directory, or a per-skill decision store. Do not require a record for
every change. For most decisions, the code and the probes of the code hold
enough record. If the decision is architecturally significant and costs much
effort to rediscover, propose a record. Otherwise, propose no record.

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
plan. `/delegate` executes the plan. No skill in this chain is a mandatory
phase for another skill. A `NOT-ARCHITECTURAL` change goes directly to `/prd`.
A brief that ends in a rejected option produces no plan.
