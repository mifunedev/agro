# PR1004 repair report

Generated: 2026-09-08T01:45:47Z

## Final state

- PR: https://github.com/mifunedev/openharness/pull/1004
- State: OPEN, DRAFT, not merged.
- Base: `development` at `a227bbf3f3166a0e1a8a1951fc88694cfa0151ee`.
- Repaired branch: `skill/1003-delegate-follow-up`.
- Remote head: `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4`.
- The push was a fast-forward from accepted head `e81a5aad703a0f7081104a97d2eea980b72bca2e`; no force push was used.
- GitHub reports `MERGEABLE`; no merge, undraft, cleanup, issue #1014 work, release work, or root-checkout change was performed.

## Commits and ancestry

- Repair merge commit: `021d07e75036fea02ef4ed093ba4e4d1dc4a2632`.
  - Parent 1: `e81a5aad703a0f7081104a97d2eea980b72bca2e`.
  - Parent 2: `a227bbf3f3166a0e1a8a1951fc88694cfa0151ee`.
- Eval scoreboard commit: `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4`.
- Final delegate skill blob: `cc36ba45fa71d2cdbe9625a038b8d56e28939991`.
- Final advisor probe blob: `6fc7d39cd42eaa8762accd45bad29171ccd9cb2d`.
- Final worker-boundary probe blob: `33130bc0f9a15da20dace7566c6b047277e17f4e`.

## Conflict repair

The five approved conflict surfaces were reconciled against current `development`:

1. `.agro/skills/delegate/SKILL.md`: retained PR1004 accepted-dependency gating, provenance and owned-path fail-closed checks, interrupted-run reconciliation, sizing and native-settings policy, planning-only rules, and the dry-run graph edge before ledger persistence. The ledger destination is `.agro/tasks/`; obsolete Memory Protocol edges were not restored.
2. `.agro/knowledge/README.md`: retained the canonical `.agro/knowledge` index and its two pattern entries.
3. `.agro/knowledge/patterns/pattern-delegate-ledger-stale-at-acceptance.md`: relocated and reconciled.
4. `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md`: relocated and reconciled.
5. `.agro/evals/RESULTS.md`: retained the canonical scoreboard; `.oh/evals/RESULTS.md` was not resurrected.

The two pattern pages use `.agro/...` for current Relevant Source Files. Their `sources:` frontmatter retains `.oh/...@<pre-migration-commit>` only where that exact historical path is required for the cited commit to resolve. The knowledge freshness probe passes with those historical pins.

## Relocated task evidence

- Manifest: `/tmp/luna-pr1004-e81-task-manifest.txt`.
- Manifest SHA256: `e6f5f20f26dff34d9ec745e0370be342b69f6f12ec1df176b702327c9ea8f72c`.
- 104 of 104 original e81 task blobs were verified by Git object ID: zero mismatches.
- Current tracked destination: `.agro/tasks/delegate-follow-up/` (104 files).
- Current tracked old path: `.oh/tasks/delegate-follow-up/` (0 files).
- Completion claims, raw evidence, manifests, frozen procedures, runtime logs, and audit receipts were not edited. An ignored old-path fixture directory remains untouched and is not part of the tracked tree.
- Namespace-aware normalization of the accepted e81 skill and both affected probes (`.agro/` normalized to `.oh/`) is byte-equivalent.

## Changed-path scope

The final target-relative diff contains 112 paths: 104 relocated task files, 2 affected probes, 3 knowledge files (README plus 2 patterns), 1 delegate skill, 1 changelog line, and the refreshed canonical eval scoreboard. No issue #1014 reference was added. The complete `git diff --name-status` output is appended below.

## Verification

| Check | Exit/result |
|---|---:|
| `git diff --check a227bbf3f3166a0e1a8a1951fc88694cfa0151ee HEAD --` | 0 |
| `bash -n .agro/evals/probes/advisor-execution-contract.sh` | 0 |
| `bash -n .agro/evals/probes/delegate-worker-boundary.sh` | 0 |
| `bash .agro/scripts/link-providers.sh --check` | 0; `.agents/.pi/.claude/.codex` resolve to `.agro/skills` |
| Focused probes | both exit 0 |
| Relevant adjacent probes | all exit 0: wiki index, schema, related slugs, knowledge freshness, spec running, session decoupling, no agent handoff, generated-prompt contract, single-owner |
| Full canonical eval: `bash .agro/skills/eval/run.sh` | exit 0; 145 probes ran |
| Full eval scoreboard | 137 PASS, 7 SKIPPED, 1 persistent REGRESSION; no green-to-red regression |
| `git status --porcelain` and `git ls-files -u` | empty |

