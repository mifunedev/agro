# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Rewrite the retro contract probe first

**Description:** As the advisor, I want the retro probe to pin the reduced contract so that the ceremony removal lands against a red test.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/retro-deterministic-contract.sh` keeps its `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe no longer pins `STATUS: RETRO-DONE`, `--focus`, the 8-column hypothesis table header, or `references/report-schema.md`.
- [ ] The probe exits 1 when `.agro/skills/retro/SKILL.md` contains `STATUS: RETRO-DONE`, `--focus`, or `report-schema.md`.
- [ ] The probe keeps the report-only checks `ro-c` and `ro-d2` and the memory-tier checks `ro-a`, `ro-b`, and `ro-d`.
- [ ] The probe exits 1 when the promotion-line template in `.agro/skills/retro/SKILL.md` differs from the template line in `.agro/skills/wiki/references/compile.md`.
- [ ] The probe exits 1 when `.agro/skills/retro/SKILL.md` drops the `[verdict · confidence]` per-lesson tag.
- [ ] The probe exits 1 against the current `.agro/skills/retro/SKILL.md` at the base commit. The implementer records the exit code in `progress.txt`.

### US-002: Strip the retro ceremony

**Description:** As an operator, I want `/retro` to report lessons without ceremony so that a session close costs less and still feeds `/wiki compile`.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` contains no falsifiability gate, no 8-column hypothesis table, no five-subsystem lens, no `STATUS: RETRO-DONE`, and no `--focus` flag.
- [ ] `.agro/skills/retro/references/report-schema.md` is absent.
- [ ] `.agro/skills/retro/SKILL.md` keeps the sentence `It emits its report to the terminal and writes no file at all.`
- [ ] `.agro/skills/retro/SKILL.md` keeps the no-double-write rule against an existing probe.
- [ ] `.agro/skills/retro/scripts/validate-retro-report.sh` accepts a report that holds only tagged lessons and promotion lines.
- [ ] `.agro/skills/retro/scripts/validate-retro-report.sh` rejects a promotion line with no triage tag or no probe id.
- [ ] `bash .agro/evals/probes/retro-deterministic-contract.sh` exits 0.
- [ ] Fault injection on a disposable copy of `.agro/skills/retro/SKILL.md` that restores `STATUS: RETRO-DONE` makes the probe exit 1 with a message that names the literal.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh` exits 0.

### US-003: Retire the Wave 1 skills

**Description:** As a maintainer, I want to delete `sync`, `post-bridge`, `blog`, `fanout`, and `render-html` so that the corpus holds no orphaned or topology-dead skills.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` are absent.
- [ ] `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` are absent.
- [ ] `.agro/skills.lock` holds no `post-bridge` entry and no `render-html` entry.
- [ ] `jq -e . .agro/skills.lock` exits 0.
- [ ] `.agro/evals/probes/docs-build-fast-path.sh` keeps its `blog/` tree guard at line 67.

### US-004: Retire the Wave 2 skills and their callers

**Description:** As a maintainer, I want to delete five cascading skills and their callers so that no active skill routes to a retired skill.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm`, `.agro/skills/weigh`, `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` are absent.
- [ ] `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` are absent.
- [ ] `.agro/skills.lock` holds no `interview` entry and no `strategic-proposal` entry.
- [ ] `.agro/skills/council/SKILL.md` and `.agro/skills/council/references/scenarios.md` name neither `/weigh` nor `/strategic-proposal`.
- [ ] `.agro/skills/plan/SKILL.md` and `.agro/skills/spec/references/plan.md` do not name `/imagine`.
- [ ] `.agro/skills/prompt-miner/references/scoring.md`, `crons/heartbeat.md`, and `.claude/protected-paths.txt` name no retired skill.
- [ ] `.agro/evals/probes/audit-stale-references.sh` lists no `.agro/skills/weigh` caller.
- [ ] `bash .agro/evals/probes/audit-stale-references.sh` exits 0.

### US-005: Prove the retirement end to end

**Description:** As the advisor, I want one verification pass over the whole tree so that the Definition of Done in issue #1124 holds on evidence.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The probe count in `.agro/evals/RESULTS.md` is exactly 4 lower than the count at the base commit.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] Each symlink under `.claude/skills` and `.agents/skills` resolves.
- [ ] The dangling-reference sweep in the Test Plan prints no line.
- [ ] CB-005 in `.agro/evals/capability/RESULTS.md` records a score of 1.33 or higher from a run after US-002.
- [ ] `CHANGELOG.md` holds one entry for this change, and `bash .agro/evals/probes/changelog-entry-length.sh` exits 0.

## Summary

