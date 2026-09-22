# Delegation ledger — retire-unproven-skill-machinery

Advisor: the session running `/spec execute`. Acceptance owner for every task.
Native capability check (before first dispatch): the Claude Code `Agent` tool
exposes `model`; it exposes **no** effort argument, and no subagent definition
with `effort:` frontmatter is in scope for this run. Every worker therefore runs
at the inherited session effort, and every record says
`observed effort: inherited session level, unobserved`. Effort is an advisor
judgment, so its absence blocks nothing (SKILL.md, worker model and reasoning
policy, rule 4 applies to the model only).

Operator selections: none beyond "never Sonnet" (skill preference). Not violated.

## Wave plan

| Wave | Tasks | Parallelism | Complexity |
|------|-------|-------------|------------|
| 1 | T1 | 1 agent | M |
| 2 | T2 | 1 agent | M |
| 3 | T3 | 1 agent (continuing) | L |
| 4 | T4 | 1 agent | M |

Serialized, not parallel: every task commits to the single branch
`task/1124-retire-unproven-skill-machinery` in one checkout, and T1/T2/T4 all
touch `.agro/evals/RESULTS.md`. Shared-file work serializes by contract.

---

## T1 — Wave 1: retire the five zero-cascade skills

- **Depends On**: none
- **Complexity**: M. Blast radius is wide (5 skills, 2 probes, a lockfile) but every
  transformation is a deletion with a decisive check (`.agro/evals/run.sh` exit 0).
  Low uncertainty, fully reversible on a branch.
- **Requested model / reasoning**: `opus` / inherit. **Selection reason**: mechanical
  deletion with a decisive oracle; the hardest non-Sonnet tier is not warranted, and
  Opus is the skill's stated low-complexity worker.
- **Observed settings + provenance**: model `opus` — requested via Agent `model` arg,
  not independently confirmed from a runtime display; effort: inherited session
  level, unobserved.
- **Read scope**: `.agro/skills/`, `.agro/evals/probes/`, `.agro/evals/RESULTS.md`, `.agro/skills.lock`
- **Search / output limits**: repo-local greps only; report <= 60 lines, no full file dumps
- **Owned write paths**: `.agro/skills/{sync,post-bridge,blog,fanout,render-html}/`,
  `.agro/evals/probes/{sync-skill-contract,post-bridge-publish-confirmation}.sh`,
  `.agro/evals/RESULTS.md`, `.agro/skills.lock`, and inbound-reference edits in other files
- **Exclusions**: `.agro/skills/retro/`, `.agro/skills/{rlm,weigh,imagine,interview,strategic-proposal}/`,
  `.agro/evals/capability/`, `.agro/tasks/`, `prd.json`, `progress.txt`, this ledger
- **Execution directory**: `/home/sandbox/harness`
- **Worktree isolation**: shares the checkout; serialized, so no isolation needed
- **Worker type**: `general-purpose`
- **Continuation method**: native continuation via SendMessage if repair is needed
- **Deliverable**: one commit on `task/1124-retire-unproven-skill-machinery`
- **Verification**: `bash .agro/evals/run.sh` exit 0; the five directories absent;
  `node -e "require('./.agro/skills.lock')"` parses
- **Stopping condition**: commit pushed and verification output returned; or BLOCKED
  with the failing command and its output
- **Evidence destinations**: the worker's report; commit SHA
- **Covered DoD IDs**: 1 (partial), 2 (partial), 3 (partial), 9
- **Acceptance owner**: the advisor
- **Failure / repair route**: back to T1's worker via native continuation
- **Native worker ID**: assigned at dispatch
- **Status**: completed. Advisor verified independently: 161 probes exit 0, the five
  directories absent, `.agro/skills.lock` parses, and the commit diff is 2,469
  deletions across exactly the 15 expected files with the `Submitted-by:` trailer.
- **Artifact references**: commit `8cd02b354008235cf0c24466e55cc9091008f6ea`
- **Usage**: 84,624 subagent tokens, 34 tool uses, 202s

---

## T2 — Wave 2: retire the five cascading skills and sweep their couplings

- **Depends On**: T1 (shares `.agro/evals/RESULTS.md` and the eval oracle)
- **Complexity**: M. Same deletion shape as T1, but the sweep surface is wider and two
  probes hold live references (`audit-stale-references.sh`, `prompt-miner-symlink-entrypoint.sh`)
  whose assertions must be repaired rather than weakened.
- **Requested model / reasoning**: `opus` / inherit. **Selection reason**: mechanical
  with a decisive oracle; the judgment is reference disambiguation, not design.
- **Observed settings + provenance**: model `opus` — requested via Agent `model` arg,
  not independently confirmed; effort: inherited session level, unobserved.
