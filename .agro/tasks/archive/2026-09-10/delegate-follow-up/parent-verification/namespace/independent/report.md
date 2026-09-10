# PR #1004 Namespace-Repair Independent Review

## Verdict

**SOURCE-PROMOTABLE. OWNER-RECORDS-REQUIRED.**

The repaired source at `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4` preserves the accepted PR behavior. I found no source-repair blocker. The PR must remain draft until the parent writes current owner records and runs fresh implementation and PR audits. The parent stated that this work is in progress.

I performed this review at the requested `gpt-5.6-sol` model and `high` reasoning level. I used no subagent. I ran no live worker experiment. I changed no tracked file, branch, PR state, repository setting, or remote state.

## Frozen revisions

| Role | Commit |
|---|---|
| Repaired review target | `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4` |
| Development base | `a227bbf3f3166a0e1a8a1951fc88694cfa0151ee` |
| Accepted PR head | `e81a5aad703a0f7081104a97d2eea980b72bca2e` |
| Reconciliation merge | `021d07e75036fea02ef4ed093ba4e4d1dc4a2632` |

The reconciliation merge has the accepted head and development base as its two parents. The final scoreboard commit has the reconciliation merge as its parent. The worktree started and ended clean at the repaired review target.

## Scope

The base-to-repaired diff contains 112 files. The relocated task tree contains 104 files. The eight non-task files are:

1. `.agro/skills/delegate/SKILL.md`
2. `.agro/evals/probes/advisor-execution-contract.sh`
3. `.agro/evals/probes/delegate-worker-boundary.sh`
4. `.agro/knowledge/README.md`
5. `.agro/knowledge/patterns/pattern-delegate-ledger-stale-at-acceptance.md`
6. `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md`
7. `CHANGELOG.md`
8. `.agro/evals/RESULTS.md`

I reviewed all eight files. I verified the complete task tree by exact Git mode and blob identity. I inspected the task records, reports, manifests, and focused raw evidence. I did not reread the large historical session transcript bodies, as the operator directed.

## Namespace and relocation result

The namespace repair is correct.

- The delegate skill and both changed probes are byte-identical to the accepted files after the active `.oh/` prefix changes to `.agro/`.
- The knowledge index preserves every development-base line and adds only the two accepted PR pattern rows.
- Each new pattern keeps its accepted historical frontmatter exactly. The six `.oh/path@commit` source pins resolve to the named historical blobs.
- Each pattern body uses an active `.agro/path` reference without a historical revision selector. This is the intended current-reference normalization.
- The accepted changelog is an ordered subsequence of the repaired changelog. The PR #1004 entry occurs once. The development migration entry is also present.
- All 104 files under `.oh/tasks/delegate-follow-up/` at the accepted head have the same modes and blobs under `.agro/tasks/delegate-follow-up/` at the repaired head.
- The repaired head tracks no `.oh` path.
- Both task evidence manifests verify with `sha256sum -c`.

The repaired head preserves all 22 pattern files from the development base byte for byte. It adds only the two expected PR patterns. This manual check closes the current persistence-probe coverage gap for this PR.

## Contract assessment

The source closes the four approved gaps.

1. **Accepted dependency evidence gates release.** Initial and resumed dispatch require all prerequisites, accepted dependency artifacts, and current evidence. They also require available controls and resolved status and provenance. A label alone does not authorize dispatch.
2. **Task size follows useful work.** Complexity, briefing cost, shared context, and verification cost determine a task boundary. The skill does not split work to maximize worker count. The five-worker and recursion caps remain.
3. **The advisor reconciles interrupted work before retry.** The skill inspects persisted native worker state and current artifacts. The advisor does not assign a duplicate writer to active work. The advisor validates ended and incomplete work before acceptance, resume, or retry of only the incomplete scope. Unknown status or provenance blocks writes and requires operator reporting.
4. **Planning and dry-run do not start execution.** The stale Memory Protocol is absent. Plan creation no longer triggers delegation. The decision graph checks `--dry-run` before the ledger write. Dry-run writes no ledger, dispatches no worker, and creates no execution state.

The repaired skill also preserves the accepted model and reasoning policy. Operator selections remain binding. Requested and observed settings remain separate. Unsupported required controls block dispatch. Unknown observations stay unknown. Sonnet remains excluded by the accepted provider preference.

## Independent probes and mutations

The following independent checks passed:

- Six focused contract probes: 6 of 6 passed.
- Four focused knowledge probes: 4 of 4 passed.
- `changelog-entry-length.sh`: passed.
- `link-providers.sh --check`: passed.
- `bash -n` for both changed probes: passed.
- Five focused Mermaid mutations: 5 of 5 returned the expected result.
- Twelve prior contract mutations: 12 of 12 returned the expected result.
- Final repair manifest: passed.
- Runtime evidence manifest: passed.

The local checkout has no `shellcheck` command. The repaired SHA has a successful CI `Boot Path Lint (shellcheck + hadolint)` job. The four other reported CI jobs also succeeded.

