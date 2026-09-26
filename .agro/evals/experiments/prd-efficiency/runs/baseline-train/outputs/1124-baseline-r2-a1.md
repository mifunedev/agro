# PRD: Retire unproven skill machinery

Status: BLOCKED

## User Stories

### US-001: Retire the zero-cascade skills

**Description:** As the operator, I want the five orphaned skills removed so that the corpus drops an unused topology and publishing path.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` do not exist.
- [ ] The probes `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` do not exist.
- [ ] `jq -e '.skills | has("post-bridge") or has("render-html") | not' .agro/skills.lock` exits 0.
- [ ] `git grep -nE 'skills/(sync|post-bridge|blog|fanout|render-html)\b|/(post-bridge|render-html|fanout)\b'` returns no line outside the exclusion set that `## Architectural Decisions` defines.

### US-002: Retire `/rlm` and `/weigh`

**Description:** As the operator, I want the never-exercised recursion and trajectory-scoring skills removed so that no probe guards machinery with no scored run on disk.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm` and `.agro/skills/weigh` do not exist.
- [ ] The probes `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` do not exist.
- [ ] `.agro/evals/probes/audit-stale-references.sh` no longer lists `.agro/skills/weigh` as a caller, and `bash .agro/skills/eval/run.sh --probe audit-stale-references` reports PASS.
- [ ] `.agro/skills/council/SKILL.md` and `.agro/skills/council/references/scenarios.md` hold no `/weigh` route and no `../weigh/` link.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` and the comment in `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh` name no retired skill.
- [ ] `.agro/knowledge/source/recursive-language-models.md` holds no path under `.agro/skills/rlm/` or `.agro/skills/weigh/`, per the answer to open question 3.
- [ ] `git grep -nE 'skills/(rlm|weigh)\b|/(rlm|weigh)\b'` returns no line outside the exclusion set.

### US-003: Retire `/interview`, `/imagine`, and `/strategic-proposal`

**Description:** As the operator, I want duplicate planning surfaces removed so that `/prd`, `/plan`, `/spec plan`, and `/council` stay the only doors.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` do not exist.
- [ ] `jq -e '.skills | has("interview") or has("strategic-proposal") | not' .agro/skills.lock` exits 0.
- [ ] `.agro/skills/plan/SKILL.md:207` and `.agro/skills/spec/references/plan.md:35` name no `/imagine` route.
- [ ] The `planning_command` regex in `.agro/evals/probes/advisor-execution-contract.sh` no longer lists `imagine`, and `bash .agro/skills/eval/run.sh --probe advisor-execution-contract` reports PASS.
- [ ] `.agro/skills/council/SKILL.md`, `.agro/skills/council/references/scenarios.md`, and `crons/heartbeat.md` name no `/strategic-proposal` route.
- [ ] `.claude/protected-paths.txt` holds no `strategic-proposal` entry, per the answer to open question 1, and `bash .agro/skills/eval/run.sh --probe protected-paths-resolve` reports PASS.
- [ ] `git grep -nE 'skills/(interview|imagine|strategic-proposal)\b|/(interview|imagine|strategic-proposal)\b'` returns no line outside the exclusion set.

### US-004: Rewrite the `/retro` contract probe first

**Description:** As the operator, I want the `/retro` probe to pin only the three invariants so that the ceremony can go and the invariants stay.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/retro-deterministic-contract.sh` pins no literal for the 8-column hypothesis table, the five-subsystem lens, `STATUS: RETRO-DONE`, `--focus`, `references/report-schema.md`, or `scripts/validate-retro-report.sh`.
- [ ] The probe asserts invariant 1: the report-only sentence `It emits its report to the terminal and writes no file at all.` and the anti-pattern `Inventing a file to save a lesson in.` exist in `.agro/skills/retro/SKILL.md`.
- [ ] The probe asserts invariant 2: `.agro/skills/retro/SKILL.md` holds the no-double-write rule against an existing probe under `.agro/evals/probes/`.
- [ ] The probe asserts invariant 3: the per-lesson `[<verdict> · <confidence>]` tag and the promotion-line template exist in `.agro/skills/retro/SKILL.md`, and the promotion-line template is byte-identical to the template in `.agro/skills/wiki/references/compile.md`.
- [ ] The probe keeps the existing `ro-a`, `ro-b`, `ro-c`, and `ro-d` memory-tier and context-tier guards.
- [ ] The probe reads the skill directory from a `RETRO_SKILL_DIR` override that defaults to `.agro/skills/retro`.
- [ ] Fault injection: with `RETRO_SKILL_DIR` set to a copy of the rewritten skill with the promotion-line template removed, the probe exits 1 and prints `REGRESSION`. `progress.txt` records the command and the exit code.
- [ ] Fault injection: with `RETRO_SKILL_DIR` set to a copy with the report-only sentence removed, the probe exits 1. `progress.txt` records the command and the exit code.

