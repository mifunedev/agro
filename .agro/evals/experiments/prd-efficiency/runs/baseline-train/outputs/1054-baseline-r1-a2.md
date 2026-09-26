# PRD: Retire pi-dynamic-workflows from Pi defaults

Status: DRAFT

## User Stories

### US-001: Remove the default package pin

**Description:** As an operator, I want the harness default Pi packages to exclude `pi-dynamic-workflows` so that Pi sessions use `/delegate` as the one bounded delegation path.

**Acceptance Criteria:**

- [ ] `.pi/settings.json` `packages` holds exactly the nine `npm:` entries that precede the removed `git:` entry, in the current order.
- [ ] Every other key and value in `.pi/settings.json` stays unchanged: `git diff -- .pi/settings.json` shows only the removed entry and the trailing-comma change on `npm:cc-safety-net@1.0.6`.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts the new exact nine-entry list with `toEqual`.
- [ ] The same test file asserts that no `packages` entry matches the case-insensitive pattern `pi-dynamic-workflows`. The pattern covers `npm:`, `git:`, `https:`, and local-path sources.
- [ ] The negative assertion fails when a worker adds `npm:pi-dynamic-workflows@1.0.1` to a copy of the settings fixture. The worker records this red run in `evidence.md`.
- [ ] `npx vitest run .pi/extensions/__tests__/` exits 0.

### US-002: Retire the documentation and add a migration note

**Description:** As a Pi user, I want current documentation to name `/delegate` instead of `workflow` so that I know the replacement.

**Acceptance Criteria:**

- [ ] `docs/integrations/pi-dynamic-workflows.md` is deleted.
- [ ] `docs/README.md` has no link to `integrations/pi-dynamic-workflows.md`.
- [ ] `docs/harnesses/pi.md` has no `pi-dynamic-workflows` entry under `## Default packages`, and the `pi -e` example list omits the `git:github.com/Michaelliv/pi-dynamic-workflows@...` source.
- [ ] `docs/harnesses/pi.md` replaces `## Dynamic workflows` with a migration note of five sentences or fewer.
- [ ] The migration note names `/delegate` as the replacement for bounded fan-out.
- [ ] The migration note states the reload boundary: a Pi session that loaded the package keeps the `workflow` tool until the operator runs `/reload` or restarts Pi.
- [ ] The migration note states the global-override boundary: a package in the operator's global Pi settings or a `pi -e` flag still loads, and the harness does not remove it.
- [ ] `docs/installation.md` `## What's Installed` no longer lists `pi-dynamic-workflows`.
- [ ] `docs/integrations/pi-fff.md` no longer cites `pi-dynamic-workflows` as the precedent for the package path.
- [ ] `git grep -n pi-dynamic-workflows -- docs .pi ':!.pi/extensions/__tests__/settings.test.ts'` prints only lines in the `docs/harnesses/pi.md` migration note.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one `### Removed` entry that names the retirement, `/delegate`, and issue #1054.
- [ ] The historical entry at `CHANGELOG.md` for #451 stays unchanged.

### US-003: Verify regressions and record dispositions

**Description:** As the advisor, I want evidence of green Pi regressions and untouched external state so that I can accept the retirement.

**Acceptance Criteria:**

- [ ] `npm test` exits 0 at the repository root.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0.
- [ ] `bash .agro/evals/probes/codex-stale-response-retry.sh` exits 0.
- [ ] `git diff --name-only <base>...HEAD` lists only `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `CHANGELOG.md`, the four edited docs, the deleted integration page, and files under `.agro/tasks/retire-pi-dynamic-workflows/`.
- [ ] The diff touches no path under `.claude/`, `.codex/`, `.agents/`, or `.pi/skills`, and no gateway or bridge file under `.pi/`.
- [ ] `evidence.md` records that no command touched the operator's global Pi settings, the `.pi/git` or `.pi/npm` package caches, Pi sessions, or the Slack gateway.
- [ ] `evidence.md` records the distribution disposition: `.agro/cli/package.json` `files` ships only `dist` and `NOTICE`, and `git grep` finds no `pi-dynamic-workflows` reference under `.devcontainer/`, so the change reaches users only through the repository checkout.
- [ ] `evidence.md` records the `mifunedev/agro-web` disposition with the search command and its result.

## Summary

Verified current state:

- `.pi/settings.json` pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the tenth `packages` entry.
- `.pi/extensions/__tests__/settings.test.ts` asserts the ten-entry list with `toEqual`. The test holds no negative identity assertion.
- Five current docs advertise the package: `docs/integrations/pi-dynamic-workflows.md`, `docs/harnesses/pi.md` (default list, `pi -e` example, and `## Dynamic workflows`), `docs/installation.md`, `docs/README.md`, and `docs/integrations/pi-fff.md`.
- `CHANGELOG.md` line 681 records the #451 addition. That entry is history and stays.
- No probe under `.agro/evals/probes/` names the package. No file under `.devcontainer/` names the package.
- `.agro/cli/package.json` `files` ships `dist` and `NOTICE`. The npm CLI does not ship `.pi/`.
- `docs/README.md` states that the rendered docs site source lives in `mifunedev/agro-web`.

