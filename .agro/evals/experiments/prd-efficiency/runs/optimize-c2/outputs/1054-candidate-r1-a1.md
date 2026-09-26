# PRD: Retire pi-dynamic-workflows from the default Pi configuration

Status: DRAFT

## User Stories

### US-001: Remove the default package pin

**Description:** As an operator, I want the default Pi packages to exclude dynamic workflows so that `/delegate` owns delegation.

**Acceptance Criteria:**

- [ ] The implementer updates `.pi/extensions/__tests__/settings.test.ts` first, and the test fails against the unchanged `.pi/settings.json`.
- [ ] The `packages` array in `.pi/settings.json` holds the nine remaining entries in their current order.
- [ ] Every other key and value in `.pi/settings.json` stays byte-identical.
- [ ] The test asserts the exact nine-entry list with `toEqual`.
- [ ] The test asserts that no package entry matches `/pi-dynamic-workflows/i`, so `npm:`, `git:`, and URL sources all fail.
- [ ] The test keeps the assertion that `settings.skills` is undefined.
- [ ] `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 0.

### US-002: Remove the retired tool from current documentation

**Description:** As an operator, I want current docs to stop advertising `workflow` so that docs match the defaults.

**Acceptance Criteria:**

- [ ] The `pi-dynamic-workflows` bullet is absent from the package list in `docs/harnesses/pi.md`.
- [ ] The manual `pi -e` sentence in `docs/harnesses/pi.md` no longer names the `pi-dynamic-workflows` source.
- [ ] The implementer replaces the `## Dynamic workflows` section in `docs/harnesses/pi.md` with a short migration note.
- [ ] The migration note names `/delegate` as the replacement for bounded fan-out.
- [ ] The migration note states that a running Pi session keeps the loaded `workflow` tool until the operator restarts or reloads Pi.
- [ ] The migration note states that an operator can still install the package globally or with `pi -e`, and the harness does not remove that install.
- [ ] The package sentence in `docs/installation.md` no longer names `pi-dynamic-workflows`.
- [ ] The implementer deletes `docs/integrations/pi-dynamic-workflows.md`, and removes the matching link from `docs/README.md`.
- [ ] The sentence in `docs/integrations/pi-fff.md` no longer cites `pi-dynamic-workflows` as the package-path example.
- [ ] `git grep -n -i 'dynamic-workflows' -- docs .pi` prints only the migration-note lines in `docs/harnesses/pi.md`.

### US-003: Record the removal and its distribution disposition

**Description:** As a maintainer, I want a changelog entry and a disposition record so that reviewers can check the retirement.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` has one new bullet under `## [Unreleased]` in a `### Removed` subsection, and the bullet links issue 1054.
- [ ] The historical `CHANGELOG.md` entry for issue 451 stays unchanged.
- [ ] The PR body records the output of `git grep -n -i 'dynamic-workflows' -- ':!CHANGELOG.md'` as the distribution evidence.
- [ ] The PR body records the disposition for `mifunedev/agro-web`: a linked follow-up issue, or a statement that no page names the package.
- [ ] `git diff --stat` for the task branch shows no change under `.devcontainer/`, `.claude/`, or other provider mirrors.

## Summary

Issue 1054 retires `pi-dynamic-workflows` from the Open Harness Pi defaults. The package registers a `workflow` tool. That tool duplicates the bounded delegation that `.agro/skills/delegate/SKILL.md` owns.

Verified current state:

- `.pi/settings.json` line 27 pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the last `packages` entry.
- `.pi/extensions/__tests__/settings.test.ts` line 27 asserts that pin inside an exact `toEqual` list.
- `docs/harnesses/pi.md` names the package at lines 45 and 60, and holds a `## Dynamic workflows` section at lines 137 to 141.
- `docs/installation.md` line 188 lists the package among the defaults.
- `docs/integrations/pi-dynamic-workflows.md` documents the package, and `docs/README.md` line 58 links that page.
- `docs/integrations/pi-fff.md` line 16 cites the package as an example of the package path.
- `CHANGELOG.md` line 681 records the original addition under issue 451.
- No file under `.devcontainer/` or `.agro/install/` names the package. Pi installs project packages from `.pi/settings.json` at startup, so the image does not bake the package.

