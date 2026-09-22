# Retire unproven skill machinery

## Intent

Retire ten skills that are unproven, orphaned, or managing a topology that no
longer exists, and strip the ceremony from `/retro` without retiring the node.
Apply the repository's own retirement standard, set by the CB-003 and CB-004
rows in `.agro/evals/capability/RESULTS.md`: retire machinery that was **never
measured** ("unproven, not disproven"), keep machinery that produced results.

`/benchmark` is explicitly **kept**. It is the instrument that produced that
standard and it is step 9.3 of `/spec execute`.

## Architecture decision

`/architect` ran inline before this plan. Accepted recommendation:

- `/retro` keeps the node and retires the ceremony. The node is proven —
  14 probes carry `# source: retro lesson` (2026-06-04 through 2026-09-11),
  29 pattern pages exist, and CB-005 scores the
  `/retro` -> `/wiki compile` -> pattern -> probe chain PASS on success.
  The ceremony is unproven: no source shows the hypothesis table or verdict
  rubric caused any of those outputs, and `STATUS: RETRO-DONE` is the only
  forced terminal status line in the 37-skill corpus.
- The ten retirements are measured against the same standard, per skill, in
  `## Affected surfaces`.

Proposed decision record: `ADR: retire unproven skill machinery, not proven
nodes`. Not created by this node; `/spec execute` opens it.

## Goals

1. Delete ten skills and their dead couplings, leaving `/eval` green with no
   dangling references.
2. Loosen `/retro` to three invariants, with its guard probe rewritten first.
3. Leave the `/spec execute` pipeline intact end to end:
   `evidence -> retro -> /wiki compile -> benchmark`.