The persistent `skills-vendored` red is inherited: the target baseline already recorded `REGRESSION`, and the probe reports the environment lacks the `cc-safety-net` binary. No install or bypass was used. The initial combined staged-diff check also exposed inherited trailing whitespace in target evidence `.agro/tasks/agro-namespace-cutover/sandbox-upgrade-smoke.log`; the final PR-relative diff check is clean, and that unrelated base defect was not modified.

## Mutation coverage

Archived runners and manifests were not edited. Disposable namespace-adapted copies used the repaired `.agro` paths and the preserved mutation matrix:

- Mermaid focused runner: 5/5 cases expected, 0 failures (four negative mutations exit 1; one legal reflow exits 0).
- Prior contract runner: 12/12 cases expected, 0 failures (eight negative mutations exit 1; four positive wording/reflow cases exit 0).
- Scratch outputs: `/tmp/luna-pr1004-mutation-current/`.
- The archived runners remain under `.agro/tasks/delegate-follow-up/sol-final-repair/` with their original bytes.
- No paid/native runtime experiment was rerun.

## CI at pushed head

`gh pr checks 1004 --repo mifunedev/openharness` exited 0. All five final-head checks passed:

- Lint, Typecheck, Build & Test: PASS — https://github.com/mifunedev/openharness/actions/runs/34177659533/job/101910183110
- Boot Path Lint (shellcheck + hadolint): PASS — https://github.com/mifunedev/openharness/actions/runs/34177659533/job/101910183314
- Eval Probe Regression Gate: PASS — https://github.com/mifunedev/openharness/actions/runs/34177659533/job/101910183275
- Validate sandbox compose and image build: PASS — https://github.com/mifunedev/openharness/actions/runs/34177659536/job/101910183067
- Boot a legacy volume against the fresh image: PASS — https://github.com/mifunedev/openharness/actions/runs/34177659536/job/101910183030

Read-only CI monitor: Monitor #2 completed with exit 0. The PR remains draft and unmerged.

## Parent-owned reconciliation required

The relocation preserved bytes by design. Before accepting or releasing merge/cleanup, the parent must reread owner state against final head `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4`, not old e81 acceptance. Current owner records that contain active pre-migration paths and need namespace/acceptance reconciliation are:

- `.agro/tasks/delegate-follow-up/prd.md`
- `.agro/tasks/delegate-follow-up/progress.txt`
- `.agro/tasks/delegate-follow-up/evidence.md`
- `.agro/tasks/delegate-follow-up/delegate-graph.json`
- `.agro/tasks/delegate-follow-up/eval-result.json`
- `.agro/tasks/delegate-follow-up/simplicity-review.json`

`delegate-log.txt` and the archived evidence remain historical append-only material; do not blanket-rewrite their `.oh` strings. The parent should record the repaired head, current `.agro` ownership, fresh acceptance, and the inherited CI/eval caveats separately.

## Review gate

Repair and push are complete. Parent review, independent acceptance, final audits, merge, and PR-specific cleanup remain outstanding.

### Complete target-relative changed-path list