Selected approach: remove the pin and add an exact-list check plus a negative identity check to the test. Delete the integration page. Replace the Pi section with a short migration note. Write the test change first, watch the test fail against the current settings, then edit the settings.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Default project-local Pi packages |
| `.pi/extensions/__tests__/settings.test.ts` | `project Pi settings` suite | Pin and identity regression |
| `docs/harnesses/pi.md` | `## Default packages`, `## Dynamic workflows` | Pi user guide and migration note |
| `docs/integrations/pi-dynamic-workflows.md` | whole file | Retired integration page |
| `docs/README.md` | `## Integrations` | Docs index |
| `docs/installation.md` | `## What's Installed` | Installed-package summary |
| `docs/integrations/pi-fff.md` | package-path paragraph | Cross-reference to the retired package |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Pi `workflow` tool | Removed from defaults | New or reloaded project Pi sessions no longer register `workflow` |
| `/delegate` | Unchanged | The documented replacement for bounded fan-out |
| Global Pi settings and `pi -e` | Unchanged | Operator-managed installs keep loading |
| `mifunedev/agro-web` | Disposition only | US-003 records whether the site mirrors the retired page |

## Storage

N/A. The change edits tracked configuration and docs. The change writes no runtime state. The implementation leaves the `.pi/git` and `.pi/npm` package caches in place.

## Architectural Decisions

- `/delegate` in `.agro/skills/delegate/SKILL.md` stays the single source of truth for bounded delegation.
- `.pi/settings.json` stays the single source of truth for default Pi packages. The test pins that file.
- The negative assertion checks package identity by name, not by the old commit string. A reintroduction from any source fails the test.
- Retirement changes harness defaults only. The harness does not purge, block, or detect operator-managed installs.
- No `agro` verb, provider mirror, or scaffold path changes.

Affected surfaces:

- Host and sandbox: applied. The worker edits and tests in a sandbox worktree.
- Lifecycle door: not applicable. No `agro` verb reads the package list.
- Canonical and provider surfaces: not applicable. `.pi/settings.json` is canonical Pi configuration, not a mirror of `.agro/`.
- Root and scaffold: applied. The change reaches initialized projects through the repository checkout only.
- Interactive and headless processes: applied. Running Pi sessions keep the tool until `/reload`. The Slack gateway loads Pi separately and stays untouched.
- Local and remote operation: not applicable. No process or terminal state changes.
- Parallel operation: applied. One worker owns all files in one worktree.
- Public documentation: applied. US-003 records the `mifunedev/agro-web` disposition.
- Verification: applied. Vitest, two Pi probes, and `ci-harness.yml` on `.pi/**` and `docs/**` paths.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness` | Exact nine-entry list and `skills` undefined |
| `.pi/extensions/__tests__/settings.test.ts` | `<new case name>` excluding `pi-dynamic-workflows` | No entry matches `/pi-dynamic-workflows/i` |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | whole probe | The `cc-safety-net` pin survives the edit |
| `.agro/evals/probes/codex-stale-response-retry.sh` | whole probe | Pi extension wiring stays green |

Order: change the test first. Run `npx vitest run .pi/extensions/__tests__/settings.test.ts` and confirm the failure. Edit `.pi/settings.json`. Run the test again and confirm the pass.

## Design Principles

- Delete obsolete paths. Do not leave a dormant integration page.
- Keep one delegation mechanism: `/delegate`.
- Make the smallest change that meets the goals.
- Add no explanatory comments to tracked code.
- Apply `/ste` to the migration note and the changelog entry.

## Out of Scope

- Changes to Pi upstream or to `pi-dynamic-workflows` upstream.
- A purge of global installs, package caches, or sessions.
- Migration of user workflow scripts.
- A replacement workflow engine.
- Removal of `@tintinweb/pi-subagents`, `@tintinweb/pi-tasks`, or other orchestration packages.
- Edits in the `mifunedev/agro-web` repository.
- Edits to archived task evidence or to the #451 changelog entry.

## Open Questions

1. Assume that `mifunedev/agro-web` holds its own copy of the retired page. Does the operator want a follow-up issue in that repository, or only a note in the pull request body?
2. Which path does the migration note use for the operator's global Pi settings file? The implementation must confirm the path from Pi upstream documentation. If the path is not confirmed, the note says "global Pi settings" and names no path.

## Acceptance Criteria

- [ ] Every US-001, US-002, and US-003 criterion passes.
- [ ] `git grep -n pi-dynamic-workflows -- . ':!CHANGELOG.md' ':!.agro/tasks' ':!work' ':!.pi/extensions/__tests__/settings.test.ts'` prints only migration-note lines in `docs/harnesses/pi.md`.
- [ ] `ci-harness.yml` passes on the pull request.

## Lessons

Filled by the advisor before undraft.
