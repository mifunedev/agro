# PRD: Move spec evidence into the PR body and close two gate gaps

Status: DRAFT

## User Stories

### US-001: Retire evidence.md in favour of the PR body

**Description:** As a reviewer, I want the evidence in the PR description so that no evidence file drops out of the diff.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/references/execute.md` step 7 tells the owner to write the five evidence questions into the PR body, in the same order.
- [ ] The execute.md evidence gate reads the PR body with `gh pr view` and refuses the undraft when a required heading is missing.
- [ ] The execute.md evidence gate contains no `git ls-files --error-unmatch` check and no `git add -f` instruction.
- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/evals/probes` prints only lines that describe the retirement.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` names the PR body as the evidence location.
- [ ] The 4 probes `.agro/evals/probes/spec-ready-finalization.sh`, `.agro/evals/probes/spec-single-owner.sh`, `.agro/evals/probes/protected-path-deletion.sh`, and `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` assert the PR-body contract and exit 0.
- [ ] Red test first: `spec-ready-finalization.sh` exits non-zero against the current execute.md before the edit.

### US-002: Check a completed task folder for required artifacts

**Description:** As an advisor, I want a check of required task artifacts so that a skipped procedure step fails a gate.

**Acceptance Criteria:**

- [ ] New file `.agro/skills/spec/scripts/task-artifacts-check.sh` takes a slug and exits 1 when `simplicity-review.json` or `simplify-rounds.json` is absent from the task folder.
- [ ] The checker exits 1 when `progress.txt` records no `knowledge-impact.sh` state.
- [ ] The checker prints one line per missing artifact and exits 0 when every artifact is present.
- [ ] The execute.md gate before the undraft runs the checker and refuses the undraft on exit 1.
- [ ] New file `.agro/evals/probes/spec-task-artifacts.sh` runs the checker against a complete fixture and a fixture that lacks each artifact in turn.
- [ ] The probe exits 0 on the fixed checker and exits non-zero when the checker skips one artifact.

### US-003: Separate a tooling-blocked gate from a failed gate

**Description:** As an operator, I want a distinct tooling-blocked verdict so that a tooling gap does not read as a PR defect.

**Acceptance Criteria:**

- [ ] When `gh` rejects the `closingIssuesReferences` field, `.agro/skills/audit/scripts/pr-acquire.sh` exits with a distinct `<tooling-blocked exit code>` and names the missing capability on stderr.
- [ ] `gate3_pr` in `.agro/skills/audit/scripts/route-driver.sh` prints `gate3: BLOCKED (tooling: <reason>)` and publishes `<blocked verdict token>`, not `AUDIT-FAIL`.
- [ ] A real classification failure still prints `gate3: FAIL (...)` and publishes `AUDIT-FAIL`.
- [ ] `.agro/evals/probes/audit-pr-acquire.sh` stubs a `gh` that rejects the field and asserts the blocked exit code.
- [ ] `.agro/evals/probes/audit-implementation-behavior.sh` asserts that the driver output holds `BLOCKED` and not `FAIL` for that stub.
- [ ] `.agro/skills/audit/references/implementation.md` and `.agro/skills/audit/references/pr.md` document the blocked verdict.

## Summary

The /spec execute procedure asks the owner to commit `evidence.md` inside the gitignored task folder with `git add -f`. The gate at execute.md lines 602-620 checks the file with `git ls-files --error-unmatch`. A file that the owner adds without `-f` stays out of the PR diff. This plan moves the five evidence questions into the PR body. The plan also adds a checker for the artifacts that execute.md requires. The #1086 build skipped the simplicity review and `knowledge-impact.sh`, and no gate failed. Last, `pr-acquire.sh` line 32 requests `closingIssuesReferences`, and `gh` before 2.101.0 rejects that field. The driver then prints `gate3: FAIL (classification exited 1)`. This plan adds a blocked verdict for that case.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | step 7, the evidence gate, lines 401-487 | Owns the evidence contract and the undraft gate |
| `.agro/skills/spec/templates/task-prompt.md` | evidence ownership line | Tells the owner where to write evidence |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | five questions | Defines the evidence shape |
| `.agro/skills/audit/scripts/route-driver.sh` | `fail`, `gate3_pr`, `gate3` | Emits gate verdicts |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields`, `gh pr view` | Requests PR fields from `gh` |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `classify-pr` | Passes the acquisition exit code to the driver |

