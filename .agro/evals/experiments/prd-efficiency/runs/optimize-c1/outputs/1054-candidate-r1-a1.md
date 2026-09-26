# PRD: Retire pi-dynamic-workflows from the default Pi configuration

Status: DRAFT

Issue: #1054. Branch: `task/1054-retire-pi-dynamic-workflows`.

## User Stories

### US-001: Remove the default package pin and lock the removal with a test

**Description:** As an operator, I want the default Pi package list to exclude `pi-dynamic-workflows` so that new Pi sessions get bounded delegation from `/delegate` only.

**Acceptance Criteria:**

- [ ] Write the test change first. `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` fails on the unchanged `.pi/settings.json`.
- [ ] The `packages` array in `.pi/settings.json` holds the first nine current entries in the current order, from `npm:@tintinweb/pi-subagents@0.12.0` to `npm:cc-safety-net@1.0.6`.
- [ ] Each other key and value in `.pi/settings.json` stays byte-identical. `git diff .pi/settings.json` shows only the removed entry and the trailing comma on the new last entry.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts the exact nine-entry list with `toEqual`.
- [ ] The same test asserts that no entry in `packages` matches `/pi-dynamic-workflows/i`. The check covers a `git:`, an `npm:`, an `https:` source, and any ref or version.
- [ ] `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` exits 0 after the settings change.

### US-002: Remove the retired tool from current documentation and add a migration note

**Description:** As a Pi docs reader, I want the docs to stop advertising the `workflow` package tool so that I use `/delegate`. I also learn how a global install behaves.

**Acceptance Criteria:**

- [ ] `docs/integrations/pi-dynamic-workflows.md` is absent after the change.
- [ ] `docs/README.md` has no link to the deleted page.
- [ ] `docs/harnesses/pi.md` has no bullet for `pi-dynamic-workflows` in the default package list, and the `pi -e` sentence names no `pi-dynamic-workflows` source.
- [ ] `docs/installation.md` lists the default packages without `pi-dynamic-workflows`.
- [ ] `docs/integrations/pi-fff.md` has no reference to `pi-dynamic-workflows`.
- [ ] The `## Dynamic workflows` section in `docs/harnesses/pi.md` becomes a migration note of five sentences or fewer.
- [ ] The migration note names `/delegate` as the replacement for bounded fan-out.
- [ ] The migration note tells a running Pi session to run `/reload` or restart Pi before the removal takes effect.
- [ ] The migration note states that a global Pi install or a `pi -e` load of the package still registers the `workflow` tool, and that the harness does not remove such an install.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs` prints only the migration note lines.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/pi.md` reports no finding on the migration note lines.

### US-003: Record the change and the distribution disposition

**Description:** As a maintainer, I want the changelog and the PR body to record the retirement so that users and reviewers see its evidence.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` has one new bullet under `## [Unreleased]` in a `### Removed` subsection that names `pi-dynamic-workflows`, `/delegate`, and `#1054`.
- [ ] The historical bullet at `CHANGELOG.md` line 681 stays unchanged.
- [ ] The PR body records the output of `git grep -n -i 'dynamic-workflows' -- .devcontainer .agro/install .agro/scripts .github`, which prints nothing.
- [ ] The PR body records the public-documentation disposition for `mifunedev/agro-web` from Open Question 1.
- [ ] `pnpm test` exits 0.
- [ ] `git diff --name-only` names no path outside the Key Integration Points table.

## Summary

Verified current state:

- `.pi/settings.json` line 27 pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the last `packages` entry.
- `.pi/extensions/__tests__/settings.test.ts` asserts the exact ten-entry list, and `settings.skills` must be undefined.
- Current documentation advertises the package in five files:
  - `docs/harnesses/pi.md` lines 45, 60, and 137 to 141;
  - `docs/installation.md` line 188;
  - `docs/integrations/pi-dynamic-workflows.md`, the full page;
  - `docs/README.md` line 58;
  - `docs/integrations/pi-fff.md` line 16.
- No file under `.devcontainer`, `.agro/install`, `.agro/scripts`, or `.github` names the package. The sandbox image does not bake the package.
- The `oh update` manifest excludes `docs/**`, per `.agro/README.md`. Consumer repositories keep their own `.pi/settings.json` after an update, because the root `.pi/` is project state.
- The `Workflow tool` references under `.agro/skills/weigh/` name the Claude Code tool, not the Pi package. This task does not change them.

