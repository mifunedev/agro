# Reference classification — US-002 (#943)

Every remaining hit of `mifunedev/openharness` or `oh.mifune.dev` in tracked files after the US-002 sweep, grouped by file.
Command: `git grep -n -E 'mifunedev/openharness|oh\.mifune\.dev' -- . ':!.agro/tasks/agro-identity-cutover'`.

Classes: `historical` (records what happened under the old name; not rewritten, FR-5), `compatibility` (a retained SLA surface, alias, or redirecting default), `test-fixture` (test input or an assertion of a retained default), `generic` (owned by another story, or kept on purpose for a reason unrelated to the rename), `flipped` (a `compatibility` or `test-fixture` hit that US-006 rewrote to the canonical name; the hit count is now 0).

Files: 115. Hits: 781. After US-006 (same command at the tree that story changed): 107 files, 811 hits.

| File | Hits | Class (lines) | Reason |
|---|---|---|---|
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | 0 (was 1) | `flipped` | asserts the `SOURCE_DOCS_BASE` output, which US-006 flipped to `mifunedev/agro` |
| `.agro/cli/src/__tests__/config-repo.test.ts` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/cli/src/__tests__/docs.test.ts` | 0 (was 2) | `flipped` | asserts the `SOURCE_DOCS_BASE` output, which US-006 flipped to `mifunedev/agro` |
| `.agro/cli/src/__tests__/harness.test.ts` | 0 (was 2) | `flipped` | asserts the `SOURCE_DOCS_BASE` output, which US-006 flipped to `mifunedev/agro` |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/cli/src/__tests__/tool.test.ts` | 0 (was 2) | `flipped` | asserts the `SOURCE_DOCS_BASE` output, which US-006 flipped to `mifunedev/agro` |
| `.agro/cli/src/__tests__/remote.test.ts` | 0 (was 2, regex-escaped so the sweep command missed them) | `flipped` | asserts error text that names `DEFAULT_REPO_URL`, which US-006 flipped to `mifunedev/agro` |
| `.agro/cli/src/cli.ts` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/cli/src/commands/lifecycle.ts` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/cli/src/commands/self-upgrade.ts` | 0 (was 1) | `flipped` | `DEFAULT_ARTIFACT_URL` flipped to `mifunedev/agro` in US-006 |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | 2 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/cli/src/lib/docs.ts` | 0 (was 1) | `flipped` | `SOURCE_DOCS_BASE` flipped to `mifunedev/agro` in US-006 |
| `.agro/cli/src/lib/remote.ts` | 0 (was 1) | `flipped` | `DEFAULT_REPO_URL` flipped to `mifunedev/agro` in US-006 |
| `.agro/compat-inventory.json` | 1 | `compatibility` | the alias-sla inventory entry for the image name |
| `.agro/evals/probes/get-oh-bootstrap.sh` | 1 | `compatibility` | probe that guards a retained compatibility surface |
| `.agro/evals/probes/oh-sandbox-image-mode.sh` | 3 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/evals/probes/oh-shipped-repo-overridable.sh` | 1 | `compatibility` | probe that guards a retained compatibility surface |
| `.agro/knowledge/raw/2026-08-23-release-versioning.md` | 2 | `historical` | raw knowledge snapshot |
| `.agro/knowledge/source/fresh-machine-setup.md` | 2 | `generic` | knowledge page; US-007 owns the reverification |
| `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | 1 | `generic` | knowledge page; US-007 owns the reverification |
| `.agro/knowledge/source/plan-vs-built-reconciliation.md` | 1 | `generic` | knowledge page; US-007 owns the reverification |
| `.agro/knowledge/source/release-versioning.md` | 1 | `generic` | knowledge page; US-007 owns the reverification |
| `.agro/scripts/README.md` | 3 | `historical` (17); `compatibility` (26); `generic` (34) | HTML comment about a removed script; legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest; US-003 owns (web repository dispatch default) |
| `.agro/scripts/__tests__/closing-keywords.test.ts` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/scripts/__tests__/cron-runtime.test.ts` | 16 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/scripts/__tests__/release-latest.test.ts` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/scripts/__tests__/release-reservation.test.ts` | 5 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/scripts/get-oh.sh` | 6 | `compatibility` | retained oh.mifune.dev/get-oh.sh and /oh.js endpoints |
| `.agro/scripts/install.sh` | 8 | `compatibility` | legacy clone-and-own installer behind oh.mifune.dev/install.sh; keeps its OH_GITHUB_REPO override and fork detection |
| `.agro/scripts/promote-release-latest.sh` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/skills/git/SKILL.md` | 4 | `historical` (112,133); `compatibility` (251,256) | changelog example entries citing merged PRs; legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.agro/skills/health-check/SKILL.md` | 1 | `historical` | citation of a closed issue |
| `.agro/skills/prompt-miner/scripts/__tests__/fixtures/claude-sample.jsonl` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | 1 | `test-fixture` | test fixture or assertion of a retained default |
| `.agro/skills/release/SKILL.md` | 4 | `compatibility` (30,182); `generic` (71,203) | legacy GHCR tag, dual-published from one digest (US-003 owns); US-003 owns (web repository dispatch default) |
| `.agro/tasks/advisor-first-orchestration/evidence.md` | 3 | `historical` | dated task folder evidence |
| `.agro/tasks/advisor-first-orchestration/prd.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-cli-entry/evidence.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-cli-entry/prd.json` | 5 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-cli-entry/prd.md` | 10 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-compat-foundation/evidence.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-namespace-cutover/delegate-graph.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-namespace-cutover/evidence.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-namespace-cutover/prd.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-namespace-cutover/prd.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/agro-namespace-cutover/sandbox-upgrade-smoke.log` | 3 | `historical` | dated task folder evidence |
| `.agro/tasks/compose-env-boundary/prd.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T194250Z-3600847.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T195030Z-3628747.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T200902Z-3697153.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T200923Z-3697739.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T203507Z-3748740.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T203515Z-3748998.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211548Z-3789393.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211751Z-3792031.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T211759Z-3792322.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T214546Z-3826355.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T214554Z-3826531.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222543Z-3890845.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222823Z-3893530.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T222832Z-3893813.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T223520Z-3901127.implementation.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/audit-runs/audit-20260907T223521Z-3901127b.pr.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/evidence.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/ci-content-record-head.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/implementation-a89.log` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/namespace/ci-content-head.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/namespace/independent/luna/luna-pr1004-pr-view-final.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/namespace/independent/luna/luna-pr1004-repair-report.md` | 7 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/namespace/luna-repair-report.md` | 7 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/parent-verification/pr-a89.log` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/prd.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/sol-final-repair/changelog-entry.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/sol-final-repair/changelog-verification.log` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/sol-final-repair/final-checks.log` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/delegate-follow-up/sol-final-repair/report.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/hermes-child-container-layout/evidence.md` | 6 | `historical` | dated task folder evidence |
| `.agro/tasks/hermes-child-container-layout/prd.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/muse-code/evidence.md` | 3 | `historical` | dated task folder evidence |
| `.agro/tasks/muse-code/execution-prompt.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/one-door/evidence.md` | 4 | `historical` | dated task folder evidence |
| `.agro/tasks/one-door/prd.json` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/one-door/prd.md` | 4 | `historical` | dated task folder evidence |
| `.agro/tasks/one-door/progress.txt` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/repo-knowledge-loop/evidence.md` | 3 | `historical` | dated task folder evidence |
| `.agro/tasks/repo-knowledge-loop/prd.md` | 3 | `historical` | dated task folder evidence |
| `.agro/tasks/repo-knowledge-loop/progress.txt` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/sandbox-registry/evidence.md` | 1 | `historical` | dated task folder evidence |
| `.agro/tasks/sandbox-registry/prd.md` | 2 | `historical` | dated task folder evidence |
| `.agro/tasks/slim-sandbox-image/prd.md` | 1 | `historical` | dated task folder evidence |
| `.devcontainer/docker-compose.image-only.yml` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `.devcontainer/openharness-bootstrap.service` | 0 (was 1) | `flipped` | unit `Documentation=` flipped to `mifunedev/agro` in US-006 |
| `.devcontainer/openharness-cron.service` | 0 (was 1) | `flipped` | unit `Documentation=` flipped to `mifunedev/agro` in US-006 |
| `.github/workflows/release.yml` | 6 | `compatibility` (196-197,239-240,249); `generic` (389) | legacy GHCR tag, dual-published from one digest (US-003 owns); US-003 owns (web repository dispatch default) |
| `.github/workflows/sandbox-boot-guard.yml` | 1 | `generic` | LEGACY_IMAGE stays on purpose (US-006 compatibility evidence) |
| `CHANGELOG.md` | 498 | `historical` | changelog, RFC, or cron history entry |
| `crons/prompt-miner.md` | 8 | `historical` | changelog, RFC, or cron history entry |
| `docs/agro-compatibility.md` | 19 | `historical` (173,177,179,189,251); `compatibility` (265-267,269,278-279,281,292-297,302) | Phase 1 and Phase 2 statements of what shipped under the old names; the Phase 3 retained-surface and endpoint tables |
| `docs/configuration.md` | 1 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `docs/deployment-prebuilt-image.md` | 12 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `docs/installation.md` | 4 | `compatibility` (74,77,80); `compatibility` (174) | legacy get-oh.sh one-liner on its retained endpoint; legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `docs/lifecycle-commands.md` | 0 (was 1) | `flipped` | documents the agro update default in self-upgrade.ts, flipped to `mifunedev/agro` in US-006 |
| `docs/quickstart.md` | 4 | `compatibility` (64,67,69); `compatibility` (89) | legacy get-oh.sh one-liner on its retained endpoint; legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
| `docs/rfcs/README.md` | 8 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/adr-0001-standards-scope.md` | 1 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/preserved-changelog-rationale.md` | 2 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-agro-migration.md` | 3 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-brain-hands-boundary.md` | 4 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-mcp-exec-runner.md` | 1 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-rsi-survey-mapping.md` | 4 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-runtime-support.md` | 5 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-selfimprove-roadmap.md` | 1 | `historical` | changelog, RFC, or cron history entry |
| `docs/rfcs/rfc-trace-ledger.md` | 1 | `historical` | changelog, RFC, or cron history entry |
| `docs/runtimes/microsandbox.md` | 3 | `compatibility` | legacy GHCR image name; the default image reference is unchanged in Phase 3 and both names share a digest |