- **Read scope**: `.agro/skills/`, `.agro/evals/probes/`, `.claude/protected-paths.txt`, `docs/glossary.md`
- **Search / output limits**: repo-local greps; report <= 60 lines
- **Owned write paths**: `.agro/skills/{rlm,weigh,imagine,interview,strategic-proposal}/`,
  `.agro/evals/probes/{rlm-context-budget,weigh-scorer-contract,audit-stale-references,prompt-miner-symlink-entrypoint}.sh`,
  `.agro/evals/RESULTS.md`, `.claude/protected-paths.txt`, `docs/glossary.md`, `.agro/skills.lock`,
  inbound-reference edits in `/council`, `/plan`, `/prompt-miner`
- **Exclusions**: `.agro/skills/retro/`, `.agro/skills/benchmark/`, `.agro/evals/capability/`,
  `.agro/tasks/`, `prd.json`, `progress.txt`, this ledger
- **Execution directory**: `/home/sandbox/harness`
- **Worktree isolation**: shares the checkout; serialized after T1
- **Worker type**: `general-purpose`
- **Continuation method**: native continuation via SendMessage
- **Deliverable**: one commit on the branch
- **Verification**: `bash .agro/evals/run.sh` exit 0; five directories absent;
  `roles-are-skills.sh` PASS; `.agro/skills.lock` parses
- **Stopping condition**: commit exists and verification passes, or BLOCKED with output
- **Covered DoD IDs**: 1, 2, 3, 9
- **Acceptance owner**: the advisor
- **Failure / repair route**: back to T2's worker via native continuation
- **Status**: pending

## T3 — Wave 3: rewrite the retro guard probe, then loosen /retro

- **Depends On**: T2
- **Complexity**: L. This is the campaign's only design work. The probe and the skill
  are mutually constraining (the probe pins 8 literals that block the loosening), the
  `/wiki compile` seam must keep parsing, and `/prompt-miner` cites `/retro` section 6
  by number. Coupled implementation, so it stays with ONE continuing worker across
  both US-003 and US-004 rather than splitting.
- **Requested model / reasoning**: `fable` / inherit. **Selection reason**: highest
  uncertainty and the least reversible change in the campaign; contract design across
  three coupled surfaces warrants the hardest available non-Sonnet tier.
- **Observed settings + provenance**: model `fable` — requested via Agent `model` arg,
  not independently confirmed; effort: inherited session level, unobserved.
- **Read scope**: `.agro/skills/retro/`, `.agro/skills/wiki/references/compile.md`,
  `.agro/skills/spec/references/{retro,execute}.md`, `.agro/skills/prompt-miner/SKILL.md`,
  `.agro/evals/probes/{retro-deterministic-contract,roles-are-skills,wiki-compile-contract}.sh`
- **Owned write paths**: `.agro/skills/retro/`, `.agro/evals/probes/retro-deterministic-contract.sh`,
  `.agro/skills/wiki/references/compile.md`, `.agro/skills/spec/references/{retro,execute}.md`,
  `.agro/skills/prompt-miner/SKILL.md` (citation repoint only)
- **Exclusions**: everything T1 and T2 own; `.agro/evals/capability/`; `.agro/tasks/`
- **Worker type**: `general-purpose`
- **Deliverable**: two commits (probe first, then skill) on the branch
- **Verification**: rewritten probe PASSes on unmodified `/retro`, then on loosened
  `/retro`; fault-injection table proving the failure branch reports rather than crashes;
  `wiki-compile-contract.sh` and `roles-are-skills.sh` PASS; `.agro/evals/run.sh` exit 0
- **Covered DoD IDs**: 1, 4, 5, 6, 8
- **Acceptance owner**: the advisor
- **Status**: pending

## T4 — Knowledge impact and campaign measurement

- **Depends On**: T3, and the step-5 audit passing
- **Complexity**: M. Judgment-bearing (which pages are invalidated) but bounded by the
  wiki schema and a deterministic index probe.
- **Requested model / reasoning**: `opus` / inherit. **Selection reason**: schema-bounded
  page authoring against a decisive index oracle.
- **Owned write paths**: `.agro/knowledge/`, `.agro/evals/capability/RESULTS.md`
- **Exclusions**: `.agro/skills/`, `.agro/evals/probes/`, `.agro/tasks/`
- **Worker type**: `general-purpose`
- **Verification**: `wiki-readme-index.sh` passes; CB-005 >= 1.33; working-tree
  dangling-reference scan clean
- **Covered DoD IDs**: 3, 7
- **Acceptance owner**: the advisor
- **Status**: pending
