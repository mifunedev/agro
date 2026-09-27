# PRD: Retire pi-dynamic-workflows from Pi defaults

Status: DRAFT

## User Stories

### US-001: Remove the dynamic workflow pin from the default Pi packages

**Description:** As an operator, I want the default Pi package list to exclude `pi-dynamic-workflows` so that `/delegate` stays the one bounded delegation path.

**Acceptance Criteria:**

- [ ] Red test first: the updated `.pi/extensions/__tests__/settings.test.ts` fails against the current `.pi/settings.json`, as issue 1054 describes.
- [ ] `.pi/settings.json` `packages` equals the first nine current entries, in the current order, with no tenth entry.
- [ ] Every other key and value in `.pi/settings.json` stays byte-identical.
- [ ] The test asserts the exact nine-entry list.
- [ ] The test asserts that no entry in `packages` matches `/pi-dynamic-workflows/i`. This assertion covers `git:`, `npm:`, and `https:` sources.
- [ ] `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 0.

### US-002: Remove the retired tool from current documentation

**Description:** As a Pi user, I want the documentation to stop advertising `pi-dynamic-workflows` so that I use `/delegate` for bounded fan-out.

**Acceptance Criteria:**

- [ ] `docs/harnesses/pi.md` has no package bullet for `pi-dynamic-workflows`, no `pi -e` example for the package, and no `## Dynamic workflows` section.
- [ ] `docs/installation.md` line 188 no longer lists `pi-dynamic-workflows` as a default.
- [ ] `docs/integrations/pi-fff.md` no longer names `pi-dynamic-workflows` as a precedent.
- [ ] `docs/integrations/pi-dynamic-workflows.md` is deleted, and `docs/README.md` has no link to the file.
- [ ] `docs/harnesses/pi.md` holds a short migration note. The note names `/delegate` as the replacement.
- [ ] The migration note states that a running Pi session keeps the tool until the operator restarts Pi or runs `/reload`.
- [ ] The migration note states that a global Pi settings entry or a `pi -e` flag still loads the package, and that the harness does not remove either one.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` returns only the migration note lines.
- [ ] `CHANGELOG.md` holds a new entry for the retirement. The historical entry at line 681 stays unchanged.

## Summary

The harness pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the tenth entry of `packages` in `.pi/settings.json`. The package registers a `workflow` tool. That tool duplicates the bounded delegation that `/delegate` owns.

The selected approach removes the pin, updates the exact-list test, adds a negative identity assertion, and removes the current documentation. The change touches only tracked repository files. The change does not touch global Pi settings, the Pi package cache, sessions, the Slack gateway, or provider mirrors.

A static search of `.agro/install`, `.agro/scripts`, `.agro/cli`, `.devcontainer`, `.github`, and `.agro/evals` found no reference to the package or to `.pi/settings.json`. The scaffold path for initialized projects is an open question.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Default project Pi packages. Line 27 holds the pin. |
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness` | Exact-list regression test. |
| `docs/harnesses/pi.md` | lines 45, 60, 137-141 | Package bullet, `pi -e` example, and `## Dynamic workflows` section. |
| `docs/installation.md` | line 188 | Default package list prose. |
| `docs/integrations/pi-dynamic-workflows.md` | whole file | Integration page for the retired package. |
| `docs/integrations/pi-fff.md` | line 16 | Precedent reference. |
| `docs/README.md` | line 58 | Link to the integration page. |
| `CHANGELOG.md` | new entry | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Documentation site | Remove and add | Delete the `pi-dynamic-workflows` integration page. Add one migration note. |
| Documentation site | Remove and add | Delete one page. Add one migration note. |

## Storage

N/A. The change edits one tracked configuration file. The change adds no persistent state.

## Architectural Decisions

- `.pi/settings.json` stays the one source of truth for default project Pi packages.
- `/delegate` in `.agro/skills/delegate/SKILL.md` stays the one owner of bounded delegation.
- Retirement covers harness defaults only. Operator-managed global settings and `pi -e` flags stay outside harness control.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | exact nine-entry `packages` list | US-001 pin removal and order |
| `.pi/extensions/__tests__/settings.test.ts` | no entry matches `/pi-dynamic-workflows/i` | US-001 identity across sources |
| `npm test` | full vitest suite | Pi regressions stay green |
| `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` | static probe | US-002 documentation removal |

## Design Principles

- Delete the obsolete path. Do not leave a dormant alternative.
- Keep one owner for each behavior.
- Make the smallest change that removes the default.
- Add no code comments.

## Out of Scope

- Changes to Pi upstream or to the package upstream.
- Removal of global installations, caches, or sessions.
- Migration of user workflow scripts.
- A replacement workflow engine.
- Removal of other orchestration packages, such as `@tintinweb/pi-subagents` and `@tintinweb/pi-tasks`.

## Open Questions

1. Does any scaffold or distribution path copy `.pi/settings.json` into initialized projects? The static search found no such path. The implementation owner confirms the result before the pull request.
2. Does `mifunedev/agro-web` mirror `docs/integrations/pi-dynamic-workflows.md` or the Pi package list? If yes, the operator opens a matching change in `mifunedev/agro-web`.

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `git diff --stat` shows changes only in `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `docs/`, `CHANGELOG.md`, and `.agro/tasks/retire-pi-dynamic-workflows/`.
- [ ] The pull request body records a disposition with evidence for each open question.

## Lessons

Filled by the advisor before undraft.
