# Retire the stale `agro cloud` command

## Intent
Create a PR that deletes the `agro cloud` verb and every surface it owns. The operator requested a scoped retirement PR and explicitly chose a hard delete. Do not merge.

## Architecture decision
`agro cloud` is a client for a first-party hosted service this repository does not run. The default API base is `http://127.0.0.1:3000`. No harness behavior depends on it: no skill invokes it, and the CLI carries zero runtime dependencies for it. Deletion removes a dormant alternative rather than replacing one abstraction with another. No new abstraction and no ADR are needed.

One exception to the hard delete. `.agro/compat-inventory.json` is a ledger of deferred compatibility obligations, not configuration. Its cloud rows are marked migrate-later, phase 4, and `docs/agro-compatibility.md:323` records that the namespace cutover routed around cloud on purpose. Mark those rows retired in place. Dropping them would erase the record that the obligation existed.

## Definition of Done
- D1: `agro cloud` does not dispatch. No cloud surface remains in the CLI, the config schema, or the secret key list.
- D2: The tier-A probe suite is green, including `.agro/evals/probes/oh-lifecycle-surface.sh`. Unit tests and typecheck pass.
- D3: Tracked documentation, `.example.env`, and `CHANGELOG.md` match the shipped behavior.
- D4: A PR is open against `mifunedev/agro:development` with its observed CI state reported, and it is not merged.

## Advisor orchestration
One bounded implementation worker owns the coupled code, test, probe, and prose edits inside the feature worktree. The advisor reviews the diff, runs verification, owns acceptance, commits, and publishes the PR. Repairs return to the same worker.

## Knowledge Context
- Base commit: `dd5ff0c0`
- Grounded against: `.agro/cli/src/commands/cloud.ts`, `.agro/cli/src/cli.ts`, `.agro/cli/src/lib/oh-config.ts`, `.agro/compat-inventory.json`, `.agro/evals/probes/oh-lifecycle-surface.sh`.
- Staleness evidence: last feature commit `766fb311` on 2026-07-09; three later commits are repository-wide sweeps.

## Expected Knowledge Impact
REQUIRED: the lifecycle verb set loses `cloud`. Historical changelog entries and archived task evidence remain unchanged.

## Plan Reconciliation
Intent preserved: YES. The retirement deletes the stale surface while keeping the compatibility ledger honest. No unrelated verb or provider setting changes.

## Affected surfaces
- Host and sandbox: applied; edit and verify in the sandbox worktree, no host change.
- Lifecycle door: applied; `agro` loses one verb, and the probe that guards the verb set is updated in the same commit.
- Canonical and provider: applied; all edits are canonical under `.agro/`, no mirror is patched.
- Root and scaffold: applied; `agro.json` and `.example.env` affect initialized projects.
- Interactive and headless: not applicable; no service changes.
- Local and remote: applied; no terminal-dependent state.
- Parallel operation: applied; single writer in an isolated worktree.
- Public documentation: applied in repository docs; a matching `mifunedev/agro-web` change is out of scope for this PR.
- Verification: unit tests, typecheck, tier-A probes, CI.

## Non-goals
- Do not merge the PR.
- Do not change `cloudflared`, Langfuse Cloud, or `gcloud` hook deny-patterns. These are unrelated uses of the word.
- Do not delete `.agro/evals/probes/oh-config-surfaces.sh`. It keeps asserting that `OH_CLOUD_CONFIG` never returns, which enforces the retirement.