Issue #1124 retires ten skills and strips the `/retro` ceremony. The issue applies the CB-003 and CB-004 retirement standard in `.agro/evals/capability/RESULTS.md`. That standard retires machinery that nobody measured. `/benchmark` stays.

Verified current state:

- The ten skill directories exist under `.agro/skills/`. `.claude/skills` and `.agents/skills` are directory symlinks to `.agro/skills`. The retirement needs no per-skill mirror edit.
- Four probes guard retired skills: `sync-skill-contract.sh`, `post-bridge-publish-confirmation.sh`, `rlm-context-budget.sh`, and `weigh-scorer-contract.sh`.
- `.agro/skills.lock` holds entries for `interview`, `post-bridge`, `render-html`, and `strategic-proposal`. The lock holds no entry for the other six skills.
- `.agro/evals/probes/retro-deterministic-contract.sh` pins 8 literals in `.agro/skills/retro/SKILL.md`, including `STATUS: RETRO-DONE` and the `--focus` argument hint. The probe also runs `.agro/skills/retro/scripts/validate-retro-report.sh` against three fixture reports.
- `.agro/scripts/link-providers.sh` lists `validate-retro-report.sh` in `required_execs` at line 22. `.agro/scripts/__tests__/hermes-links.test.ts` lists the same path at line 114.
- `.agro/skills/wiki/references/compile.md` documents the promotion-line template at line 65. The eligibility table at line 76 gates on verdict and confidence. Section 1 of `compile.md` reads the `## Hypotheses` table of the report.
- The issue names `bash .agro/evals/run.sh`. No file exists at `.agro/evals/run.sh`. The probe runner is `.agro/skills/eval/run.sh`.

Selected approach: rewrite the retro probe first, then strip `/retro`, then delete Wave 1, then delete Wave 2 with its callers, then verify. The retro validator stays as the executable check. The plan narrows the validator to the preserved invariants. This choice keeps `link-providers.sh` and `hermes-links.test.ts` unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | literal list, fixture reports | Pins the reduced retro contract. Changes first. |
| `.agro/skills/retro/SKILL.md` | `argument-hint`, lens section, promotion rule, `STATUS: RETRO-DONE` | Loses the ceremony. Keeps the three invariants. |
| `.agro/skills/retro/references/report-schema.md` | whole file | Deleted. |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | report validator | Narrowed to tagged lessons and promotion lines. |
| `.agro/skills/wiki/references/compile.md` | template at line 65, eligibility table at line 76 | Parse target. The write gate stays unchanged. |
| `.agro/evals/probes/wiki-compile-contract.sh` | `need` assertions | Must stay green. |
| `.agro/evals/probes/roles-are-skills.sh` | skill list at line 16 | Requires `retro` to survive. |
| `.agro/skills.lock` | `interview`, `post-bridge`, `render-html`, `strategic-proposal` | Four entries removed. |
| `.agro/skills/council/SKILL.md` | lines 141, 142, 151 to 154 | Drops `/strategic-proposal` and `/weigh` routes. |
| `.agro/skills/council/references/scenarios.md` | lines 74, 80, 94, 95 | Drops `/strategic-proposal` and `/weigh` scenarios. |
| `.agro/skills/plan/SKILL.md` | line 207 | Drops `/imagine`. |
| `.agro/skills/spec/references/plan.md` | line 35 | Drops the `/imagine` example. |
| `.agro/skills/prompt-miner/references/scoring.md` | line 104 | Drops the `weigh` reference. |
| `crons/heartbeat.md` | line 73 | Drops the `/strategic-proposal` reference. |
| `.claude/protected-paths.txt` | line 29 | Drops `strategic-proposal`. |
| `.agro/evals/probes/audit-stale-references.sh` | caller list at line 30 | Drops `.agro/skills/weigh`. |
| `.agro/knowledge/source/recursive-language-models.md` | lines 17 to 32 | Cites `/weigh` and `/rlm` paths. See Open Questions. |
| `.agro/scripts/link-providers.sh` | `required_execs`, `--check` | Verifies provider links. |
| `.agro/skills/eval/run.sh` | probe runner | Writes `.agro/evals/RESULTS.md`. |
| `.agro/evals/capability/run.sh` | capability runner | Re-scores CB-005. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slash commands `/sync`, `/post-bridge`, `/blog`, `/fanout`, `/render-html` | removed | The skills no longer load in any harness. |
| Slash commands `/rlm`, `/weigh`, `/interview`, `/imagine`, `/strategic-proposal` | removed | The skills no longer load in any harness. |
| `/retro` arguments | changed | `/retro` drops the `--focus <subsystem>` flag. `--task`, `--dry-run`, and `auto-approve` stay. |
| `/retro` report | changed | The report has no hypothesis table and no `STATUS: RETRO-DONE` line. Promotion lines keep the template in `compile.md`. |
| `mifunedev/agro-web` skill pages | unknown | See Open Questions. |

