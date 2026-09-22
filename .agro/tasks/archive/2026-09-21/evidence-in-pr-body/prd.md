# Retire `evidence.md` into the PR body, and make the gates verifiable

Issue: [#1088](https://github.com/mifunedev/agro/issues/1088). Prefix: `task`.
Base: `development`. Repository: `mifunedev/agro`.

## Intent

Three changes, one theme: the workflow's own gates should be checkable.

1. **Retire `.agro/tasks/<slug>/evidence.md`.** The reviewer is already in the
   PR description. `evidence.md` lives in a gitignored folder, needs
   `git add -f` to reach the diff, and `execute.md` itself warns that one added
   without `-f` is "present on disk and absent from the PR diff — which is the
   same as not having it". Moving the five questions into the PR body removes
   that failure class and gives the record a versioned home.
2. **Check a completed task folder against the artifacts the procedure
   requires.** The #1086 build skipped `/audit implementation`, produced no
   simplicity review, and never ran `knowledge-impact.sh`. Nothing failed,
   because absence is not an oracle.
3. **Separate "the gate could not run" from "the gate failed."** No `gh` before
   2.101.0 carries `closingIssuesReferences`, so gate 3 and the whole
   `/audit pr` route were unrunnable on the operator's host and reported as a
   PR defect.

## Architecture decision

Retiring an artifact contract across 16 files is architecture-significant by
the `/architect` trigger list. `/architect` is **not** run: the operator made
the structural decision explicitly ("I would rather retire evidence.md in
favour of providing it in the PR description"), so an architecture brief
would re-litigate a settled operator choice rather than inform one. This
PRD records the decision and the reasoning.

The PR body becomes the single evidence surface. No new artifact replaces the
file, because a replacement artifact moves the problem rather than removes it.

## Definition of Done

| ID | Observable outcome | Verification and expected result | Evidence | Owner |
|---|---|---|---|---|
| D1 | `execute.md` step 7 writes the five questions into the PR body, not a file. Step 10's evidence gate checks the body's sections, not a path. No `git add -f evidence.md` remains. | `grep -c 'evidence\.md' .agro/skills/spec/references/execute.md` returns 0. The advisor reads steps 7 and 10. | the diff | advisor |
| D2 | No skill, reference, or template instructs a reader to write `evidence.md`. | `grep -rln 'evidence\.md' .agro/skills/` returns only files that describe the retirement in the past tense; the advisor reads each hit. | grep output | advisor |
| D3 | The four probes that pin `evidence.md` pass against the retired contract. | `bash .agro/evals/probes/spec-ready-finalization.sh`, `spec-single-owner.sh`, `protected-path-deletion.sh`, `docs-20260901-followup-artifact-cited.sh` each exit 0. | probe output | advisor |
| D4 | A new tier-A probe asserts a completed task folder carries every artifact `execute.md` requires, and fails when one is absent. | `bash .agro/evals/probes/spec-task-artifact-contract.sh` exits 0 on this tree. Fault injection: remove a required artifact from a completed task folder fixture, rerun, read exit 1 with `REGRESSION:`, restore. | both outputs | advisor |
| D5 | The audit driver reports a tooling gap distinctly from a gate failure. A missing `gh` field yields a tooling-blocked signal, not `FAIL`. | `bash .agro/evals/probes/audit-tooling-blocked-signal.sh` exits 0, and red under injection. The advisor drives `pr-acquire.sh` with a forced field error and reads the distinct signal. | both outputs | advisor |
| D6 | Suite, typecheck, and the probe suite are green. | `pnpm test` reports no new failure against the base. `pnpm typecheck` exits 0. `bash .agro/skills/eval/run.sh` shows no PASS-to-REGRESSION. | `eval-result.json` | advisor |
| D7 | `CHANGELOG.md` carries one `### Changed` and one `### Added` entry under `## [Unreleased]`, each one imperative sentence of 250 characters or fewer linking #1088. | `bash .agro/evals/probes/changelog-entry-length.sh` prints PASS. | the diff | advisor |
| D8 | A PR is open against `mifunedev/agro:development`, classified `PR-AUDIT-PROMOTABLE`, with its evidence in the body per the new contract. Nobody merges it. | `/audit pr 1089` reports promotable. `gh pr view` shows it open and unmerged. | PR URL | advisor |

## Non-goals

- `knowledge-citation-symbol-liveness.sh`. Tracked separately.
- Gate 5's `netAdded` termination instrument, which cannot fall on a
  deduplication round. Recorded as a known limitation, not fixed here.
- Any change to `/retro`'s report-only contract or to `/wiki compile`.
- Retro-fitting past task folders. The probe checks folders the new contract
  governs.
- A merge.

## Implementation steps

| Step | Action and files | Dependencies | DoD IDs |
|---|---|---|---|
| 1 | Rewrite `execute.md` step 7 to write the five questions into the PR body, and step 10's evidence gate to verify the body carries them. Delete the `git ls-files --error-unmatch` check and the `git add -f` of the file. Keep the refusal-to-undraft semantics: a body missing `diverged` or `unverified` refuses exactly as a missing file did. | none | D1 |
| 2 | Sweep the remaining references: `.agro/skills/audit/references/{pr,implementation,reviewer-evidence-doc}.md`, `.agro/skills/spec/{SKILL.md,references/retro.md,templates/task-prompt.md}`, `.agro/skills/wiki/references/{schema,compile}.md`, `.agro/skills/{supervisor,escalate,retro}/SKILL.md`. `reviewer-evidence-doc.md` becomes the PR-body contract rather than a file contract. | 1 | D2 |
| 3 | Update the four probes that pin the artifact so each asserts the body contract. | 1, 2 | D3 |
| 4 | Add `.agro/evals/probes/spec-task-artifact-contract.sh`, tier A. Derive the required set from `execute.md` and assert a completed task folder carries it. Prove red by removing an artifact. | 1 | D4 |
| 5 | Add the tooling-blocked signal to `pr-acquire.sh` / `route-driver.sh`, plus `.agro/evals/probes/audit-tooling-blocked-signal.sh`. | none | D5 |
| 6 | `CHANGELOG.md`: one `### Changed`, one `### Added`. | 1-5 | D7 |
| 7 | Advisor close-out: typecheck, suite, `/eval`, both probes in both directions, PR, `/audit pr`. | 1-6 | D6, D8 |

### Bounded write sets

- **W1 (contract):** `.agro/skills/spec/references/execute.md`, the 11 sweep
  files in step 2.
- **W2 (probes and driver):** the four pinned probes, two new probes,
  `.agro/skills/audit/scripts/{pr-acquire.sh,route-driver.sh}`.
- **W3 (prose):** `CHANGELOG.md`.

W1 and W2 both touch probe expectations of `execute.md`'s text, so they are
serialized into one worker.

## Advisor orchestration

One owner runs this build and makes no tracked implementation edit. One worker
takes W1, W2, and W3 in sequence, because the probes in W2 assert the prose W1
writes and a second worker would only add a handoff.

| Task | Complexity and selection reason | Requested model / reasoning | Dependencies | Read scope; owned write paths; exclusions | Execution directory; worktree; worker type; continuation | Deliverable | Verification and evidence destination | DoD IDs; acceptance owner; repair route |
|---|---|---|---|---|---|---|---|---|
| T1 | Medium-high. The contract text and its probes move together, so a change to one without the other fails the suite. | Opus, reasoning `high` | none | Read `.agro/skills/**`, `.agro/evals/**`, `.agro/tasks/agro-workspace-verb/**` as the worked example. Write W1, W2, W3. Exclude `.agro/cli/**`, `docs/**`, `.agro/knowledge/**`. | `.worktrees/task/1088-evidence-in-pr-body`; isolated worktree; `general-purpose`; continue with `SendMessage`. | Steps 1-6. | `pnpm typecheck` 0; `pnpm test` no new failure; the four pinned probes exit 0; both new probes exit 0 and exit 1 under diff-confirmed injection. Paste into `progress.txt`. | D1-D5, D7; advisor accepts; repairs return to T1. |
| A1 | Advisor close-out. Not delegated. | advisor; `inherit` | T1 accepted | Read the diff. Write `.agro/tasks/evidence-in-pr-body/{progress.txt,eval-result.json}`. | the worktree; no worker. | Step 7. | `/eval` no PASS-to-REGRESSION; `/audit pr` promotable. | D6, D8; advisor accepts. |

**T1 brief.** In `.worktrees/task/1088-evidence-in-pr-body`, implement steps 1
to 6 of this PRD. The contract change is the hard part: `execute.md` step 7
must stop producing a file and start producing PR-body sections, and step 10's
evidence gate must refuse the undraft when the body lacks them, exactly as it
refused a missing file. Preserve every semantic the old gate carried — the
five questions in order, the rule that a writer spells `diverged` and `unverified`
as `None` or `Nothing` rather than omitting them, and the refusal path. Then
sweep the 11 files that reference the artifact, update the four probes that
pin it, and add the two new probes. Read `.agro/evals/README.md` before
writing a probe; pin the product set rather than one product name, escape
every backtick inside a `problems+=()` message, and confirm each injected
fault changes the file before you trust a red result. Write no file
under `.agro/cli/`, `docs/`, or `.agro/knowledge/`.

| Wave | Work and owner | Dependencies | Output | DoD IDs |
|---|---|---|---|---|
| 1 | T1 implements; the advisor accepts and reruns every probe in both directions. | none | accepted diff | D1-D5, D7 |
| 2 | A1: `/eval`, PR, `/audit pr`, body per the new contract. | wave 1 | PR URL | D6, D8 |

## Affected surfaces

- **Host and sandbox:** applied; control-plane prose and probes only, no
  runtime path either side.
- **Lifecycle door:** not applicable; no `agro` verb changes.
- **Canonical and provider surfaces:** applied; every edit is canonical under
  `.agro/`, no mirror patched.
- **Root and scaffold:** applied to the root orchestrator; an initialized
  project inherits the new contract with its next payload.
- **Interactive and headless:** not applicable.
- **Local and remote:** applied; nothing terminal-dependent.
- **Parallel operation:** applied; one worker, three sequential write sets.
- **Public documentation:** `mifunedev/agro-web` may describe the evidence
  artifact; out of scope for this PR and called out in the body.
- **Verification:** two new tier-A probes with fault injection, four updated
  probes, the suite, and CI.

## Knowledge Context

- **Base commit**: `cf35b316acccc03092d8f8da97fe2a50d9b12a1f`
- **Queries**: `spec execute evidence gate probes audit`
- **Knowledge used**: `[[pattern-spec-procedure-executed-from-summary]]`,
  `[[pattern-evals-document-conformance-proxy-oracle]]`,
  `[[pattern-audit-gate-unrunnable-reads-as-defect]]` — all three compiled from
  the #1086 retro and landing in #1087, not yet on `development`.
- **Grounded against**: `.agro/skills/spec/references/execute.md`,
  `.agro/skills/audit/references/{implementation,pr,reviewer-evidence-doc}.md`,
  `.agro/skills/audit/scripts/{route-driver,pr-acquire,audit-run}.sh`,
  `.agro/evals/probes/{spec-ready-finalization,spec-single-owner,protected-path-deletion,docs-20260901-followup-artifact-cited}.sh`,
  `.agro/evals/README.md`
- **Conflicts discovered**: `none`

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `none` — the three patterns this build acts on are
  written by #1087 and describe the failure modes, not the fix. A pattern page
  never gains a note saying a later build addressed it.
- **Affected source paths**: `.agro/skills/spec/references/execute.md`,
  `.agro/skills/audit/**`, `.agro/evals/probes/**`
- **Reason**: The build changes a documented workflow contract. No `kind: repo`
  page declares these paths among its `sources:`, so the knowledge gate derives
  the real union from the diff.

## Plan Reconciliation

- **Source plan**: `none` — the operator specified the change directly in
  session, and the three patterns supply its evidence.
- **Intent preserved**: YES
- **Material deviations**: `none`
- **Constraints discovered during grounding**: The three pattern pages this
  build cites live on #1087 and are absent from `development`, so this branch
  must not add `[[slug]]` links to them; `wiki-related-slugs.sh` would fail.
- **Orchestration preserved**: NOT-APPLICABLE — no source plan carried a
  strategy, so this PRD states one above.