```text
M	.agro/evals/RESULTS.md
M	.agro/evals/probes/advisor-execution-contract.sh
M	.agro/evals/probes/delegate-worker-boundary.sh
M	.agro/knowledge/README.md
A	.agro/knowledge/patterns/pattern-delegate-ledger-stale-at-acceptance.md
A	.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md
M	.agro/skills/delegate/SKILL.md
A	.agro/tasks/delegate-follow-up/audit-runs/README.md
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T194250Z-3600847.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T195030Z-3628747.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T200902Z-3697153.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T200923Z-3697739.pr.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T203507Z-3748740.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T203515Z-3748998.pr.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211548Z-3789393.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211751Z-3792031.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211759Z-3792322.pr.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T214546Z-3826355.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T214554Z-3826531.pr.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222543Z-3890845.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222823Z-3893530.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222832Z-3893813.pr.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T223520Z-3901127.implementation.json
A	.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T223521Z-3901127b.pr.json
A	.agro/tasks/delegate-follow-up/delegate-graph.json
A	.agro/tasks/delegate-follow-up/delegate-log.txt
A	.agro/tasks/delegate-follow-up/eval-base-56ab2bab.txt
A	.agro/tasks/delegate-follow-up/eval-result.json
A	.agro/tasks/delegate-follow-up/evidence.md
A	.agro/tasks/delegate-follow-up/parent-verification/ci-content-record-head.json
A	.agro/tasks/delegate-follow-up/parent-verification/eval-ended.txt
A	.agro/tasks/delegate-follow-up/parent-verification/eval-started.txt
A	.agro/tasks/delegate-follow-up/parent-verification/eval.exit
A	.agro/tasks/delegate-follow-up/parent-verification/eval.log
A	.agro/tasks/delegate-follow-up/parent-verification/final/ended.txt
A	.agro/tasks/delegate-follow-up/parent-verification/final/eval.exit
A	.agro/tasks/delegate-follow-up/parent-verification/final/eval.log
A	.agro/tasks/delegate-follow-up/parent-verification/final/head.txt
A	.agro/tasks/delegate-follow-up/parent-verification/final/knowledge-impact.tsv
A	.agro/tasks/delegate-follow-up/parent-verification/final/skills-vendored-base-current.log
A	.agro/tasks/delegate-follow-up/parent-verification/final/started.txt
A	.agro/tasks/delegate-follow-up/parent-verification/implementation-a89.exit
A	.agro/tasks/delegate-follow-up/parent-verification/implementation-a89.log
A	.agro/tasks/delegate-follow-up/parent-verification/integrated-head.txt
A	.agro/tasks/delegate-follow-up/parent-verification/knowledge-impact.tsv
A	.agro/tasks/delegate-follow-up/parent-verification/pr-a89.exit
A	.agro/tasks/delegate-follow-up/parent-verification/pr-a89.log
A	.agro/tasks/delegate-follow-up/parent-verification/preaudit-head.json
A	.agro/tasks/delegate-follow-up/parent-verification/runtime-acceptance.json
A	.agro/tasks/delegate-follow-up/prd.json
A	.agro/tasks/delegate-follow-up/prd.md
A	.agro/tasks/delegate-follow-up/progress.txt
A	.agro/tasks/delegate-follow-up/simplicity-review.json
A	.agro/tasks/delegate-follow-up/sol-final-repair/changelog-entry.md
A	.agro/tasks/delegate-follow-up/sol-final-repair/changelog-verification.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/evidence.sha256
A	.agro/tasks/delegate-follow-up/sol-final-repair/final-checks.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/focused-mermaid-mutations.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/precommit-checks.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/prior-12-mutations.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/report-verification.log
A	.agro/tasks/delegate-follow-up/sol-final-repair/report.md
A	.agro/tasks/delegate-follow-up/sol-final-repair/run-focused-mermaid.sh
A	.agro/tasks/delegate-follow-up/sol-final-repair/run-prior-12.sh
A	.agro/tasks/delegate-follow-up/sol-final-repair/simplification-commit-verification.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/commands/run-session-a.sh
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/commands/run-session-b.sh
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/control/a-ready.json
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/ledger/delegate-graph.json
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/ledger/delegate-log.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/a-after-b.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/a-before-b.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/a-listagents-ended.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/a-listagents-running.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/artifact-before.sha256
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/final-artifact-manifest.sha256
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/frozen-procedure.sha256
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/frozen-skill.sha256
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/orchestrator-during-b.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/orchestrator-process-tree.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/prompt-command.sha256
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/observations/runtime-preflight.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/procedure/delegate-SKILL.c6704966.md
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/procedure/recovery-procedure.md
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/prompts/session-a.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/prompts/session-b.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/final-audit.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/native-event-summary.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/orchestrator-commands.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/relevant-native-results.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/report-verification.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-a.exit
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-a.stderr.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-a.stream.jsonl
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-b.exit
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-b.stderr.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/session-b.stream.jsonl
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/raw/worker-release.log
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/reports/runtime-report.md
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/reports/session-a-report.md
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/reports/session-b-report.md
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/task/output.txt
A	.agro/tasks/delegate-follow-up/sol-runtime-proof/task/worker-started.txt
A	.agro/tasks/delegate-follow-up/xsession-experiment/README.md
A	.agro/tasks/delegate-follow-up/xsession-experiment/experiment-ledger.json
A	.agro/tasks/delegate-follow-up/xsession-experiment/original-worker-report.md
A	.agro/tasks/delegate-follow-up/xsession-experiment/recovery-procedure-given.md
A	.agro/tasks/delegate-follow-up/xsession-experiment/session2-prompt.txt
A	.agro/tasks/delegate-follow-up/xsession-experiment/session2-report.md
A	.agro/tasks/delegate-follow-up/xsession-experiment/session2-stream.jsonl
A	.agro/tasks/delegate-follow-up/xsession-experiment/worker-heartbeat.txt
M	CHANGELOG.md
```
