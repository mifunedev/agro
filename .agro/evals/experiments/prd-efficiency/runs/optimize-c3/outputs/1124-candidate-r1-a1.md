# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Retire the wave 1 skills

**Description:** As an operator, I want five orphaned skills deleted so that the corpus holds only live machinery.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` do not exist.
- [ ] The probes `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` do not exist.
- [ ] `jq -e . .agro/skills.lock` exits 0, and `.agro/skills.lock` holds no `post-bridge` or `render-html` entry.
- [ ] Each inbound reference outside the excluded paths is removed or rewritten. The listed files include `.agro/skills/retro/SKILL.md`, `docs/intro.md`, `docs/resources.md`, `docs/rfcs/rfc-runtime-support.md`, and `.agro/evals/probes/oh-devcontainer-restructure.sh`.
- [ ] `.agro/evals/probes/docs-build-fast-path.sh` exits 0.

### US-002: Retire the wave 2 skills

**Description:** As an operator, I want five cascading skills deleted so that no unmeasured machinery remains.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm`, `.agro/skills/weigh`, `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` do not exist.
- [ ] The probes `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` do not exist.
- [ ] `.agro/skills.lock` holds no `interview` or `strategic-proposal` entry.
- [ ] `.agro/skills/council/SKILL.md`, `.agro/skills/council/references/scenarios.md`, `.agro/skills/plan/SKILL.md`, `.agro/skills/spec/references/plan.md`, and `crons/heartbeat.md` name no retired skill.
- [ ] `.agro/evals/probes/audit-stale-references.sh` exits 0.

### US-003: Strip the retro ceremony

**Description:** As an operator, I want the retro ceremony removed so that the skill keeps only its proven node.

**Acceptance Criteria:**

- [ ] The first commit of this story changes only `.agro/evals/probes/retro-deterministic-contract.sh`.
- [ ] The rewritten probe pins the report-only contract, the no-double-write rule, and the promotion line that `.agro/skills/wiki/references/compile.md` parses.
- [ ] The rewritten probe exits 1 on a disposable copy of the skill that lacks the promotion line. The PR body records the command and the exit code.
- [ ] `.agro/skills/retro/SKILL.md` holds none of these literals: `STATUS: RETRO-DONE`, `--focus`, `report-schema.md`, `## The five-subsystem lens`, and the 8-column hypothesis header.
- [ ] `.agro/skills/retro/references/report-schema.md` does not exist.
- [ ] `.agro/evals/probes/roles-are-skills.sh` and `.agro/evals/probes/wiki-compile-contract.sh` exit 0.

## Summary

The corpus holds 37 skill directories under `.agro/skills`. The ten retiring skills have no benchmark row and no produced result. Four probes guard them. The /retro skill forces the only terminal status line in the corpus. The probe `.agro/evals/probes/retro-deterministic-contract.sh` pins 8 literals at lines 17-26, so the probe changes first.

The approach deletes the skill directories, their probes, and their `.agro/skills.lock` entries. The implementer then rewrites each inbound reference and relinks the provider mirrors with `bash .agro/scripts/link-providers.sh`. The /retro rewrite keeps the node and removes the ceremony. The /benchmark skill stays, because the retirement standard comes from its CB-003 and CB-004 rows in `.agro/evals/capability/RESULTS.md`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills.lock` | skill entries at lines 49-116 | Lock file that lists installed skills |
| `.agro/scripts/link-providers.sh` | provider symlink pass | Rebuilds provider mirrors after the deletions |
| `.agro/evals/probes/retro-deterministic-contract.sh` | literal list at lines 17-26, fixture report at lines 58-75 | Pins the current retro ceremony |
| `.agro/skills/retro/SKILL.md` | `argument-hint`, lines 72-90, lens at line 125 | Retro skill contract |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | report validator | Validates the 8-column report shape |
| `.agro/skills/wiki/references/compile.md` | promotion line at line 65, eligibility table at line 76 | Parser of the retro promotion line |
| `.agro/evals/probes/roles-are-skills.sh` | skill loop at line 16 | Requires the retro skill to exist |
| `.agro/evals/capability/RESULTS.md` | CB-005 row at line 17 | Capability score to re-score |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Slash commands | Removed | Ten slash commands leave every provider mirror |
| /retro arguments | Changed | The `--focus` flag leaves the `argument-hint` line |
| /retro output | Changed | The report drops the final `STATUS: RETRO-DONE` line and the hypothesis table |
| Public docs | Changed | The docs site in mifunedev/agro-web drops pages for retired skills |

## Storage

N/A. The change deletes tracked files and adds no persistent state.

## Architectural Decisions

- The retirement standard is "unproven, not disproven", from the CB-003 and CB-004 rows.
- The canonical source for each skill is its `.agro/skills` directory. The implementer never edits a provider mirror.
- The promotion line in `.agro/skills/wiki/references/compile.md` stays the interface between /retro and `/wiki compile`.
- `/wiki compile` keeps its write gate unchanged.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | new literals present; ceremony literals absent; fault injection returns 1 | Retro contract after the rewrite |
| `.agro/evals/probes/wiki-compile-contract.sh` | existing cases | Compile parser contract |
| `.agro/evals/probes/roles-are-skills.sh` | existing cases | Retro skill survives |
| `.agro/evals/probes/audit-stale-references.sh` | existing cases | No stale reference to `weigh` |
| `.agro/evals/probes/docs-build-fast-path.sh` | existing cases | No blog tree returns |
| Full suite | `bash .agro/skills/eval/run.sh` exits 0 | Probe count drops by exactly 4 |

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth for each policy.
- Change the probe before the prose it guards.
- Add no explanatory comments to tracked code.

## Out of Scope

Retiring /benchmark, /prompt-miner, /council, /prd, or /plan. Changing the `/wiki compile` write gate. Changing the task folder layout or the advisor and worker model from ADR #989. Writing the companion ADR.

## Open Questions

1. The promotion line at line 65 of `.agro/skills/wiki/references/compile.md` holds a `<subsystem>` slot. The issue retires the five-subsystem lens but keeps the exact line. Does the slot stay as a free-text label? Default: keep the slot as free text.
2. `.agro/skills/retro/scripts/validate-retro-report.sh` validates the 8-column table. Does the implementer delete the validator or reduce it to a promotion-line check? Default: reduce it.
3. The runner named in the issue does not exist at the cited path. The plan uses `bash .agro/skills/eval/run.sh`. Confirm this runner.
4. Files under `.agro/knowledge/raw` and `.agro/knowledge/source` name `rlm`, `weigh`, and `blog`. The DoD exclusion list does not cover them. Do the raw snapshots stay unchanged?
5. Who re-scores CB-005, and in which session? The re-score needs a live /retro to `/wiki compile` run.

## Acceptance Criteria
- [ ] `bash .agro/skills/eval/run.sh` exits 0, and the probe count drops by exactly 4.
- [ ] The ten retired skill directories do not exist under `.agro/skills`.
- [ ] A `git grep` for each retired skill name returns no match outside CHANGELOG, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, the decisions directory, and the task archive.
- [ ] `bash .agro/scripts/link-providers.sh` exits 0, and `find .claude -xtype l` prints no line.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the file holds no retired entry.
- [ ] A fixture report with the reduced promotion line passes the `/wiki compile` eligibility parse.
- [ ] The CB-005 row in `.agro/evals/capability/RESULTS.md` scores 1.33 or higher after the re-score.

## Lessons

Filled by the advisor before undraft.
