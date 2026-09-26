# PRD: Audit responsibility simplification

Status: BLOCKED

## User Stories

### US-001: Compose the harness survey with council

**Description:** As an operator, I want `/audit harness` to get its independent perspectives from `/council` so that one skill owns multi-perspective deliberation and `/audit` keeps the verdict.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/harness.md` delegates perspective research to `/council` through a link to `.agro/skills/council/SKILL.md`.
- [ ] `harness.md` no longer holds a separate fan-out procedure that duplicates `/council` or `/delegate` dispatch rules.
- [ ] `harness.md` states that `/audit harness` owns the Tier 1/2/3 ranking and the Recommended Next 3 Actions.
- [ ] `harness.md` keeps a fail-closed rule: if the council outcome is `BLOCKED`, the harness audit emits no tier ranking and no Recommended Next 3 Actions.
- [ ] If the council outcome is `PARTIAL`, `harness.md` requires the report to label the synthesis partial and to name the missing coverage.
- [ ] `bash .claude/skills/eval/run.sh --probe harness-audit-empty-output-gate` exits 0, with the probe updated only if the approved plan requires the update.

### US-002: Compose the external proposal audit with council

**Description:** As an operator, I want `/audit harness --external <url|path>` to use `/council` for its three perspectives so that the external decision audit follows one deliberation contract.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/external-proposal-audit.md` names the product/alignment, implementation/feasibility, and security/reliability perspectives as `/council` lenses.
- [ ] `external-proposal-audit.md` states that `/audit` owns the recommendation, the non-goals, the acceptance criteria, the risks, and the gating criteria.
- [ ] The `--apply issue --confirm`, `--apply issue --dry-run`, and `--wiki-ingest` rules in `external-proposal-audit.md` keep their current meaning.
- [ ] The duplicate external-proposal paragraph under `## External proposal implementation audits` in `harness.md` is removed, and `harness.md` routes to `external-proposal-audit.md` only.
- [ ] `bash .claude/skills/eval/run.sh --probe audit-run-root-contract` exits 0.

### US-003: Replace skill-health scores with evidence-backed findings

**Description:** As an operator, I want `/audit skills` to report each verdict with the evidence behind it so that no unsupported numeric score decides a skill's state.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/skills.md` contains no 0–10 total score, no per-dimension 0/1/2 score table, and no score-to-verdict threshold table.
- [ ] `skills.md` keeps the verdicts `CURRENT`, `STALE`, `BROKEN`, and `DELETE`.
- [ ] `skills.md` defines each verdict by an observable condition, for example a broken path reference or a missing frontmatter field.
- [ ] Each finding in the `skills.md` output format names the skill, the verdict, the evidence (file path, command, or count), and the recommended action.
- [ ] `bash .claude/skills/eval/run.sh --probe audit-stale-references` exits 0.

### US-004: Replace eval-quality scores with evidence-backed findings

**Description:** As an operator, I want `/audit eval-quality` to cite failure-mode evidence for each verdict so that no unsupported numeric score decides a probe's state.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/eval-quality.md` describes each target as checked against the failure modes, not scored.
- [ ] `eval-quality.md` keeps the verdicts `KEEP`, `GROOM`, and `CUT`.
- [ ] Each finding in the `eval-quality.md` output format names the target id, the verdict, the failure mode, and the evidence.
- [ ] `eval-quality.md` keeps the read-only rule: after a run, `git status --porcelain .agro/evals/` prints nothing.
- [ ] The driver block in `eval-quality.md` still runs from the repository root and exits 0 on the current tree.

### US-005: Trace the approved plan and verify the floor

**Description:** As the advisor, I want each approved requirement, decision, and check mapped to evidence so that the ready-for-review PR proves R1–R15, D1–D8, and C1–C19.

**Acceptance Criteria:**

