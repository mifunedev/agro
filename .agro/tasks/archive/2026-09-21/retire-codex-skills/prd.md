# Retire Codex skills mirror

## Intent
Create a PR that retires `.codex/skills` in favor of `.agents/skills`. The user explicitly requested implementation and a PR. Do not merge.

## Architecture decision
Reuse the existing Pi retirement tables and collision-preserving migration logic. Keep `.agro/skills` as canonical source and `.agents/skills` as Codex's discovery surface. A hard delete during migration risks user content; keeping the active mirror fails the requested retirement. No new abstraction or ADR is needed.

## Definition of Done
- D1: Fresh checkouts and initialization expose skills through `.agents/skills`, not `.codex/skills`.
- D2: Initialization and `agro migrate` preserve known old links under `.migrated` only when independent replacement discovery survives. Refuse user-content and destination collisions.
- D3: Regression tests cover successful retirement, idempotence, check mode, and preservation failures. Current docs and changelog match behavior.
- D4: Open a PR against `mifunedev/agro:development`; report its observed CI state and do not merge.

## Advisor orchestration
One bounded implementation worker owns the coupled code, tests, and prose edits in the feature worktree. The advisor reviews its diff, runs verification, owns acceptance, commits, and publishes the PR. Repairs return to the same worker.

## Knowledge Context
- Base commit: `33875d63`
- Grounded against: `.agro/scripts/link-providers.sh`, `.agro/cli/src/lib/migrate.ts`, `.agro/evals/probes/skills-vendored.sh`, `docs/rfcs/README.md`.
- Knowledge used: `.agro/knowledge/source/oh-cli-portable-lifecycle.md`; active provider list requires updating.

## Expected Knowledge Impact
REQUIRED: update the portable lifecycle page's migration contract. Historical raw snapshots and archived task evidence remain unchanged.

## Plan Reconciliation
Intent preserved: YES. Safe retirement uses the existing mechanism rather than deleting user-owned directories. No unrelated provider settings change.

## Affected surfaces
- Host and sandbox: applied; edit and test in sandbox worktree, no host changes.
- Lifecycle door: applied; provider init/check and agro migrate remain aligned.
- Canonical and provider: applied; canonical code stays in .agro; remove only retired mirror.
- Root and scaffold: applied; fresh checkout and existing workspace migration.
- Interactive and headless: not applicable; no service changes.
- Local and remote: applied; no terminal-dependent state.
- Parallel operation: applied; single writer in isolated worktree.
- Public documentation: applied in repository docs; separate agro-web deployment is not part of this PR.
- Verification: migration tests, vendored-skill probe, provider checks, CI.
