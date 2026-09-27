# PRD: Retire pi-dynamic-workflows from the default Pi configuration

Status: DRAFT

## User Stories

### US-001: Remove the dynamic workflow pin from the default Pi packages

**Description:** As an operator, I want the default Pi packages to exclude `pi-dynamic-workflows` so that the `/delegate` skill is the one bounded delegation path.

**Acceptance Criteria:**

- [ ] Red test first: the worker edits `.pi/extensions/__tests__/settings.test.ts` before `.pi/settings.json`. Then `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 1 on the unchanged `.pi/settings.json`.
- [ ] The exact-list assertion in `.pi/extensions/__tests__/settings.test.ts` lists the nine remaining packages in the current order, from `npm:@tintinweb/pi-subagents@0.12.0` to `npm:cc-safety-net@1.0.6`.
- [ ] The same test asserts that no entry in `settings.packages` matches `/pi-dynamic-workflows/i`. This assertion covers `npm:`, `git:`, and URL sources, not only the old commit string.
- [ ] `.pi/settings.json` no longer contains the line `"git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1"`.
- [ ] `git diff -- .pi/settings.json` shows one removed package line and one changed comma, and no other change.
- [ ] `jq -e . .pi/settings.json` exits 0.
- [ ] `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 0 after the change.

### US-002: Retire the current documentation and add a migration note

**Description:** As an operator, I want current documentation to stop advertising the package and its `workflow` tool. I want a migration note that names the replacement and the unchanged installations so that I adopt the `/delegate` skill.

**Acceptance Criteria:**

- [ ] The worker deletes `docs/integrations/pi-dynamic-workflows.md`.
- [ ] `docs/README.md` no longer links `integrations/pi-dynamic-workflows.md`.
- [ ] `docs/harnesses/pi.md` removes the `pi-dynamic-workflows` package bullet at line 45 and the `pi -e git:github.com/Michaelliv/pi-dynamic-workflows@...` example at line 60.
- [ ] `docs/harnesses/pi.md` replaces the `## Dynamic workflows` section at lines 137-141 with a migration note of 5 sentences or fewer.
- [ ] The migration note names `/delegate` as the replacement for bounded fan-out.
- [ ] The migration note states the reload boundary: a Pi session that started before the change keeps the `workflow` tool until the operator restarts that session.
- [ ] The migration note states the global-override boundary: a global Pi settings entry or a `pi -e` flag still loads the package, and the harness does not remove either one.
- [ ] `docs/installation.md` line 188 no longer lists `pi-dynamic-workflows` among the default packages.
- [ ] `docs/integrations/pi-fff.md` lines 15-16 no longer cite `pi-dynamic-workflows` as the precedent for the package path.
- [ ] `CHANGELOG.md` has one `### Removed` entry under `## [Unreleased]` that names `pi-dynamic-workflows`, `/delegate`, and issue `#1054`.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` prints only lines of the migration note.

### US-003: Record the distribution and public-documentation disposition

**Description:** As the advisor, I want an evidence-backed disposition for distribution and public documentation so that the retirement has no unverified downstream surface.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-pi-dynamic-workflows/evidence.md` records the output of `git grep -n '\.pi/settings.json\|\.pi/' -- .agro/scripts .agro/install .agro/cli/src .devcontainer package.json`, and states whether any installer or image step copies `.pi/settings.json`.
- [ ] `evidence.md` records whether `mifunedev/agro-web` mirrors `docs/integrations/pi-dynamic-workflows.md` or the `## Dynamic workflows` section. The record cites the command and the result.
- [ ] If `mifunedev/agro-web` mirrors either page, `evidence.md` names the follow-up issue or pull request in `mifunedev/agro-web`.
- [ ] `evidence.md` records that the change touched no file outside the repository, no Pi global settings, no Pi package cache, no session, no gateway, and no provider mirror.

## Summary

Issue #1054 (`work/issue-1054.md`) retires `pi-dynamic-workflows` from the harness defaults. The package registers a `workflow` tool. That tool duplicates the bounded delegation that `/delegate` owns. Retirement removes the package from harness defaults. Retirement does not ban an operator-managed global or `-e` installation.

Verified current state:

- `.pi/settings.json:27` pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the last entry of `packages`.
- `.pi/extensions/__tests__/settings.test.ts:15-28` asserts the exact ten-entry list, including the pin at line 27. The test has no negative assertion.
- `docs/harnesses/pi.md:45`, `:60`, and `:137-141` advertise the package and the `workflow` tool.
- `docs/integrations/pi-dynamic-workflows.md` documents the package. `docs/README.md:58` links that page.
- `docs/installation.md:188` lists the package among the defaults.
- `docs/integrations/pi-fff.md:15-16` cites the package as a precedent.
- `CHANGELOG.md:681` records the original addition under #451. That entry is history and stays.
- `vitest.config.ts:28` includes `.pi/**/__tests__/**/*.test.ts`. `package.json:13` defines `"test": "vitest run"`.
- `git grep` found no copy of `.pi/settings.json` in `.agro/scripts`, `.agro/install`, `.agro/cli`, or `.devcontainer`. US-003 confirms this result in evidence.