## Non-goals

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing `/wiki compile`'s write gate or its eligibility table semantics.
- Changing the `.agro/tasks/` layout or the advisor/worker model (ADR #989).
- Creating a `blog/` or `.claude/specs/` replacement surface.

## Definition of Done

1. `bash .agro/evals/run.sh` exits 0 with no REGRESSION, and the probe count
   drops by exactly 4 (`sync-skill-contract.sh`, `rlm-context-budget.sh`,
   `post-bridge-publish-confirmation.sh`, `weigh-scorer-contract.sh`).
2. `.agro/skills/{fanout,render-html,sync,blog,post-bridge,rlm,weigh,imagine,interview,strategic-proposal}`
   do not exist.
3. `git grep -nE '/(fanout|render-html|sync|blog|post-bridge|rlm|weigh|imagine|interview|strategic-proposal)\b'`
   over tracked active surfaces returns only CHANGELOG, `docs/rfcs/preserved-changelog-rationale.md`,
   `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, and `.agro/tasks/archive/**`.
   Scan the **working tree**, not `git ls-files` alone
   ([[pattern-evals-tracked-only-scan-misses-uncommitted]]).
4. `bash .agro/evals/probes/roles-are-skills.sh` PASSes — it requires
   `.agro/skills/retro/SKILL.md` to survive.
5. `bash .agro/evals/probes/wiki-compile-contract.sh` PASSes, and a loosened
   `/retro` promotion line still parses against `compile.md:65`.
6. The rewritten `retro-deterministic-contract.sh` has its failure branch
   exercised by fault injection, not just its passing branch
   ([[pattern-evals-probe-failure-path-untested]]).
7. CB-005 re-scored at >= 1.33 in `.agro/evals/capability/RESULTS.md`.
8. `bash .agro/scripts/link-providers.sh` runs clean and every symlink resolves.
9. `node -e "require('./.agro/skills.lock')"` parses and holds no retired entry.

## Advisor orchestration

The session running `/spec execute` is the owner and performs no tracked
implementation edit itself. Three bounded `/delegate` workers, one per wave,
dispatched in order because waves 2 and 3 depend on wave 1's sweep landing.

| Worker | Owned write paths | Excluded | Evidence |
|---|---|---|---|
| W1 wave 1 | `.agro/skills/{fanout,render-html,sync,blog,post-bridge}/`, `.agro/evals/probes/{sync-skill-contract,post-bridge-publish-confirmation}.sh`, `.agro/skills.lock` | `.agro/skills/retro/`, `.agro/evals/capability/` | `bash .agro/evals/run.sh` exit 0 |
| W2 wave 2 | `.agro/skills/{rlm,weigh,imagine,interview,strategic-proposal}/`, `.agro/evals/probes/{rlm-context-budget,weigh-scorer-contract,prompt-miner-symlink-entrypoint,audit-stale-references}.sh`, `.claude/protected-paths.txt`, `docs/glossary.md`, `.agro/evals/RESULTS.md` | `.agro/skills/retro/` | `bash .agro/evals/run.sh` exit 0 |
| W3 wave 3 | `.agro/skills/retro/`, `.agro/evals/probes/retro-deterministic-contract.sh`, `.agro/skills/wiki/references/compile.md`, `.agro/skills/spec/references/{retro,execute}.md` | everything wave 1 and 2 own | probe fault-injection table + `wiki-compile-contract.sh` PASS |

The owner reconciles each wave before dispatching the next. No worker writes
`prd.json` or `progress.txt`.

## Affected surfaces

### Wave 1 — zero cascade (2,295 lines)

| Skill | Lines | Grounds (verified) |
|---|---|---|
| `sync` | 735 | `git remote -v` shows a single remote, `origin -> mifunedev/agro`. `references/topology.md:12` maps `origin -> <origin-owner>/openharness` and `upstream -> mifunedev/agro`. This checkout **is** the upstream; the fork topology does not exist, and the map still uses the pre-#939 name. |
| `post-bridge` | 752 | Largest single SKILL.md in the corpus (391 lines). Social-media publishing API client. Sole inbound reference is `/blog`, also retiring. |
| `blog` | 344 | `.agro/evals/probes/docs-build-fast-path.sh:67` forbids a `blog/` tree in this repo; content lives in `mifunedev/agro-web`. The skill authors what the repo refuses to hold. |
| `fanout` | 336 | 0 inbound references, 0 probes. Overlaps `/delegate` (bounded parallel workers) and `/worktrees` (isolation). |
| `render-html` | 128 | 0 inbound references, 0 probes. Its `/strategic-proposal` and `/audit` mentions are outbound. |

### Wave 2 — cascades (1,163 lines)

| Skill | Lines | Grounds (verified) |
|---|---|---|
| `rlm` | 268 | CB-004 shape. `.agro/evals/RESULTS.md:125` cites provenance `.agro/tasks/rlm-weighted-trajectories/prd.json` — that folder exists in neither `.agro/tasks/` nor `archive/`. Probe-green, never exercised. |
| `weigh` | 450 | Same shape: ships a frozen `score-trajectories.mjs` with tests and **no scored trajectory on disk**. `/rlm` is its primary consumer; retiring `/rlm` orphans it. |
| `interview` | 198 | 1 inbound reference, from `/imagine` — also retiring, so 0. Duplicates `AskUserQuestion` and `/spec plan`'s own clarifying step. |
| `imagine` | 140 | Fourth plan-authoring surface. Writes to `.claude/specs/`, which is gitignored and empty. `/spec plan --plan <path>` accepts any file, so the format buys nothing. |
| `strategic-proposal` | 107 | Thin wrapper over `/council` plus one critic. Both inbound refs (`/council`, `/render-html`) are internal or retiring. |

### Wave 3 — `/retro` ceremony

**Strip:** the falsifiability gate (SKILL.md section 2), the 8-column hypothesis
table, the five-subsystem lens, `STATUS: RETRO-DONE`, the `--focus <subsystem>`
flag (it exists only to serve the lens), and `references/report-schema.md`.

**Preserve, as the only three invariants:**

1. Report-only. No ledger, no dated log — the `.agro/memory` tier was already
   deleted once and the probe's `ro-a`/`ro-b`/`ro-c`/`ro-d2` assertions exist to
   keep it deleted.
2. No double-write against a probe that already guards the lesson.
3. A per-lesson `[verdict · confidence]` tag and the exact promotion line
   ``- <principle> [<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis: <clause>``,
   which `/wiki compile` parses at `compile.md:65` and gates on at `:76`.
   `/wiki compile` owns no bar of its own by design, so this is the seam.

**Order is load-bearing.** Rewrite `retro-deterministic-contract.sh` **first** —
it currently pins 8 literals in SKILL.md and mechanically blocks the loosening.
Pin short tokens and table cells, never whole sentences
([[pattern-evals-prose-literal-pinning]]).

### Sweeps (found by grounding, beyond the operator's brief)

| Surface | Change |
|---|---|
| `.agro/skills.lock` | Holds entries for `interview`, `post-bridge`, `render-html`, `strategic-proposal` (lines 49-116). Remove. |
| `.claude/protected-paths.txt:29` | `strategic-proposal` entry. Remove. Keep `:33` `retro` and `:59` `spec/references/retro.md`. |
| `.agro/evals/probes/audit-stale-references.sh:31` | `.agro/skills/weigh` in the `bare_audit` caller list becomes a dead path. Remove the entry. |
| `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh` | References `weigh`. Sweep. |
| `.agro/evals/RESULTS.md:125,149,156` | `rlm-context-budget`, `sync-skill-contract`, `weigh-scorer-contract` rows. Remove with their probes. |
| `.agro/knowledge/source/recursive-language-models.md` | `kind: external` source page backing `/rlm`. Loses its consumer — resolve in the knowledge-impact gate, do not delete blindly. |
| `.agro/skills/prompt-miner/SKILL.md:179` | Cites `.claude/skills/retro/SKILL.md` **§ 6** and mirrors its qualify filter, probe dedup, and promotability bar. Wave 3 renumbers that section. The substance survives as invariants 2 and 3, but the citation must be repointed, not left dangling. Found during execute re-grounding. |
| `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh:14` | Comment cites `rlm/ and weigh/` as documenting a forbidden pattern. Sweep. |
| Cross-refs | `/council` (`SKILL.md:141`, `references/scenarios.md:74,80`), `/plan` (`SKILL.md:207`), `/imagine` (`SKILL.md:31`), `/retro` (`SKILL.md:135`), `docs/glossary.md`. |
| `link-providers.sh:22` | Keeps vendoring `validate-retro-report.sh` — the validator survives, shrunken. Verify the symlink still resolves. |

**Guard hazard.** `audit-stale-references.sh` greps every tracked file for
retired vocabulary. If this campaign adds the ten names to that pattern, every
doc that *explains* the retirement violates the rule it documents
([[pattern-docs-prohibition-by-example]]). Either extend the exemption list
deliberately or do not add the names to the guard.

## Knowledge Context

- **Base commit**: `4fc0cd7eb9adcba71653d797373b814184d5eb67`
- **Queries**: `skills`, `evals`, `probes`, `spec`, `docs`, `retire`
- **Knowledge used**: `[[pattern-docs-prohibition-by-example]]`,
  `[[pattern-evals-prose-literal-pinning]]`,
  `[[pattern-evals-probe-failure-path-untested]]`,
  `[[pattern-evals-tracked-only-scan-misses-uncommitted]]`,
  `[[pattern-spec-simplify-round-seeded-non-reducing]]`
- **Grounded against**: `.agro/skills/retro/SKILL.md`,
  `.agro/skills/retro/references/report-schema.md`,
  `.agro/skills/spec/references/retro.md`,
  `.agro/skills/spec/references/execute.md`,
  `.agro/skills/wiki/references/compile.md`,
  `.agro/evals/probes/retro-deterministic-contract.sh`,
  `.agro/evals/probes/roles-are-skills.sh`,
  `.agro/evals/probes/audit-stale-references.sh`,
  `.agro/evals/capability/RESULTS.md`, `.agro/skills/sync/references/topology.md`,
  `.agro/skills/benchmark/SKILL.md`, `.agro/scripts/link-providers.sh`,
  `.agro/skills.lock`, `.claude/protected-paths.txt`, `git remote -v`
- **Conflicts discovered**: `.agro/evals/RESULTS.md:125,156` cite provenance
  `.agro/tasks/rlm-weighted-trajectories/prd.json`, a path that does not exist
  in `.agro/tasks/` or `.agro/tasks/archive/`. Recorded as corroborating
  evidence for the `/rlm` and `/weigh` retirements; repaired in the
  knowledge-impact gate, not here.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `.agro/knowledge/source/recursive-language-models.md`
  (loses its consuming skill), `docs/glossary.md`, plus a new
  `kind: pattern` page on the unproven-machinery retirement standard if the
  retro supports one.
- **Affected source paths**: `.agro/skills/**`, `.agro/evals/probes/**`,
  `.agro/skills.lock`, `.claude/protected-paths.txt`, `docs/glossary.md`
- **Reason**: The change retires ten reusable abstractions and rewrites a
  control-plane contract, which is skill behavior and shared vocabulary.

## Plan Reconciliation

- **Source plan**: `/architect` brief, inline in this session; operator
  decisions recorded via AskUserQuestion (one task folder / three waves;
  keep `benchmark`, retire `weigh`).
- **Intent preserved**: YES
- **Material deviations**: none. `/weigh` was added to the retirement set by
  explicit operator decision, not by grounding.
- **Constraints discovered during grounding**: four, none contradicting the
  plan — (1) `.agro/skills.lock` holds four retired entries the brief did not
  name; (2) `.claude/protected-paths.txt:29` holds a `strategic-proposal`
  entry; (3) `audit-stale-references.sh:31` lists `.agro/skills/weigh` as a
  caller path; (4) `roles-are-skills.sh:16` hard-requires
  `.agro/skills/retro/SKILL.md`, which wave 3 preserves.
- **Orchestration preserved**: YES
- **Re-grounded at execute**: base moved `4fc0cd7e` -> `ad74078011b2ffb6fccf4e46cd62f68daa0d74a5`
  (136 files). The intersection with `Grounded against` is **empty** — no source
  this plan rests on moved, and no retiring skill was touched. Two new skills
  landed in that range (`typesafe-ai`, and changes to `prompt-miner`);
  `typesafe-ai` references no retiring skill. Fifth constraint discovered, mechanism
  not intent: `/prompt-miner` Step 4 cites `/retro` **§ 6** by section number and
  mirrors its gate. Wave 3 must repoint that citation. Intent preserved: YES.