- [ ] The PR body holds one row for each of R1–R15, D1–D8, and C1–C19, with a verdict and a command or file citation.
- [ ] `bash .claude/skills/eval/run.sh` exits 0 and reports no new green-to-red regression.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh <changed-file>` exits 0 for each changed Markdown file under `.agro/skills/audit/` and `.agro/skills/council/`.
- [ ] `git diff --name-only origin/development...HEAD` lists no file under `.agro/skills/audit/scripts/`, `.agro/scripts/`, `.agro/cli/`, or `.github/workflows/`.
- [ ] `ls .agro/skills` lists the same skill directories before and after the change.

## Summary

The operator approved `/spec .agro/plans/audit-responsibility-simplification/plan.md` (issue #1114). That plan file does not exist in this checkout. `.agro/plans/` holds only `archive/2026-09-10/cli-first-release/`. The plan defines R1–R15, D1–D8, and C1–C19. This PRD cannot restate those identifiers without the plan. The status stays `BLOCKED` until the operator supplies the plan.

Verified current state:

- `.agro/skills/audit/SKILL.md` dispatches nine public targets: `implementation`, `pr`, `prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`, `full`.
- `harness.md` launches four inline auditor perspectives (PM, Implementer, Critic, Explorer) through the Agent tool. It validates the `PM_FINDINGS`, `IMP_FINDINGS`, `CRITIC_FINDINGS`, and `EXP_FINDINGS` sentinels and stops with `FAIL-AUDITOR-OUTPUT` on a missing block.
- `harness.md` also carries an "External proposal implementation audits" paragraph. That paragraph repeats the private route in `external-proposal-audit.md`.
- `.agro/skills/council/SKILL.md` owns bounded multi-perspective deliberation through `/delegate`. Council forbids votes and numerical scores as a substitute for evidence. The council boundary table assigns audit verdicts to `/audit`.
- `skills.md` scores five dimensions at 0–2 each and maps the 0–10 total to `CURRENT`/`STALE`/`BROKEN`/`DELETE`.
- `eval-quality.md` "scores" each probe and capability task against seven failure modes and maps the result to `KEEP`/`GROOM`/`CUT`.

Selected approach: `/audit harness` and its `--external` route compose `/council` for perspective research, and `/audit` keeps the verdict. `skills.md` and `eval-quality.md` keep their verdict vocabularies, and each verdict cites evidence instead of a numeric score. One continuing bounded writer implements the stories. An independent reviewer checks the evidence.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/references/harness.md` | Step 3 auditor fan-out, step 3.5 output gate, step 4 synthesis | Harness survey route that composes `/council`. |
| `.agro/skills/audit/references/external-proposal-audit.md` | `--external`, `--apply issue`, `--wiki-ingest` | Private external decision route that composes `/council`. |
| `.agro/skills/audit/references/skills.md` | Dimension scores, Score thresholds, Verdict thresholds | Skill-health route. Scores become evidence-backed findings. |
| `.agro/skills/audit/references/eval-quality.md` | Seven failure modes, Scoring procedure driver | Eval-quality route. Scores become evidence-backed findings. |
| `.agro/skills/audit/SKILL.md` | Target table and native results | Dispatcher. The nine targets stay unchanged. |
| `.agro/skills/council/SKILL.md` | Boundaries table, Council Brief outcomes | Deliberation owner that `/audit` composes. |
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | Sentinel grep for `PM_FINDINGS` … `FAIL-AUDITOR-OUTPUT` | Regression probe on the harness output gate. |
| `.agro/evals/probes/audit-stale-references.sh` | Canonical skills path grep in `skills.md` | Regression probe on the skills route. |
| `.agro/evals/probes/audit-run-root-contract.sh` | `harness.md` and `external-proposal-audit.md` fixture | Regression probe on the external route. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/audit harness` report | Modified | Perspective evidence comes from a Council Brief. Tier ranking and Next 3 Actions stay with `/audit`. |
| `/audit harness --external` report | Modified | The three perspectives come from `/council` lenses. Issue-write flags keep their meaning. |
| `/audit skills` report | Modified | The report drops the Scores table. Each finding carries verdict and evidence. |
| `/audit eval-quality` report | Modified | Each finding carries verdict, failure mode, and evidence. |
| `/audit` target list and native verdict names | Unchanged | Nine targets and all native verdict strings stay. |

## Storage

N/A. The change edits Markdown procedures only. The audit log, the `/eval` scoreboard, and `/delegate` run records under `.agro/tasks/` keep their current format and location.

## Architectural Decisions

- `/audit` stays the source of truth for audit verdicts. `/council` returns advice and evidence only.
- `/council` stays the single owner of multi-perspective deliberation. `/delegate` stays the single owner of worker dispatch.
- A verdict without cited evidence is not a valid finding.
- Runtime scripts under `.agro/skills/audit/scripts/`, implementation gates, release policy, and merge authority stay unchanged.
- The advisor owns verification and the ready-for-review PR. The advisor does not merge.
- Unrelated root changes in the working tree stay untouched.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/harness-audit-empty-output-gate.sh` | Fail-closed rule present in `harness.md` | US-001 keeps the fail-closed harness gate. |
| `.agro/evals/probes/audit-run-root-contract.sh` | External route reachable only through `--external` | US-002 keeps the private route. |
| `.agro/evals/probes/audit-stale-references.sh` | Canonical skills path in `skills.md` | US-003 keeps the skills scope. |
| `<new or updated probe for evidence-backed findings>` | `skills.md` and `eval-quality.md` hold no score thresholds | US-003 and US-004 remove unsupported scores. |
| `bash .claude/skills/eval/run.sh` | Full probe suite | US-005 regression floor. |
| `bash .agro/skills/ste/scripts/ste-check.sh <file>` | Each changed Markdown file | US-005 prose standard. |