Other files that name `evidence.md` and need a matching edit: `.agro/skills/spec/SKILL.md`, `.agro/skills/spec/references/retro.md`, `.agro/skills/audit/references/implementation.md`, `.agro/skills/audit/references/pr.md`, `.agro/skills/escalate/SKILL.md`, `.agro/skills/retro/SKILL.md`, `.agro/skills/supervisor/SKILL.md`, `.agro/skills/wiki/references/compile.md`, `.agro/skills/wiki/references/schema.md`, `.agro/logs/AGENTS.md`, `.agro/memories/AGENTS.md`.

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body | Contract change | The PR body carries the five evidence answers |
| Audit driver output | New verdict | A blocked verdict joins PASS and FAIL |
| `pr-acquire.sh` exit code | New code | A distinct code marks a missing `gh` capability |

## Storage

The evidence moves from the task folder to the GitHub PR description. GitHub keeps the edit history. The artifact checker reads the task folder and writes nothing.

## Architectural Decisions

- The PR body is the single source of truth for evidence.
- The checker reads its list of required artifacts from one array in the script. execute.md cites the script and holds no second list.
- The blocked verdict fails closed. A blocked gate still refuses the undraft, but the verdict names the tooling cause.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | gate reads the PR body; no `error-unmatch` line | US-001 |
| `.agro/evals/probes/spec-single-owner.sh` | task prompt names the PR body for evidence | US-001 |
| `.agro/evals/probes/protected-path-deletion.sh` | justification source is the PR body or the commit message | US-001 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | follow-up citation rule applies to the PR body | US-001 |
| new file `.agro/evals/probes/spec-task-artifacts.sh` | complete fixture passes; each missing artifact fails | US-002 |
| `.agro/evals/probes/audit-pr-acquire.sh` | stub `gh` rejects the field; blocked exit code | US-003 |
| `.agro/evals/probes/audit-implementation-behavior.sh` | driver prints `BLOCKED`, not `FAIL` | US-003 |

Run the full suite with `bash .agro/skills/eval/run.sh`.

## Design Principles

- Delete the obsolete evidence path. Keep no fallback to `evidence.md`.
- Treat absence as a failure. A skipped step must fail a deterministic check.
- Keep the blocked verdict fail-closed. Distinguish the cause, not the outcome.
- Add no tracked-code comments.

## Out of Scope

- The `knowledge-citation-symbol-liveness.sh` probe. A separate issue tracks the probe.
- Any change to the gate 5 `netAdded` termination instrument.
- A migration of archived task folders that hold `evidence.md`.

## Open Questions

1. `.agro/evals/probes/protected-path-deletion.sh` reads tracked `evidence.md` files. A probe cannot read PR bodies offline. Should the justification move to the commit message?
2. Git ignores task folders, so a CI probe cannot see a real completed folder. Is a fixture-based probe plus a gate-time checker acceptable?
3. Which exit code and which verdict token mark the blocked state? This plan uses `<tooling-blocked exit code>` and `<blocked verdict token>`.
4. Does `pr-acquire.sh` detect the gap from the `gh` error text or from `gh --version`?
5. Does the public site in the mifunedev/agro-web repository describe `evidence.md`?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] `CHANGELOG.md` records the evidence move and the blocked verdict.
- [ ] No new tracked file lives under the gitignored task folder.

## Lessons

Filled by the advisor before undraft.