Selected approach: change the test first, then remove the pin, then retire the documentation. Put the migration note in `docs/harnesses/pi.md` and delete the integration page.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` array, line 27 | Default project-local Pi package list. |
| `.pi/extensions/__tests__/settings.test.ts` | `"pins the default Pi packages used by the harness"` | Exact-list assertion and the new negative identity assertion. |
| `docs/harnesses/pi.md` | Package bullet line 45, `pi -e` example line 60, `## Dynamic workflows` lines 137-141 | Pi harness documentation and the migration note location. |
| `docs/integrations/pi-dynamic-workflows.md` | Whole file | Retired integration page. |
| `docs/README.md` | Line 58 link | Documentation index. |
| `docs/installation.md` | Line 188 default package list | Installation documentation. |
| `docs/integrations/pi-fff.md` | Lines 15-16 precedent sentence | Cross-reference to the retired package. |
| `CHANGELOG.md` | `## [Unreleased]` | Release note for the removal. |
| `.agro/skills/delegate/SKILL.md` | Canonical delegation procedure | Replacement that the migration note names. The task reads this file and does not change it. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Pi default packages | Removal | A new Pi session in the project no longer loads the package or its `workflow` tool. |
| Pi `workflow` tool | Removal from defaults | Operator-managed global or `-e` installations keep the package and its `workflow` tool. |
| `docs/integrations/pi-dynamic-workflows.md` | Deletion | The page and its index link leave the documentation. |
| `docs/harnesses/pi.md` | Migration note | The note replaces the `## Dynamic workflows` section. |

## Storage

N/A. The change edits one tracked configuration file and removes no persistent state. Pi runtime state, the Pi package cache, and Pi global settings stay unchanged.

## Architectural Decisions

- `.pi/settings.json` is the source of truth for default Pi packages. The test in `.pi/extensions/__tests__/settings.test.ts` is its oracle.
- `/delegate` in `.agro/skills/delegate/SKILL.md` owns bounded delegation. The harness keeps one delegation path for each concern.
- The negative assertion matches the package identity `pi-dynamic-workflows`, not a source string. A reintroduction through a new commit, tag, npm name, or URL fails the test.
- The harness scope ends at the repository. The task does not modify Pi global settings, the Pi package cache, running sessions, gateways, or provider mirrors.
- The integration page is deleted, not kept as a stub. Current documentation keeps one migration note in `docs/harnesses/pi.md`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness`: exact nine-entry list | The remaining pins and their order stay unchanged. |
| `.pi/extensions/__tests__/settings.test.ts` | New negative case: no entry matches `/pi-dynamic-workflows/i` | Package identity stays out of defaults for each source form. |
| `.pi/extensions/__tests__/*.test.ts` | Current cases, unchanged | Pi regressions stay green: `npx vitest run .pi` exits 0. |
| Static probe | `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` | Only the migration note names the package. |
| Static probe | `jq -e . .pi/settings.json` | The settings file stays valid JSON. |

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives.
- Keep one source of truth for each policy: `/delegate` owns bounded delegation.
- Make the smallest change that preserves every other package and setting.
- Use tests as evidence. Write the red test before the settings change.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to Pi upstream or to the `pi-dynamic-workflows` upstream repository.
- Removal of global Pi installations or of `-e` usage.
- Migration of operator workflow scripts.
- A replacement workflow engine.
- Removal of other orchestration packages, such as `@tintinweb/pi-subagents` or `@tintinweb/pi-tasks`.
- Edits to the historical `CHANGELOG.md:681` entry.

## Open Questions

1. Does `mifunedev/agro-web` mirror `docs/integrations/pi-dynamic-workflows.md` or the `## Dynamic workflows` section? US-003 answers this question with evidence. A positive answer needs a follow-up in `mifunedev/agro-web`.
2. Does an external page link `docs/integrations/pi-dynamic-workflows.md`? This plan deletes the page. If the operator wants a redirect stub instead, the operator states that choice before execution.

## Acceptance Criteria

- [ ] `npx vitest run .pi` exits 0.
- [ ] `npm test` exits 0, or each failure also occurs on the base commit, and `evidence.md` lists it.
- [ ] `.pi/settings.json` keeps every key and every non-retired package from the base commit.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` prints only lines of the migration note.
- [ ] `git diff --stat` for the task lists only `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `docs/harnesses/pi.md`, `docs/integrations/pi-dynamic-workflows.md`, `docs/README.md`, `docs/installation.md`, `docs/integrations/pi-fff.md`, and `CHANGELOG.md`.
- [ ] `.agro/tasks/retire-pi-dynamic-workflows/evidence.md` holds the distribution and public-documentation disposition from US-003.

## Lessons

Filled by the advisor before undraft.