The tracked mutation scripts preserve archived evidence. They retain the original absolute scratch path and `.oh` fixture namespace. Direct reuse found the existing historical case directories and exited 1. I created namespace-adapted copies under this report directory and populated their fixture from `git archive` of the frozen repaired commit. The final independent runs passed all 17 cases. The report directory retains the failed setup attempts, which are not product-test results.

The probes identify themselves as prose checks. The accepted evidence discloses three paraphrase blind spots. The approved plan excludes broad oracle hardening. The 17 required fault injections pass, so I classify those disclosed blind spots as nonblocking scope debt.

## Full-eval assessment

The parent ran the full suite in separate detached worktrees at the true development base and repaired head. Both runs exited 0. Both produced the same 145 status rows:

- `137 PASS`
- `7 SKIPPED`
- `1 REGRESSION`

The base and repaired actual results are row-for-row equal. The repaired committed scoreboard also equals the repaired actual result.

The one regression is `skills-vendored`. Both true-base and repaired runs report the same missing `cc-safety-net` executable. The regression comes from inherited environment state, not the PR.

The worktree environment causes six skips. The seventh skip has a different cause. `wiki-pattern-persistence.sh` searches `git ls-tree "$base" -- '.oh'`, but the current development base stores patterns under `.agro`. The probe therefore reports that it found no patterns to protect. The inherited namespace migration caused this coverage defect. The environment did not cause this skip.

The accepted-head scoreboard had `138 PASS / 6 SKIPPED / 1 REGRESSION`. The extra repaired skip is `wiki-pattern-persistence`. The committed development scoreboard had `142 PASS / 2 SKIPPED / 1 REGRESSION`, but an actual run at that exact commit produced `137 PASS / 7 SKIPPED / 1 REGRESSION`. Four additional development-scoreboard passes became environment skips, and the persistence pass became the inherited namespace skip. The actual base-to-head comparison removes these stale-scoreboard effects and shows no PR regression.

This review authorizes no repair to the unrelated persistence probe. The independent 22-file blob check and six source-pin checks establish pattern survival and provenance for this PR.

## Runtime evidence boundary

The existing native evidence is narrow and honest.

- One Claude Code `2.1.260` experiment requested `opus` and `high`.
- The runtime did not prove the effective worker model or effort. The record preserves both observations as unknown or unobserved.
- A second session could not resolve the persisted worker handle. It dispatched no worker and wrote no owned task path while the original worker remained live.
- This proves fail-closed behavior for that observation. It does not prove cross-session reconnect success or a universal provider limitation.

Scope amendment SA-1 defers only cross-session reconnect success on the tested provider. SA-1 does not waive same-session recovery, ambiguity handling, provenance checks, or duplicate-writer prevention. The repaired source satisfies those retained requirements. I ran no new live experiment.

## Required owner action

The current `eval-result.json` and `simplicity-review.json` both name `23e409e6ab9193f9c1cac5fb0977c0e07215c623`. That commit is an ancestor of the repaired head, but 686 paths outside the current task folder and `.agro/evals/RESULTS.md` changed afterward. The current audit driver therefore cannot reuse either record.

The latest tracked `AUDIT-PASS` and `PR-AUDIT-PROMOTABLE` run records are also historical. Do not rewrite them.

Before the PR leaves draft, the parent must:

1. Write a superseding `eval-result.json` for the repaired content head or an evidence-only descendant.
2. Write a superseding `simplicity-review.json` for the same content epoch.
3. Run fresh implementation and PR audits after both owner records exist.
4. Preserve the actual `137 PASS / 7 SKIPPED / 1 REGRESSION` result and identify `wiki-pattern-persistence` as an inherited coverage limitation, not an environment skip.

These actions require owner-record updates only. They require no source repair.

## Findings

| ID | Class | Finding | Disposition |
|---|---|---|---|
| O-1 | Owner-record blocker | `eval-result.json` cannot cover the repaired source under the current descendant-reuse rule. | Parent must supersede it. |
| O-2 | Owner-record blocker | `simplicity-review.json` cannot cover the repaired source under the current descendant-reuse rule. | Parent must supersede it and rerun both audit routes. |
| N-1 | Nonblocking inherited coverage gap | `wiki-pattern-persistence` skips because it still scans `.oh` at an `.agro` base. | Record the limitation. Use the completed manual provenance check for this PR. |
| N-2 | Nonblocking inherited environment state | Six skips and `skills-vendored` reproduce at the exact base and repaired head. | No PR repair. |
| N-3 | Nonblocking accepted scope debt | The static probes remain prose oracles with three disclosed paraphrase blind spots. | Keep deferred unless separately authorized. |
| N-4 | Nonblocking evidence boundary | Effective worker model and effort remain unobserved; cross-session reconnect success remains deferred under SA-1. | Preserve the unknown values and exact waiver boundary. |

## Final classification

The repaired source is equivalent to the accepted implementation after the authorized namespace changes. The task relocation is exact and complete. The focused checks, 17 mutation cases, manifests, CI receipt, and actual base-to-head full eval support promotion.

**Final classification: source pass; draft remains blocked only until the parent publishes current owner records and fresh audit records.**