### US-005: Strip the `/retro` ceremony

**Description:** As a session-closing agent, I want a short `/retro` procedure so that I report each lesson with a verdict and a confidence.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` holds no falsifiability gate, no 8-column hypothesis table, no five-subsystem lens, no `STATUS: RETRO-DONE` line, and no `--focus` flag.
- [ ] `.agro/skills/retro/references/report-schema.md` does not exist.
- [ ] `.agro/skills/retro/scripts/validate-retro-report.sh` does not exist, per the answer to open question 4, and neither `.agro/scripts/link-providers.sh` nor `.agro/scripts/__tests__/hermes-links.test.ts` names it.
- [ ] `.agro/skills/retro/SKILL.md` keeps `--task <slug>`, `--dry-run`, and `auto-approve`.
- [ ] `.agro/skills/wiki/references/compile.md` step 1 names the report section that carries the per-lesson verdict. The eligibility table under step 2 is unchanged.
- [ ] `.agro/skills/spec/references/retro.md` and `.agro/skills/spec/references/execute.md` step 8 describe `/retro` without the retired ceremony terms.
- [ ] `bash .agro/skills/eval/run.sh --probe retro-deterministic-contract` reports PASS.
- [ ] `bash .agro/skills/eval/run.sh --probe roles-are-skills` reports PASS.
- [ ] `bash .agro/skills/eval/run.sh --probe wiki-compile-contract` reports PASS.

### US-006: Verify and record the retirement

**Description:** As the advisor, I want the suite, links, lock file, and CB-005 checked so that the pull request carries evidence for each done item.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] `ls .agro/evals/probes/*.sh | wc -l` prints `159`. The base commit `ad74078` holds 163 probes.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0, and `find .claude/skills .agents/skills -xtype l` prints nothing.
- [ ] `jq -e . .agro/skills.lock` exits 0, and no `installed_paths` entry names a retired directory.
- [ ] The dangling-reference sweep in `## Test Plan (TDD)` prints nothing.
- [ ] `pnpm vitest run .agro/scripts/__tests__/hermes-links.test.ts` exits 0.
- [ ] A `/benchmark` run re-scores CB-005 at 1.33 or higher in `.agro/evals/capability/RESULTS.md`, with a loosened `/retro` report as the chain input.
- [ ] `CHANGELOG.md` holds an entry under `## [Unreleased]` that names the ten retired skills and the `/retro` ceremony removal.

## Summary

Issue 1124 retires ten skills and strips the `/retro` ceremony. The retirement standard comes from the CB-003 and CB-004 rows in `.agro/evals/capability/RESULTS.md`. The standard retires machinery that no benchmark measured. The standard keeps machinery that produced results. `/benchmark` stays.

Verified current state at commit `ad74078`:

- All ten skill directories exist under `.agro/skills/`. `.claude/skills` is a symlink to `../.agro/skills`, so no mirror needs a separate edit.
- `.agro/evals/probes/` holds 163 probe scripts. Four of them guard retiring skills: `sync-skill-contract.sh`, `post-bridge-publish-confirmation.sh`, `rlm-context-budget.sh`, and `weigh-scorer-contract.sh`.
- `.agro/skills.lock` holds entries for `interview`, `post-bridge`, `render-html`, and `strategic-proposal`. The lock holds no entry for the other six retiring skills.
- `.claude/protected-paths.txt:29` lists `strategic-proposal`. The file header says: remove an obsolete entry in a separate PR with a CHANGELOG entry.
- `.agro/evals/probes/retro-deterministic-contract.sh` pins 8 literals in `.agro/skills/retro/SKILL.md` and runs `scripts/validate-retro-report.sh` against three fixtures.
- `.agro/scripts/link-providers.sh:22` and `.agro/scripts/__tests__/hermes-links.test.ts:114` require `.agro/skills/retro/scripts/validate-retro-report.sh` as an executable.
- `.agro/skills/wiki/references/compile.md:65` holds the promotion-line template `- <principle> [<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis: <one clause>`. Step 1 reads the verdict from the `## Hypotheses` table. The eligibility table at lines 70 to 76 gates on verdict and confidence.
- The issue names `bash .agro/evals/run.sh`. That path does not exist. The suite runner is `.agro/skills/eval/run.sh`.

The selected approach runs three waves. Waves 1 and 2 delete directories and remove each inbound reference. Wave 3 rewrites the `/retro` probe first, then rewrites `/retro` against that probe. A final story runs the whole suite and re-scores CB-005.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/{sync,post-bridge,blog,fanout,render-html,rlm,weigh,interview,imagine,strategic-proposal}/` | whole directory | Retired skill sources. |
| `.agro/evals/probes/{sync-skill-contract,post-bridge-publish-confirmation,rlm-context-budget,weigh-scorer-contract}.sh` | whole file | Retired probes. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | literal list, fixture runs | Rewritten to pin the three preserved invariants. |
| `.agro/evals/probes/audit-stale-references.sh` | caller list, line 30 | Drop `.agro/skills/weigh`. |
| `.agro/evals/probes/advisor-execution-contract.sh` | `planning_command`, line 151 | Drop `imagine`. |
| `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh` | comment, line 14 | Drop the `rlm/` and `weigh/` mention. |
| `.agro/skills/retro/SKILL.md` | frontmatter, procedure, anti-patterns | Rewritten without the ceremony. |
| `.agro/skills/retro/references/report-schema.md` | whole file | Deleted. |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | whole file | Deleted, per open question 4. |
| `.agro/scripts/link-providers.sh` | `required_execs` | Drop the validator path. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | fixture `files` list | Drop the validator path. |
| `.agro/skills/wiki/references/compile.md` | step 1 text, line 65 template | Point step 1 at the new verdict carrier. |
| `.agro/skills/spec/references/retro.md` | "Why a wrapper" section | Remove retired ceremony terms. |
| `.agro/skills/spec/references/execute.md` | step 8, line 558 | Remove retired ceremony terms. |
| `.agro/skills/council/SKILL.md` | lines 141 to 159 | Drop `/strategic-proposal` and `/weigh` rows and the explicit-weighting section. |
| `.agro/skills/council/references/scenarios.md` | lines 74, 80, 93 to 98 | Drop the same routes. |
| `.agro/skills/prompt-miner/references/scoring.md` | line 104 | Drop the `weigh` comparison. |
| `.agro/skills/plan/SKILL.md` | line 207 | Drop the `/imagine` route. |
| `.agro/skills/spec/references/plan.md` | `--plan` row, line 35 | Drop the `/imagine` example. |
| `.agro/knowledge/source/recursive-language-models.md` | lines 17 to 32 | Remove live paths to retired scripts, per open question 3. |
| `crons/heartbeat.md` | line 73 | Drop `/strategic-proposal`. |
| `.claude/protected-paths.txt` | line 29 | Drop `strategic-proposal`, per open question 1. |
| `.agro/skills.lock` | `skills.interview`, `skills.post-bridge`, `skills.render-html`, `skills.strategic-proposal` | Delete the four entries. |
| `.agro/evals/capability/RESULTS.md` | CB-005 row, suite score comment | Re-scored through `/benchmark`. |
| `CHANGELOG.md` | `## [Unreleased]` | New entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slash commands `/sync`, `/post-bridge`, `/blog`, `/fanout`, `/render-html`, `/rlm`, `/weigh`, `/interview`, `/imagine`, `/strategic-proposal` | Removed | Each coding harness stops listing the ten skills. |
| `/retro` arguments | Changed | The skill drops `--focus <subsystem>`. `--task <slug>`, `--dry-run`, and `auto-approve` stay. |
| `/retro` report | Changed | The 8-column table and `STATUS: RETRO-DONE` go. A per-lesson `[<verdict> · <confidence>]` list and the promotion line stay. |
| `/wiki compile` input | Changed | Step 1 reads the verdict from the new per-lesson list. The write gate does not change. |
| Public site `mifunedev/agro-web` | Review | The implementation owner checks the site for pages that name a retired skill. A matching change goes to that repository, per open question 5. |

## Storage

N/A. The task deletes files and edits Markdown, shell probes, and JSON. The task adds no persistence layer.

## Architectural Decisions

- **Retirement standard.** The CB-004 row is the source of truth: retire what no benchmark measured, keep what produced results.
- **Canonical source.** Edit only under `.agro/`, `.claude/protected-paths.txt`, `crons/`, and `CHANGELOG.md`. `.claude/skills` and `.agents/skills` are symlinks and need no edit.
- **Probe first for `/retro`.** US-004 lands before US-005. The rewritten probe fails against the current `SKILL.md` until US-005 lands. The two stories ship in one pull request.
- **One promotion-line template.** The template in `.agro/skills/retro/SKILL.md` and the template in `.agro/skills/wiki/references/compile.md` stay byte-identical. The probe enforces this equality.
- **Recommended answer to open question 2.** Keep the line-65 template byte-identical. The `<subsystem>` slot carries the knowledge-base subsystem that compile step 3 already uses. Carry the verdict in a new per-lesson list `- <lesson> [<verdict> · <confidence>]`.
- **Dangling-reference exclusion set.** The sweep ignores `CHANGELOG.md`, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, `.agro/tasks/archive/**`, `.agro/plans/archive/**`, and `.agro/knowledge/raw/**`. The last two entries are additions to the issue's set; see open question 3.
- **Ownership.** One implementation owner holds `prd.json` and `progress.txt`. US-002 and US-003 both edit `.agro/skills/council/`, so US-003 depends on US-002.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | PASS on the rewritten skill. REGRESSION without the promotion-line template. REGRESSION without the report-only sentence. REGRESSION when the two templates differ. | Invariants 1, 2, and 3, and the failure branch. |
| `.agro/evals/probes/roles-are-skills.sh` | PASS | `.agro/skills/retro/SKILL.md` survives. |
| `.agro/evals/probes/wiki-compile-contract.sh` | PASS | The compile contract survives the step 1 edit. |
| `.agro/evals/probes/protected-paths-resolve.sh` | PASS | No protected entry names a deleted skill. |
| `.agro/evals/probes/audit-stale-references.sh` | PASS | The caller list names no deleted path. |
| `.agro/evals/probes/advisor-execution-contract.sh` | PASS | The planning-command regex still guards `/delegate`. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | existing cases | `link-providers.sh` runs without the validator path. |
| `.agro/skills/eval/run.sh` | full suite | Exit 0 with 159 probes. |
| Dangling-reference sweep | `git grep -nE 'skills/(sync\|post-bridge\|blog\|fanout\|render-html\|rlm\|weigh\|interview\|imagine\|strategic-proposal)\b\|/(post-bridge\|render-html\|fanout\|rlm\|weigh\|interview\|imagine\|strategic-proposal)\b' -- . <exclusion pathspecs>` | No line prints. |
| Retro ceremony sweep | `git grep -nE 'RETRO-DONE\|report-schema\|validate-retro-report' -- . <exclusion pathspecs>` | No line prints. |
| CB-005 | `/benchmark` scoring pass | Score is 1.33 or higher. |

The `/sync` and `/blog` routes share their names with common words. The owner reviews `/sync` and `/blog` hits by hand and records each kept hit in `progress.txt`.

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth per contract. The promotion-line template has one text in two files, and a probe holds them equal.
- Prove each probe can fail. Run each rewritten probe against an injected fault.
- Keep the change to retirement. Add no replacement skill and no new abstraction.
- Add no explanatory comment to tracked code.

## Out of Scope

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing the `/wiki compile` eligibility table or write gate.
- Changing the `.agro/tasks/` layout or the advisor and worker model from ADR 989.
- Rewriting `.agro/evals/RESULTS.md` history rows by hand. The suite runner owns that file.
- Writing the companion ADR. The issue proposes the ADR as separate work.

## Open Questions

1. **Blocking.** `.claude/protected-paths.txt` says to remove an obsolete entry "in a separate PR with a CHANGELOG entry explaining why". Issue 1124 retires `strategic-proposal` in this task.
   A. Remove the entry in a separate pull request that merges before this task.
   B. Remove the entry in this pull request and record the override in `CHANGELOG.md`.
   C. Keep `/strategic-proposal` in this task and retire the skill later.
2. **Blocking.** Invariant 3 keeps "the per-lesson `[verdict · confidence]` tag" and "the exact promotion line" at `compile.md:65`. The current line carries `[<subsystem> · <confidence> · …]`, and the verdict lives only in the table that this task deletes.
   A. Keep the line-65 template byte-identical. Add a per-lesson `[<verdict> · <confidence>]` list. Edit compile step 1 to read the list. The plan recommends answer A.
   B. Change the template to `[<verdict> · <confidence> · harden|proceduralize|eval]` and edit `compile.md:65` in the same commit.
3. The knowledge pages `.agro/knowledge/source/recursive-language-models.md` and `.agro/knowledge/raw/2026-06-27-recursive-language-models.md` name `/rlm` and `/weigh`. `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md:48` quotes `/imagine`.
   A. Treat `raw/` snapshots and pattern quotes as history, and add both paths to the exclusion set. Edit the `source/` page to drop live paths.
   B. Edit every page.
4. The issue does not name `.agro/skills/retro/scripts/validate-retro-report.sh`. The validator checks the 8-column table and `STATUS: RETRO-DONE`, which this task removes.
   A. Delete the validator and its two references. The plan recommends answer A.
   B. Rewrite the validator for the new report shape.
5. Does `mifunedev/agro-web` hold pages that name a retired skill? The operator confirms the owner of that follow-up change.

## Acceptance Criteria

- [ ] `bash .agro/skills/eval/run.sh` exits 0, and the probe count drops from 163 to 159.
- [ ] None of the ten skill directories exists under `.agro/skills/`.
- [ ] The dangling-reference sweep prints no line outside the exclusion set.
- [ ] The `roles-are-skills`, `wiki-compile-contract`, and `retro-deterministic-contract` probes report PASS.
- [ ] `progress.txt` records two fault-injection runs in which the rewritten retro probe exits 1.
- [ ] `.agro/evals/capability/RESULTS.md` holds a CB-005 score of 1.33 or higher from a run after the change.
- [ ] `link-providers.sh` exits 0, and `find .claude/skills .agents/skills -xtype l` prints nothing.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the lock names no retired skill.

## Lessons

Filled by the advisor before undraft.