Selected approach: delete the pin, tighten the test with an exact list and a package-identity negative check, and delete the integration page. Replace the Pi harness section with a short migration note.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` array, line 27 | Default Pi package list. Remove the pin. |
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness` | Exact list plus new negative identity assertion. |
| `docs/harnesses/pi.md` | line 45 bullet, line 60 `pi -e` sentence, `## Dynamic workflows` section | Remove advertising. Hold the migration note. |
| `docs/installation.md` | line 188 default package sentence | Remove the package from the list. |
| `docs/integrations/pi-dynamic-workflows.md` | full page | Delete. |
| `docs/README.md` | line 58 integrations link | Remove the link. |
| `docs/integrations/pi-fff.md` | line 16 | Remove the comparison to the retired package. |
| `CHANGELOG.md` | `## [Unreleased]` | Add a `### Removed` bullet. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Pi project packages | Removal | A new or reloaded Pi session in this repository does not register the `workflow` package tool. |
| Documentation | Removal and note | The integration page goes away. `docs/harnesses/pi.md` carries the migration note. |
| `/delegate` | None | `.agro/skills/delegate/SKILL.md` stays unchanged. The note points to it. |
| Global Pi settings and `pi -e` | None | The harness does not touch the global Pi settings, the package cache, sessions, the Slack gateway, or provider mirrors. |

## Storage

N/A. The change edits one tracked configuration file. The change adds no persistent state and removes no runtime state.

## Architectural Decisions

- Source of truth: `.pi/settings.json` owns the default package list. The test locks the list.
- Package identity: the negative assertion matches the package name `pi-dynamic-workflows`, not the commit string. A re-added pin from any source or ref fails the test.
- Scope boundary: retirement removes a harness default. Operator-managed global installs and `-e` loads stay the operator's choice.
- The integration page goes away completely. A retained page would advertise a tool that the harness no longer ships.
- Surface review:
  - Host and sandbox: applied. The implementer edits tracked files and runs the tests inside the sandbox.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: not applicable. The change touches no `.agro/` primitive and no provider mirror.
  - Root and scaffold: applied. The root changes. `oh update` does not vendor `.pi/settings.json` or `docs/**`.
  - Interactive and headless processes: not applicable. The Slack gateway loads its own `--extension` list.
  - Local and remote operation: applied. A running Pi session keeps the tool until `/reload` or a restart. The migration note states this boundary.
  - Parallel operation: not applicable. The change adds no shared mutable state.
  - Public documentation: applied. See Open Question 1.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | Exact nine-entry `packages` list; `settings.skills` has no value | US-001 list and preserved settings |
| `.pi/extensions/__tests__/settings.test.ts` | No `packages` entry matches `/pi-dynamic-workflows/i` | US-001 package identity across sources |
| `.agro/evals/probes/cc-safety-net-wiring.sh` | Existing probe stays green | The `cc-safety-net` pin survives the edit |
| `.agro/evals/probes/codex-stale-response-retry.sh` | Existing probe stays green | `.pi/settings.json` still loads `.pi/extensions` |
| `git grep` command in US-002 | Output holds only migration note lines | US-002 documentation removal |

Run `pnpm test` for the full Vitest suite. Run `bash .agro/evals/probes/cc-safety-net-wiring.sh` and `bash .agro/evals/probes/codex-stale-response-retry.sh` for the Pi probes.

## Design Principles

- Delete obsolete paths. Do not leave a dormant integration page.
- Keep one source of truth: `.pi/settings.json` for defaults, `/delegate` for bounded delegation.
- Add no tracked-code comments.
- Make the smallest change that meets the goals. Add no replacement workflow engine.
- Write the migration note to `/ste` rules.

## Out of Scope

- Changes to Pi upstream or to the `pi-dynamic-workflows` repository.
- Removal of global installs, package caches, or sessions on any machine.
- Migration of user workflow scripts.
- A replacement workflow engine.
- Changes to `@tintinweb/pi-subagents`, `@tintinweb/pi-tasks`, or other orchestration packages.
- Changes to the `.agro/skills/weigh/` references to the Claude Code Workflow tool.
- Edits to historical `CHANGELOG.md` entries.

## Open Questions

1. Does `mifunedev/agro-web` mirror or render a page from `docs/integrations/pi-dynamic-workflows.md` or `docs/harnesses/pi.md`? This repository holds no evidence either way. The implementer checks the agro-web repository and records "no page" or a follow-up issue link in the PR body.
2. Does a consumer repository that earlier copied the root `.pi/settings.json` need a release-note instruction to remove the pin? The plan assumes the `### Removed` changelog bullet is enough.

## Acceptance Criteria

- [ ] `.pi/settings.json` holds no `pi-dynamic-workflows` entry, and all other content is byte-identical.
- [ ] `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` exits 0, and the test holds the negative identity assertion.
- [ ] `pnpm test` exits 0.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` prints only the migration note lines in `docs/harnesses/pi.md`.
- [ ] The migration note names `/delegate`, `/reload`, and the global-install boundary.
- [ ] `CHANGELOG.md` has the new `### Removed` bullet under `## [Unreleased]`.
- [ ] The PR body records the distribution evidence and the agro-web disposition.
- [ ] The diff touches no global Pi settings, cache, session, gateway, or provider mirror.

## Lessons

Filled by the advisor before undraft.
