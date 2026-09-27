# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Retire the Wave 1 skills

**Description:** As the operator, I want the `sync`, `post-bridge`, `blog`, `fanout`, and `render-html` skills gone so that the skill corpus holds no orphaned machinery.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` do not exist.
- [ ] The files `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` do not exist.
- [ ] `jq -e '.skills // . | has("post-bridge") or has("render-html") | not' .agro/skills.lock` exits 0.
- [ ] `.agro/evals/probes/docs-build-fast-path.sh` keeps its `blog/` guard at line 67 unchanged.
- [ ] The dangling-reference oracle in the Test Plan returns no line for these five names.

### US-002: Retire `/rlm` and `/weigh`

**Description:** As the operator, I want the `rlm` and `weigh` skills gone so that no frozen scorer stands without a scored trajectory.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm` and `.agro/skills/weigh` do not exist.
- [ ] The files `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` do not exist.
- [ ] `.agro/evals/probes/audit-stale-references.sh` no longer lists `.agro/skills/weigh`, and the probe exits 0.
- [ ] `.agro/skills/council/SKILL.md` and `.agro/skills/council/references/scenarios.md` contain no `/weigh` reference.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` contains no `weigh` reference.
- [ ] The dangling-reference oracle in the Test Plan returns no line for `rlm` and `weigh`.

### US-003: Retire `/interview`, `/imagine`, and `/strategic-proposal`

**Description:** As the operator, I want the three duplicate planning and proposal skills gone so that each plan-authoring job has one surface.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` do not exist.
- [ ] `jq -e '.skills // . | has("interview") or has("strategic-proposal") | not' .agro/skills.lock` exits 0.
- [ ] `.agro/skills/plan/SKILL.md` line 207 and `.agro/skills/spec/references/plan.md` line 35 name no `/imagine` surface.
- [ ] `.agro/skills/council/SKILL.md`, `.agro/skills/council/references/scenarios.md`, and `crons/heartbeat.md` name no `/strategic-proposal` surface.
- [ ] The dangling-reference oracle in the Test Plan returns no line for these three names.

### US-004: Rewrite the retro contract probe first

**Description:** As the operator, I want `retro-deterministic-contract.sh` to pin the reduced `/retro` contract so that the probe allows the ceremony removal and still guards the three invariants.

**Acceptance Criteria:**

- [ ] The probe no longer pins `STATUS: RETRO-DONE`, the 8-column table header, `--focus`, `report-schema.md`, or `validate-retro-report.sh`.
- [ ] The probe pins `It emits its report to the terminal and writes no file at all.` and `Inventing a file to save a lesson in.` in `.agro/skills/retro/SKILL.md`.
- [ ] The probe pins the no-double-write rule against an existing probe under `.agro/evals/probes/`.
- [ ] The probe asserts that the promotion-line template in `.agro/skills/retro/SKILL.md` appears byte for byte in `.agro/skills/wiki/references/compile.md`.
- [ ] The probe keeps the checks `ro-a`, `ro-b`, and `ro-d` for the deleted memory and context tiers.
- [ ] Against the current unmodified `.agro/skills/retro/SKILL.md`, the rewritten probe exits 1 and names the missing reduced-contract literal.

### US-005: Strip the `/retro` ceremony