Selected approach: delete the pin, tighten the test, delete the integration page, and put one migration note in `docs/harnesses/pi.md`. Retirement removes the harness default only. An operator keeps the option of a global or `-e` install.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Default Pi package list; the pin leaves this list |
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness` | Exact-list and negative package-identity assertions |
| `docs/harnesses/pi.md` | package list, manual `pi -e` sentence, `## Dynamic workflows` | Current Pi docs; hosts the migration note |
| `docs/installation.md` | line 188 package sentence | Default-package summary |
| `docs/integrations/pi-dynamic-workflows.md` | whole file | Integration page to delete |
| `docs/README.md` | `## Integrations` list | Link to the deleted page |
| `docs/integrations/pi-fff.md` | line 16 | Package-path example sentence |
| `CHANGELOG.md` | `## [Unreleased]` | Removal entry |
| `.agro/skills/delegate/SKILL.md` | none; read-only | Replacement named in the migration note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Pi project package list | Removal | New Pi sessions in this project no longer load the package `workflow` tool |
| Documentation site `docs/` | Removal and edit | The integration page goes away; the Pi harness page gains a migration note |
| `mifunedev/agro-web` | Disposition only | The PR body records a follow-up issue or a no-change statement |

## Storage

N/A. The change edits tracked configuration and documentation. The task writes no runtime state, cache, or session data.

## Architectural Decisions

- `.pi/settings.json` stays the single source of truth for default Pi packages.
- `/delegate` stays the single owner of bounded fan-out. The harness adds no replacement workflow engine.
- The negative test asserts package identity by name, not by commit, so a re-add from another source fails the test.
- The harness does not touch global Pi settings, the Pi package cache, Pi sessions, gateways, or provider mirrors.
- The migration note lives in `docs/harnesses/pi.md`. A separate retirement page adds a dormant path, so the plan deletes the integration page.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | exact nine-entry `packages` list | US-001 default list |
| `.pi/extensions/__tests__/settings.test.ts` | no entry matches `/pi-dynamic-workflows/i` | US-001 negative package identity |
| `.pi/extensions/__tests__/settings.test.ts` | `settings.skills` stays undefined | US-001 settings without skills |
| none; command check | `git grep -n -i 'dynamic-workflows' -- docs .pi` | US-002 documentation sweep |
| none; full suite | `npm test` exits 0 | Pi regressions stay green |

## Design Principles

- Delete obsolete paths. Leave no dormant integration page.
- Keep one source of truth for each policy: `.pi/settings.json` for packages, `/delegate` for delegation.
- Add no explanatory comments to tracked code.
- Make the smallest change that removes the default.

## Out of Scope

- Changes to the upstream Pi project or to the `pi-dynamic-workflows` project.
- Purges of global Pi installs, the Pi package cache, or Pi sessions.
- Migration of operator workflow scripts.
- A replacement workflow engine.
- Removal of other orchestration packages, such as `@tintinweb/pi-subagents` or `@tintinweb/pi-tasks`.
- Edits to historical `CHANGELOG.md` entries or archived task plans.
- Direct edits to `mifunedev/agro-web` in this task.

## Open Questions

1. Does any `mifunedev/agro-web` page name `pi-dynamic-workflows` or `workflow`? The implementer checks that repository, then opens a follow-up issue or records "no change" in the PR body.
2. Does `vitest.config.ts` include `.pi/extensions/__tests__/`? The existing test implies yes. The implementer confirms that `npm test` runs `settings.test.ts`.

## Acceptance Criteria

- [ ] `.pi/settings.json` holds nine `packages` entries, and none matches `/pi-dynamic-workflows/i`.
- [ ] `npm test` exits 0.
- [ ] `git grep -n -i 'dynamic-workflows' -- docs .pi` prints only the migration-note lines in `docs/harnesses/pi.md`.
- [ ] The migration note names `/delegate`, the reload boundary, and the global-override boundary.
- [ ] `CHANGELOG.md` has a `### Removed` bullet under `## [Unreleased]` that links issue 1054.
- [ ] The PR body records the distribution evidence and the `mifunedev/agro-web` disposition.
- [ ] The diff touches no global settings, cache, session, gateway, or provider mirror.

## Lessons

Filled by the advisor before undraft.
