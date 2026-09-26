# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Rewrite the retro contract probe first

**Description:** As a maintainer, I want the retro probe to pin the lean contract so that the ceremony cut stays guarded.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/retro-deterministic-contract.sh` pins none of these literals: the 8-column table header, `STATUS: RETRO-DONE`, `--focus`, `report-schema.md`, `Bypassing the schema/scripts`.
- [ ] The probe asserts the report-only contract line `It emits its report to the terminal and writes no file at all.` in `.agro/skills/retro/SKILL.md`.
- [ ] The probe asserts the no-double-write rule: `/retro` cites an existing probe id and skips the lesson.
- [ ] The probe asserts the promotion-line form that `.agro/skills/wiki/references/compile.md` documents at line 65, including the `[<verdict> · <confidence> · harden|proceduralize|eval]` tag.
- [ ] The probe keeps the checks `ro-a`, `ro-b`, `ro-c`, and `ro-d` against the deleted memory and context tiers.
- [ ] The implementer injects a fault into a disposable copy of `.agro/skills/retro/SKILL.md` that drops the promotion line. The probe exits 1 and names the missing literal. The implementer records the output in `progress.txt`.
- [ ] `bash .agro/skills/eval/run.sh --probe retro-deterministic-contract` reports PASS after US-002 lands.

### US-002: Strip the retro ceremony

**Description:** As an operator, I want a shorter `/retro` so that session lessons cost less to produce.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` contains no falsifiability gate, no 8-column hypothesis table, no five-subsystem lens, no `--focus` flag, and no `STATUS: RETRO-DONE` line.
- [ ] `.agro/skills/retro/references/report-schema.md` is absent.
- [ ] `.agro/skills/retro/scripts/validate-retro-report.sh` is absent, or the script validates only the promotion-line form. See Open Question 1.
- [ ] Each promotion line in `.agro/skills/retro/SKILL.md` matches the form in `.agro/skills/wiki/references/compile.md` line 65.
- [ ] The Anti-patterns section keeps the literal `Inventing a file to save a lesson in.`
- [ ] `bash .agro/skills/eval/run.sh --probe roles-are-skills` reports PASS.
- [ ] `bash .agro/skills/eval/run.sh --probe wiki-compile-contract` reports PASS.
- [ ] A sample promotion line from the new `/retro` example parses under the compile.md step 1 form and meets the step 2 eligibility table at line 76.

### US-003: Retire the wave 1 skills

**Description:** As a maintainer, I want the five zero-cascade skills deleted so that the corpus holds only live skills.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` are absent.
- [ ] The probes `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` are absent.
- [ ] `.agro/skills.lock` parses under `jq -e .` and holds no `post-bridge` or `render-html` entry.
- [ ] `.agro/evals/probes/docs-build-fast-path.sh` keeps its line 67 guard against a root blog tree.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-004: Retire the wave 2 skills

**Description:** As a maintainer, I want the five cascading skills and their references deleted so that no link dangles.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm`, `.agro/skills/weigh`, `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` are absent.
- [ ] The probes `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` are absent.
- [ ] `.agro/skills.lock` parses under `jq -e .` and holds no `interview` or `strategic-proposal` entry.
- [ ] `.agro/evals/probes/audit-stale-references.sh` no longer lists `.agro/skills/weigh` at line 30, and the probe reports PASS.
- [ ] `.agro/skills/council/SKILL.md` lines 141 to 153 hold no link to `/strategic-proposal` or `/weigh`.
- [ ] `.agro/skills/plan/SKILL.md` line 207 and `.agro/skills/spec/references/plan.md` line 35 hold no `/imagine` reference.
- [ ] `crons/heartbeat.md` line 73 holds no `/strategic-proposal` reference.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-005: Verify the suite and re-score CB-005

**Description:** As an advisor, I want whole-suite evidence so that the retirement meets the Definition of Done.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The probe count in `.agro/evals/RESULTS.md` drops by exactly 4 against the base commit.
- [ ] The dangling-reference `git grep` in the Test Plan returns no match outside the excluded paths.
- [ ] `.agro/evals/capability/RESULTS.md` holds a new CB-005 score of 1.33 or higher.
- [ ] `CHANGELOG.md` holds one entry that names the ten retired skills and the `/retro` ceremony cut.

