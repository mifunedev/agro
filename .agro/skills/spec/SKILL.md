---
name: spec
description: >-
  Build dispatcher and repo-knowledge loop. Routes to plan, execute, or retro;
  approved plan paths run plan then execute. Re-grounds .agro/knowledge/,
  scaffolds .agro/tasks/<slug>/, owns one build path, and derives knowledge
  invalidation from the diff. Procedures: references/{plan,execute,retro}.md.
  TRIGGER when: an approved plan needs a ready PR -> "/spec <plan-path>" or
  "build this plan end to end"; a topic or issue needs a task folder ->
  "plan <topic>"; an approved task needs implementation -> "execute <slug>";
  a PASSed build needs lessons captured -> "retro <slug>".
argument-hint: "<plan-path> | plan <topic> [--plan <path>] [--issue <N>] [--slug <slug>] [--prefix <type>] [--repo <o/n>] [--base <branch>] | execute <slug> [--pr <N>] [--repo <o/n>] [--remote <name>] [--base <branch>] | retro <slug> [--dry-run]"
---

# /spec — canonical workflow dispatcher

`/spec <subcommand> [args]` is the single entry point to the decomposed
`spec-*` workflow nodes. The first whitespace-delimited token of `$ARGUMENTS`
selects the subcommand; everything after it is that subcommand's own argument
string. Each subcommand's full procedure lives in a reference doc under
`references/` — read that doc and follow it as the authoritative instructions.

**An unrecognized first token is not an error — it is an approved plan path.**
`/spec <plan-path>` is the ordinary way in: it scaffolds the task folder and then
builds it through to a ready-for-review pull request. Naming a node explicitly
(`plan`, `execute`) runs only that node, which is what fan-out and recovery need.

This is the **only** spec pipeline; there is no all-in-one composer beside it.
`references/execute.md` holds the build mechanics in full — the issue, the
branch, the draft PR, the implementation step, the `/eval` and knowledge gates, the
promotable classification, and the undraft — so learning what the build does
never sends a reader to a second skill.

## The loop

`/spec` is where accumulated repository understanding is consumed, re-verified,
spent, and replenished. Knowledge is a derived cache; the repository is the
source of truth.

```text
operator intent
    ↓
/spec plan  ──▶ recall tracked knowledge (.agro/knowledge/, /wiki query)
                     ↓
                verify claims against current code / tests / docs
                     ↓
                prd.md (Knowledge Context · Expected Knowledge Impact ·
                        Plan Reconciliation) + prd.json
    ↓
/spec execute ─▶ re-ground against current HEAD
                     ↓
                implementation ⇄ audit  →  /eval (once)
                     ↓
                Actual Knowledge Impact = expected + actual diff + dependencies
                     ↓
                update / reverify affected pages
                     ↓
                evidence.md → retro → /wiki compile
    ↓
future /spec plan reads what this run learned
```

Two rules keep the loop honest:

- **Knowledge informs; it never authorizes.** A recalled page is orientation.
  Code and tests are implementation truth; canonical docs and RFCs are
  intended-design truth. A material claim is re-grounded before it is relied on.
- **The planner predicts, the diff decides.** `Expected Knowledge Impact` is the
  planner's guess. The final impact is derived from the actual changed paths and
  the pages' declared dependencies, because implementation touches paths the
  planner never saw.

## Workflow contract

The canonical operative path is
`spec-plan → spec-execute → merge → reset|clean`.

There is no automated selection node. A human selects the work and approves
`prd.md`; that approval is the commitment gate. **Handing `/spec` an approved
plan file satisfies that gate** — writing the plan and passing it in *is* the
operator's approval, so the default path carries it through to `execute` without
a second prompt. A bare topic with no plan file has no such approval behind it:
the run stops after `plan` and hands the operator the folder to approve.

**Approval covers the intent that was approved, not whatever grounding turns it
into.** If `plan`'s grounding step finds that satisfying the approved plan
requires a *material* change to the operator's intent, the run stops and asks for
re-approval rather than treating the original approval as covering the new shape
(`references/plan.md`, `## Plan Reconciliation`).