## Design Principles

- Keep one owner for each responsibility: `/council` deliberates, `/delegate` dispatches, `/audit` decides.
- Delete duplicate procedure text instead of keeping it next to the composed skill.
- Replace a number with the evidence that the number claimed to summarize.
- Keep the change inside Markdown procedures and probes. Add no new machinery.
- Follow `/ste` for every changed procedure file.

## Out of Scope

- Adding, removing, or renaming an `/audit` target or a skill.
- Changes to `audit-run.sh`, `route-driver.sh`, `implementation-gates.sh`, or any other runtime script.
- Changes to implementation gates, release policy, or merge authority.
- Changes to the `implementation`, `pr`, `prs`, `context`, `drift`, or `full` routes, unless the approved plan requires one.
- Merging the PR.

## Open Questions

1. Where is `.agro/plans/audit-responsibility-simplification/plan.md`? The file is absent from this checkout. The PRD needs the plan text of R1–R15, D1–D8, and C1–C19.
2. Does the approved plan keep the `PM_FINDINGS`, `IMP_FINDINGS`, `CRITIC_FINDINGS`, and `EXP_FINDINGS` sentinels, or does the Council Brief outcome replace the sentinels? The answer decides the change to `harness-audit-empty-output-gate.sh`.
3. Does `/audit full` need a change when `/audit harness` composes `/council` from a child context? `full.md` marks nested fan-out as `deferred`.
4. Which probe proves that `skills.md` and `eval-quality.md` hold no unsupported scores: a new probe or an update to an existing probe? The test command stays `<new or updated probe>` until the plan answers.
5. Which base branch does the PR target? The last merge went to `development`. The plan must confirm `<base branch>`.

## Acceptance Criteria

- [ ] Each of R1–R15, D1–D8, and C1–C19 has a PR-body row with a verdict and evidence.
- [ ] `.agro/skills/audit/SKILL.md` lists the same nine targets and the same native verdict strings as before the change.
- [ ] `bash .claude/skills/eval/run.sh` exits 0.
- [ ] No file under `.agro/skills/audit/scripts/`, `.agro/scripts/`, `.agro/cli/`, or `.github/workflows/` changes.
- [ ] An independent reviewer records an evidence review in the PR body.
- [ ] The PR is ready for review and is not merged.

## Lessons

Filled by the advisor before undraft.