## Summary

Issue #1124 retires ten skills and strips the `/retro` ceremony. The issue applies the standard of rows CB-003 and CB-004 in `.agro/evals/capability/RESULTS.md`: retire machinery that nobody measured, and keep machinery that produced results.

Verified state at the base commit:

- All ten skill directories exist under `.agro/skills/`.
- The four probes named in the issue exist under `.agro/evals/probes/`.
- `.agro/skills.lock` holds entries for `interview` (line 49), `post-bridge` (line 59), `render-html` (line 99), and `strategic-proposal` (line 109).
- `.agro/evals/probes/retro-deterministic-contract.sh` pins 8 literals in `.agro/skills/retro/SKILL.md`. The probe also runs `.agro/skills/retro/scripts/validate-retro-report.sh` against three fixture reports.
- `.agro/skills/wiki/references/compile.md` line 65 documents the promotion line with a `<subsystem>` slot. The current `/retro` tag also uses `<subsystem>`. Neither form carries the verdict.
- `.agro/evals/probes/roles-are-skills.sh` line 16 requires the `retro` skill to exist.
- The runner that the issue names does not exist. The runner is `.agro/skills/eval/run.sh`.
- Line counts for `rlm` and `weigh` in the issue count `SKILL.md` only. The tracked directories hold 1357 and 1177 lines.

Selected approach: rewrite the retro probe first, because the probe blocks the ceremony cut. Then cut the ceremony. Then delete the wave 1 skills, which have no cascade. Then delete the wave 2 skills and fix each inbound reference. Close with the whole suite and the CB-005 re-score.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | literal list, fixture reports `ro-e` and `ro-f` | Pins the retro contract; the first change |
| `.agro/skills/retro/SKILL.md` | frontmatter `argument-hint`, `## Deterministic contract`, `## The scientific loop`, `## The five-subsystem lens`, steps 5a and 6 | The ceremony to strip |
| `.agro/skills/retro/references/report-schema.md` | whole file | Deleted |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | whole file | Deleted or reduced; see Open Question 1 |
| `.agro/skills/wiki/references/compile.md` | step 1 at line 65, step 2 at line 76 | Reads the promotion line; the write gate stays unchanged |
| `.agro/evals/probes/wiki-compile-contract.sh` | `need` assertions | Must stay green |
| `.agro/evals/probes/roles-are-skills.sh` | line 16 skill list | Requires `retro` to survive |
| `.agro/evals/probes/audit-stale-references.sh` | line 30 | Lists `.agro/skills/weigh` |
| `.agro/skills.lock` | four retired entries | Skill lock file |
| `.agro/skills/council/SKILL.md` | lines 141 to 153 | Links `/strategic-proposal` and `/weigh` |
| `.agro/skills/plan/SKILL.md` | line 207 | Names `/imagine` |
| `.agro/skills/spec/references/plan.md` | line 35 | Names `/imagine` output as `--plan` input |
| `crons/heartbeat.md` | line 73 | Names `/strategic-proposal` |
| `.agro/scripts/link-providers.sh` | `--check` | Verifies provider symlinks |
| `.agro/skills/eval/run.sh` | whole suite, `--probe <id>` | Eval runner; rewrites `.agro/evals/RESULTS.md` |
| `.agro/evals/capability/RESULTS.md` | row CB-005 | Capability score to re-score |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slash commands | Removed | `/sync`, `/post-bridge`, `/blog`, `/fanout`, `/render-html`, `/rlm`, `/weigh`, `/interview`, `/imagine`, `/strategic-proposal` |
| `/retro` arguments | Removed flag | `--focus` goes away; `--task`, `--dry-run`, and `auto-approve` stay |
| `/retro` report | Changed format | No hypothesis table and no terminal status line; the promotion line carries `[verdict · confidence · triage]` |
| Provider mirrors | Removed symlinks | `link-providers.sh --check` confirms no broken link |

## Storage

N/A. The task deletes files and edits Markdown and shell probes. The task adds no persistent state.