**Description:** As the operator, I want `/retro` to keep its node and lose its ceremony so that the skill costs less context and still feeds `/wiki compile`.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` contains none of: `STATUS: RETRO-DONE`, `--focus`, `falsifiable`, `## The five-subsystem lens`, or `| ID | Subsystem | Hypothesis |`.
- [ ] `.agro/skills/retro/references/report-schema.md` does not exist.
- [ ] Each promotion line in the `/retro` template carries a `[<verdict> · <confidence> · harden|proceduralize|eval]` tag, a `probe: <id>` field, and a `basis:` field.
- [ ] `.agro/skills/wiki/references/compile.md` step 1 shows the same promotion-line template byte for byte.
- [ ] `.agro/skills/wiki/references/compile.md` keeps the eligibility table of step 2 unchanged.
- [ ] `bash .agro/evals/probes/retro-deterministic-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] A fault injection on a disposable copy restores `STATUS: RETRO-DONE` into `SKILL.md`, and the probe exits 1 and names that literal.
- [ ] A second fault injection on a disposable copy changes the promotion-line template in `compile.md` only, and the probe exits 1 and names the template mismatch.

### US-006: Verify the whole retirement

**Description:** As the operator, I want one end-to-end verification pass so that the Definition of Done in issue #1124 holds on the final tree.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The probe count in `.agro/evals/probes/` equals 159, which is the base count of 163 minus 4.
- [ ] `.agro/evals/RESULTS.md` holds no row for the four deleted probes after the runner rewrites the file.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `jq -e . .agro/skills.lock` exits 0.
- [ ] The dangling-reference oracle in the Test Plan returns no line.
- [ ] The advisor re-scores CB-005 through `/benchmark`, and the CB-005 row in `.agro/evals/capability/RESULTS.md` shows a score of 1.33 or more.
- [ ] `.agro/skills/benchmark/SKILL.md` exists and is unchanged.

## Summary

Issue #1124 (`work/issue-1124.md`) retires ten skills and strips the `/retro` ceremony. The standard comes from the CB-003 and CB-004 rows in `.agro/evals/capability/RESULTS.md`. The rule: retire machinery that nobody measured, and keep machinery that produced results.

Verified current state:

- All ten target directories exist under `.agro/skills/`.
- `.agro/evals/probes/` holds 163 probes. Four of them guard retiring skills.
- `.agro/skills.lock` lists `interview`, `post-bridge`, `render-html`, and `strategic-proposal`. The lock lists no other retiring skill.
- `.claude/skills` and `.agents/skills` are symlinks to `../.agro/skills`. Deleting a canonical directory removes the mirror entry too.
- `retro-deterministic-contract.sh` pins 8 literals in `.agro/skills/retro/SKILL.md`. It also runs `validate-retro-report.sh` against two fixture reports.
- `compile.md` lines 64 to 66 show the promotion line as `[<subsystem> · <confidence> · harden|proceduralize|eval]`. The step 2 table at line 76 gates on the verdict and the confidence.
- The current `/retro` line carries the subsystem, not the verdict. The verdict lives only in the 8-column table.

Selected approach: land Waves 1 and 2 first, because they have no cascade into `/retro`. In Wave 3, rewrite the probe first, then rewrite `SKILL.md`. Move the verdict into the per-lesson tag, so that `/wiki compile` still reads verdict and confidence from each line.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/{sync,post-bridge,blog,fanout,render-html}/` | skill directories | Wave 1 deletions |
| `.agro/skills/{rlm,weigh,interview,imagine,strategic-proposal}/` | skill directories | Wave 2 deletions |
| `.agro/evals/probes/sync-skill-contract.sh` | probe | Deleted with `sync` |
| `.agro/evals/probes/post-bridge-publish-confirmation.sh` | probe | Deleted with `post-bridge` |
| `.agro/evals/probes/rlm-context-budget.sh` | probe | Deleted with `rlm` |
| `.agro/evals/probes/weigh-scorer-contract.sh` | probe | Deleted with `weigh` |
| `.agro/evals/probes/audit-stale-references.sh` | path list at line 30 | Drops `.agro/skills/weigh` |
| `.agro/skills.lock` | keys `interview`, `post-bridge`, `render-html`, `strategic-proposal` | Entries to delete |
| `.agro/skills/council/SKILL.md` | lines 141, 142, 151, 153, 154 | References to `/strategic-proposal` and `/weigh` |
| `.agro/skills/council/references/scenarios.md` | lines 74, 80, 94, 95 | References to `/strategic-proposal` and `/weigh` |
| `.agro/skills/prompt-miner/references/scoring.md` | line 104 | Reference to `weigh` |
| `.agro/skills/plan/SKILL.md` | line 207 | Reference to `/imagine` |
| `.agro/skills/spec/references/plan.md` | line 35 | `/imagine` example for `--plan` |
| `crons/heartbeat.md` | line 73 | Reference to `/strategic-proposal` |
| `.agro/knowledge/source/recursive-language-models.md` | lines 17 to 32 | Describes `/rlm` and `/weigh` as live skills |
| `.agro/evals/probes/retro-deterministic-contract.sh` | literal list, fixture reports | Wave 3 guard, rewritten first |
| `.agro/skills/retro/SKILL.md` | lines 3, 72 to 90, 125 to 152, 198 to 256 | Ceremony to strip |
| `.agro/skills/retro/references/report-schema.md` | whole file | Deleted |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | validator | Enforces the 8-column table; see Open Questions |
| `.agro/skills/wiki/references/compile.md` | lines 26, 64 to 66, 76 | Promotion-line parse and eligibility gate |
| `.agro/skills/spec/references/retro.md` | line 29 | Cites the retro probe by name |
| `.agro/evals/probes/roles-are-skills.sh` | line 16 | Requires `.agro/skills/retro/SKILL.md` |
| `.agro/evals/probes/wiki-compile-contract.sh` | lines 24 to 35 | Pins `compile.md` contract text |
| `.agro/evals/capability/tasks/CB-005-compile-a-lesson.md` | task spec | CB-005 re-score input |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/sync`, `/post-bridge`, `/blog`, `/fanout`, `/render-html` | Removed | The slash commands no longer resolve in any provider. |
| `/rlm`, `/weigh`, `/interview`, `/imagine`, `/strategic-proposal` | Removed | The slash commands no longer resolve in any provider. |
| `/retro` argument hint | Changed | `--focus <subsystem>` goes away. `--task`, `--dry-run`, and `auto-approve` stay. |
| `/retro` report | Changed | No hypothesis table, no subsystem lens, no terminal status line. Each promotion line carries a verdict and confidence tag. |
| `/wiki compile` step 1 | Changed | The documented line template matches the new `/retro` tag. The step 2 gate stays unchanged. |
| `/council` | Changed | The related-skills table and the weighting path drop `/weigh` and `/strategic-proposal`. |

## Storage

N/A. The task deletes files and edits Markdown and shell probes. It adds no persistence layer. `.agro/skills.lock` stays JSON, and the task only deletes keys from it.

## Architectural Decisions

- The canonical source is `.agro/skills/`. The advisor never edits `.claude/skills` or `.agents/skills`, because both are symlinks.
- The retirement standard is the CB-003 and CB-004 rule: unproven machinery goes, proven nodes stay. `/benchmark` stays.
- `/retro` stays report-only. It writes no file and keeps no ledger.
- The promotion line becomes the single carrier of verdict and confidence. `/wiki compile` keeps its eligibility table, so its write gate does not change.
- The retro probe changes before the skill text. This order keeps the probe green at each commit after US-005.
- History files keep their references: `CHANGELOG.md`, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, and `.agro/tasks/archive/**`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | Red against the current `SKILL.md`; green after US-005; two fault injections | US-004, US-005, issue DoD 6 |
| `.agro/evals/probes/wiki-compile-contract.sh` | Exits 0 after US-005 | Issue DoD 5 |
| `.agro/evals/probes/roles-are-skills.sh` | Exits 0 after US-005 | Issue DoD 4 |
| `.agro/evals/probes/audit-stale-references.sh` | Exits 0 after US-002 | US-002 |
| `.agro/skills/eval/run.sh` | Full suite exits 0; 159 probes | Issue DoD 1 |
| `.agro/scripts/link-providers.sh --check` | Exits 0 | Issue DoD 8 |
| `jq` on `.agro/skills.lock` | Parses; holds no retired key | Issue DoD 9 |
| Dangling-reference oracle | Returns no line | Issue DoD 3 |
| `/benchmark` on CB-005 | Score of 1.33 or more | Issue DoD 7 |

The dangling-reference oracle runs from the repository root:

```bash
git grep -n -E '(skills/|`/|\[/)(sync|post-bridge|blog|fanout|render-html|rlm|weigh|interview|imagine|strategic-proposal)([^a-z0-9-]|$)|(sync-skill-contract|rlm-context-budget|post-bridge-publish-confirmation|weigh-scorer-contract)' -- . \
  ':!CHANGELOG.md' ':!docs/rfcs/preserved-changelog-rationale.md' \
  ':!.agro/evals/RESULTS.md' ':!.agro/evals/decisions' ':!.agro/tasks/archive'
```

## Design Principles

- Delete obsolete paths. Leave no dormant alternative and no stub skill.
- Keep one source of truth. Each retired skill leaves no copy in a mirror.
- Pin short semantic fragments in probes, per `.agro/evals/AGENTS.md`.
- Drive each changed probe through its REGRESSION branch on a disposable copy before it lands.
- Keep the smallest change that satisfies the Definition of Done. Do not redesign `/retro` beyond the listed strip.

## Out of Scope

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing the eligibility gate in `/wiki compile`.
- Changing the `.agro/tasks/` layout or the advisor and worker model of ADR #989.
- Writing the companion ADR "retire unproven skill machinery, not proven nodes".
- Edits in `mifunedev/agro-web`. The advisor records any needed public-documentation change as a follow-up issue.

## Open Questions

1. The issue cites `bash .agro/evals/run.sh`. That file does not exist. The plan uses `bash .agro/skills/eval/run.sh`, per `.agro/skills/eval/SKILL.md` line 26. Confirm this substitution.
2. The issue requires a `[verdict · confidence]` tag. The current tag is `[<subsystem> · <confidence> · tier]`. The plan uses `[<verdict> · <confidence> · harden|proceduralize|eval]` and edits `compile.md` step 1 to match. Confirm that this step 1 edit is not a change to the write gate.
4. `.agro/knowledge/raw/2026-06-27-recursive-language-models.md` and `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md` line 48 name `/weigh`, `/rlm`, and `/imagine`. Raw snapshots record history. Default: add `.agro/knowledge/raw` to the oracle exclusions, and annotate the source page and the pattern page as retired. Confirm the exclusion and the annotation.
4. `.agro/knowledge/raw/2026-06-27-recursive-language-models.md` and `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md` line 48 name `/weigh`, `/rlm`, and `/imagine`. Raw snapshots record history. Default: add `.agro/knowledge/raw` to the oracle exclusions, and annotate the source page and pattern page as retired. Confirm.
5. The oracle matches `/blog` inside URLs such as `mifunedev/agro-web/tree/main/blog` in `docs/intro.md` and `docs/resources.md`. Default: keep those URLs and tighten the oracle to exclude URL matches during US-006.

## Acceptance Criteria

- [ ] All ten skill directories do not exist, and `.agro/skills/benchmark/` and `.agro/skills/retro/SKILL.md` exist.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 with 159 probes.
- [ ] The dangling-reference oracle returns no line outside the listed history files.
- [ ] `retro-deterministic-contract.sh`, `wiki-compile-contract.sh`, and `roles-are-skills.sh` each exit 0.
- [ ] The rewritten retro probe exits 1 under each of the two recorded fault injections.
- [ ] The CB-005 score is 1.33 or more.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the lock holds no retired key.

## Lessons

Filled by the advisor before undraft.