`/spec execute` stops at a ready-for-review pull request. The human alone merges.
The runner performs `reset` or `clean`.

### The task folder

The `.agro/tasks/<slug>/` folder is the interface between the subcommands:

```text
.agro/tasks/<slug>/
├── prd.md            the approved plan, with its knowledge sections
├── prd.json          the ordered task graph — and the authoritative completion state
├── progress.txt      the execution narrative and resume evidence
├── evidence.md       written after implementation; gates the undraft
└── eval-result.json  the commit-keyed probe-suite result, when applicable
```

There is **no generated `prompt.md`**. The task prompt is rendered at
execution time from `templates/task-prompt.md` plus `prd.md` and `prd.json`; a
persisted copy of a template only drifts from it.

**Completion is structured state.** A task is complete when every story in
`prd.json` has `"passes": true` — `jq -e 'all(.userStories[]; .passes == true)'`.
There is no prose sentinel in `progress.txt`; a second representation of
completion is a second thing that can be wrong.

### Execution lifecycle

`execute` can return before the build finishes — a cron or a resumed run reaches
this line with stories still open — so it reports the state it actually reached:

```text
PLANNED ──▶ RUNNING ──▶ READY
                   └──▶ DRAFT-BLOCKED(<gate>)
```

`RUNNING` is a real state, not ceremony — and it is a state of the **task**, not
of a process: an approved folder whose stories are not all `passes: true`. The
owner mirrors it into `/tmp/spec-<slug>.state` at every phase change so resume,
watchdog, and operator visibility have something to read. `execute` returning
before the build finishes is reported as `RUNNING`, never as `READY`.

## Subcommands

| Subcommand | Arg shape | Purpose | Procedure |
|---|---|---|---|
| `plan` | `<topic> [--plan <path>] [--issue <N>] [--slug <slug>] [--prefix <type>] [--repo <o/n>] [--base <branch>]` | Recall tracked knowledge, re-ground it, and turn a topic/plan/issue into a scaffolded `.agro/tasks/<slug>/` folder | `references/plan.md` |
| `execute` | `<slug> [--pr <N>] [--repo <o/n>] [--remote <name>] [--base <branch>]` | Re-ground, then `implementation ⇄ audit → eval → knowledge impact → evidence → retro → compile → benchmark` to a ready PR, stopping at the human merge gate | `references/execute.md` |
| `retro` | `<slug> [--dry-run]` | Compatibility wrapper for `/retro --task <slug>` | `references/retro.md` |
| *(default)* | `<plan-path>` | `plan` then `execute` — the approved-plan path. Selected by any first token that is not a node name | this file, plus both procedures |

## Dispatch

1. Split `$ARGUMENTS`: `SUB` = the first token; `REST` = everything after it.
2. When `SUB` names a node (`plan`, `execute`, `retro`), read
   `references/<SUB>.md` and follow it, treating `REST` as that doc's
   `$ARGUMENTS` (e.g. for `/spec plan <topic> --issue 7`, the plan procedure sees
   `<topic> --issue 7`).
3. **Any other non-empty `$ARGUMENTS` is the approved-plan path.** Run
   `references/plan.md` with the whole string, verify the three-file contract,
   then run `references/execute.md` with the resulting `<slug>`. Do not print
   usage for an argument that merely fails to name a node; a plan path is the
   expected input.
4. Empty `$ARGUMENTS` → print the Subcommands table as usage and stop.

```bash
SUB="${ARGUMENTS%% *}"                          # first token
REST="${ARGUMENTS#"$SUB"}"; REST="${REST# }"    # remainder
case "$SUB" in
  plan|execute|retro)
    # read references/$SUB.md and execute it with REST as its $ARGUMENTS
    ;;
  ship)
    # `ship` is retired: it owned no mechanics of its own. Say so once, then
    # treat REST as the plan path so the slug is not derived from the word.
    echo "note: 'ship' was retired; /spec <plan-path> runs plan then execute"
    # continue at step 3 with REST
    ;;
  "")
    echo "usage: /spec <plan-path> | plan <topic> | execute <slug> | retro <slug>"
    ;;
  *)
    # DEFAULT: an approved plan path -> plan, then execute
    ;;
esac
```