## Architectural Decisions

- The canonical source of each skill is `.agro/skills/<name>/`. Delete the canonical directory, then run `bash .agro/scripts/link-providers.sh --check`. Do not edit a provider mirror.
- `/benchmark` stays. The skill produced the retirement standard and runs as step 9.3 of `/spec execute`.
- `/retro` stays report-only and writes no file.
- `/wiki compile` keeps its write gate. The compile.md line 65 form changes its first tag slot from `<subsystem>` to `<verdict>` so that the tag carries the verdict. See Open Question 2.
- Order is binding: US-001, then US-002, then US-003 and US-004, then US-005. US-003 and US-004 touch disjoint paths except `.agro/skills.lock`. Run them in sequence or give one worker both lock edits.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | new literals; fault injection that drops the promotion line | US-001 |
| `.agro/evals/probes/roles-are-skills.sh` | `retro` exists | US-002 |
| `.agro/evals/probes/wiki-compile-contract.sh` | compile contract | US-002 |
| `.agro/evals/probes/audit-stale-references.sh` | no stale `weigh` path | US-004 |
| `.agro/evals/probes/docs-build-fast-path.sh` | root blog guard stays | US-003 |
| `.agro/skills/eval/run.sh` | whole suite exits 0; probe count drops by 4 | US-005 |
| `.agro/scripts/link-providers.sh` | `--check` exits 0 | US-003, US-004 |
| dangling-reference grep | `git grep -nE '(skills/\|/)(sync\|post-bridge\|blog\|fanout\|render-html\|rlm\|weigh\|interview\|imagine\|strategic-proposal)\b'` with the excluded paths as pathspecs; review each hit by hand | US-005 |

The dangling-reference grep matches unrelated text, such as the agro-web blog links in `docs/intro.md` and `docs/resources.md`. Keep a hit only when the hit names a retired skill.

## Design Principles

- Retire machinery that nobody measured. Keep machinery that produced results.
- Keep one source of truth: edit `.agro/` and let `link-providers.sh` own the mirrors.
- Delete obsolete paths. Leave no dormant alternative.
- Add no explanatory comment to tracked code.
- Drive the REGRESSION branch of each changed probe before it lands.

## Out of Scope

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing the `/wiki compile` write gate or its eligibility table.
- Changing the `.agro/tasks/` layout or the advisor and worker model of ADR #989.
- Editing CHANGELOG history, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/decisions/`, or archived tasks.
- Writing the companion ADR.

## Open Questions

1. Delete `.agro/skills/retro/scripts/validate-retro-report.sh`, or reduce the script to a promotion-line check? Recommendation: delete the script, and let the probe pin the line form.
2. Does the compile.md line 65 edit from `<subsystem>` to `<verdict>` count as a change to the `/wiki compile` write gate? Recommendation: no, because the eligibility table at line 76 stays unchanged.
3. Do tracked files under `.agro/knowledge/raw/`, `.agro/knowledge/source/`, `.agro/knowledge/patterns/`, and `.agro/plans/archive/` count as dangling references? The issue exclusion list omits them. Recommendation: keep raw snapshots and archived plans unchanged, and fix live pattern and source pages.
4. Does the mifunedev/agro-web repository list any retired skill? Public documentation needs a matching change when the site lists one.
5. What procedure re-scores CB-005? The row records a delegated `/retro` to `/wiki compile` run. The implementer needs `<CB-005 scoring procedure>` from the operator.

## Acceptance Criteria

- [ ] `bash .agro/skills/eval/run.sh` exits 0, and the probe count drops by exactly 4.
- [ ] The ten skill directories are absent under `.agro/skills/`.
- [ ] The dangling-reference grep returns no retired-skill hit outside the excluded paths.
- [ ] `roles-are-skills` and `wiki-compile-contract` report PASS.
- [ ] A promotion line from the new `/retro` example parses under compile.md step 1.
- [ ] `progress.txt` records the fault-injection output of the rewritten retro probe.
- [ ] CB-005 holds a score of 1.33 or higher.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the file holds no retired entry.

## Lessons

Filled by the advisor before undraft.