## Storage

N/A. The change deletes files and edits text. No persistence layer changes. `.agro/skills.lock` is a JSON file, and the change only removes entries.

## Architectural Decisions

- `.agro/skills/` is the canonical source. The provider directories are symlinks, so the deletion propagates without a mirror edit.
- `compile.md` owns the promotion-line template. The retro probe compares the `/retro` template against `compile.md` byte for byte. This comparison proves that a reduced `/retro` line still parses.
- `/retro` stays report-only. `/wiki compile` stays the only durable pattern writer. The write gate in `compile.md` stays unchanged.
- The retro validator survives in a narrowed form. The probe needs an executable check for its fault injection.
- Historical records stay unchanged: `CHANGELOG.md`, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, and `.agro/tasks/archive/`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | red against the base `SKILL.md`; green after US-002 | The reduced retro contract. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | fault injection: restore `STATUS: RETRO-DONE` in a disposable copy | The failure branch names the literal. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | fault injection: change the promotion template in a disposable copy | The template comparison with `compile.md`. |
| `.agro/evals/probes/wiki-compile-contract.sh` | full run | `/wiki compile` contract stays intact. |
| `.agro/evals/probes/roles-are-skills.sh` | full run | `retro` survives as a skill. |
| `.agro/evals/probes/audit-stale-references.sh` | full run | No stale `weigh` caller. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | existing suite | The retro validator path still resolves. Runner: `<test command>`. |
| `.agro/skills/eval/run.sh` | full suite | Exit 0 and a probe count lower by exactly 4. |
| `.agro/scripts/link-providers.sh` | `--check` | Each provider symlink resolves. |
| sweep command below | no output | No dangling reference to a retired skill. |

The implementer runs this sweep from the repository root. The sweep must print no line:

```bash
git grep -nE '(^|[^a-z/.-])/(sync|post-bridge|blog|fanout|render-html|rlm|weigh|interview|imagine|strategic-proposal)\b|skills/(sync|post-bridge|blog|fanout|render-html|rlm|weigh|interview|imagine|strategic-proposal)\b' -- . ':!CHANGELOG.md' ':!docs/rfcs/preserved-changelog-rationale.md' ':!.agro/evals/RESULTS.md' ':!.agro/evals/decisions' ':!.agro/tasks/archive'
```

## Design Principles

- Retire what nobody measured. Keep what produced results.
- Change the guarding probe before the guarded text.
- Keep one source of truth for the promotion-line template: `compile.md`.
- Delete obsolete paths. Leave no dormant alternative.
- Edit only `.agro/` canonical sources. Never patch a provider mirror.
- Add no comments to tracked code.

## Out of Scope

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing the `/wiki compile` write gate.
- Changing the `.agro/tasks/` layout or the advisor and worker model from ADR #989.
- Writing the companion ADR named in the issue.
- Editing historical records listed in Architectural Decisions.

## Open Questions

1. Which slot replaces `<subsystem>` in the promotion line? The line at `compile.md:65` carries `<subsystem>`, and the issue removes the five-subsystem lens. Default: keep a free-text `<subsystem>` slot so that the template stays byte-identical.
2. Where does `/wiki compile` read the verdict after the hypothesis table goes? Section 1 of `compile.md` reads the `## Hypotheses` table. Default: carry the verdict in the per-lesson `[verdict · confidence]` tag, and edit only the reading step of `compile.md`. Confirm that this edit stays outside the write-gate non-goal.
3. What happens to `.agro/knowledge/source/recursive-language-models.md` and its raw snapshot under `.agro/knowledge/raw/`? Both cite `/weigh` and `/rlm`. Default: delete the source page, keep the raw snapshot, and update the wiki index at `<wiki index path>`.
4. Does the quoted example `/imagine` at line 48 of `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md` count as a dangling reference? Default: keep the example, because the example quotes a literal string.
5. Who runs the CB-005 re-score with `.agro/evals/capability/run.sh`, and does the score need operator review?
6. Does `mifunedev/agro-web` list any retired skill? The planner did not inspect that repository.
7. Which command runs `.agro/scripts/__tests__/hermes-links.test.ts`? The plan writes `<test command>`.

## Acceptance Criteria

- [ ] `bash .agro/skills/eval/run.sh` exits 0, and the probe count drops by exactly 4.
- [ ] The ten skill directories are absent.
- [ ] The dangling-reference sweep prints no line.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh` exits 0, and the retro probe proves the template match with `compile.md`.
- [ ] `progress.txt` records the exit code of each retro-probe fault injection.
- [ ] CB-005 scores 1.33 or higher.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the lock holds no retired entry.

## Lessons

Filled by the advisor before undraft.