## Shared rules (apply to every subcommand)

- **This skill owns the workflow** — keep the operative path, human selection,
  plan-approval gate, evidence gate, and human merge boundary in this skill and
  its three direct references. Do not duplicate the workflow in root
  instructions.
- **The `.agro/tasks/<slug>/` folder is the universal interface** — `plan` produces
  it; `execute` and `retro` are each pointed at it. The `<slug>` is the universal
  key (task directory, branch second segment, status file). It is never a terminal
  identifier: no session, tab, or pane name is derived from it, and none is read
  back to decide task state.
- **One owner, bounded writers — the agent that is running `execute` is the
  owner** — it acts as advisor and owns every decision, every post-build gate,
  `prd.json`, and `progress.txt`.
  **`/spec` never launches another coding-agent process to do that work**:
  no multiplexer session, no Herdr
  workspace/tab/pane, no background shell, no runner selection. Tracked
  implementation edits — code, tests, docs, integration fixes, repair — go to
  bounded `/delegate` workers before the owner performs acceptance. A direct
  owner edit requires an explicit operator exception recorded in `progress.txt`
  before the edit. A small task can use one worker. A worker never becomes a
  second supervisor, executor, or PR owner, never writes `prd.json` or
  `progress.txt`, and the owner reconciles and validates every result.
- **Same session by default** — the owner needs no particular model and no
  handoff. Ownership transfers only when the operator requests another session:
  the originating advisor stops dispatching work for the task first, and the
  receiving advisor reads the plan and current evidence, then acknowledges
  ownership before it dispatches a worker. A plan without a handoff prompt is
  complete. A factual question or a plan-only request needs no worker.
- **Compose, don't fork** — each node reuses existing skills rather than
  re-implementing them: `plan` composes `/wiki query` + `/prd` + `/ralph`;
  `execute` composes `/audit implementation` + `/eval` + `knowledge-impact.sh` +
  `/wiki compile` + `/benchmark` + `/audit pr`; `retro` composes `/retro`. The
  build **literals** — the `gh` invocations, the branch and PR shapes, the
  implementation step, and the worker-first implementation rules — live in
  `references/execute.md`, which is the single source for them and is a
  protected path.
- **Dependency-aware invalidation lives in the knowledge primitive** —
  `.agro/skills/wiki/scripts/knowledge-impact.sh`. `/spec` calls it; it does not
  carry a second copy of the logic.
- **One adversarial loop** — `implementation ⇄ audit` inside `execute` vets the
  implementation (`AUDIT-FAIL` routes back to the same owner, who assigns the
  repair to the bounded worker that owns the affected files). The plan
  itself is vetted by the operator who approves it, and re-approved if grounding
  materially changes it.
- **Distil before you compress** — high-resolution execution evidence is turned
  into `evidence.md`, a retro, and durable patterns *before* any context
  compression. Compaction is a runtime optimization, non-gating, and never a
  semantic stage of the build.
- **Honest terminal reports** — each subcommand reports what it actually
  produced: `plan` the folder path and story count; `execute` `RUNNING` when it
  returns with the task still building, and `READY` or `DRAFT-BLOCKED(<gate>)`
  with the PR URL when the build reaches a terminal state; `retro` the promotion counts. Never
  infer success from silence. A missing artifact, a crashed build, or an
  undecided gate is reported as blocked, never as done.

## When NOT to use

- **selection** — choosing which issue to build is the human's job; `/spec`
  builds the one plan or folder it is handed.

## See Also

- `references/plan.md`, `references/execute.md`, and `references/retro.md` — the
  authoritative per-subcommand procedures.
- `.agro/skills/wiki/references/schema.md` — the knowledge schema `plan` recalls
  from and `execute` invalidates against.
