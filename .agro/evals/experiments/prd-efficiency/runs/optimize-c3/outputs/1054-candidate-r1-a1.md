# PRD: Retire pi-dynamic-workflows from the default Pi configuration

Status: DRAFT

## User Stories

### US-001: Remove the default package pin and guard the removal

**Description:** As an operator, I want Pi defaults without the workflow package so that /delegate owns bounded delegation.

**Acceptance Criteria:**

- [ ] The `packages` array in `.pi/settings.json` holds the nine npm entries in their current order and no `pi-dynamic-workflows` entry.
- [ ] Every other key and value in `.pi/settings.json` stays byte-identical to the base commit.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts the new exact nine-entry list with `toEqual`.
- [ ] A new negative case fails when any `packages` entry contains `pi-dynamic-workflows`, case-insensitive, for npm, git, or URL sources.
- [ ] The negative case fails when the old git pin is restored, and the case passes on the new settings file.
- [ ] `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 0.

### US-002: Stop advertising the retired tool in current documentation

**Description:** As a Pi user, I want current docs to point to /delegate so that I stop using the retired tool.

**Acceptance Criteria:**

- [ ] `docs/harnesses/pi.md` has no package bullet, `pi -e` example, or "Dynamic workflows" section for `pi-dynamic-workflows`.
- [ ] `docs/installation.md` line 188 no longer lists `pi-dynamic-workflows` as a default package.
- [ ] `docs/integrations/pi-fff.md` no longer cites `pi-dynamic-workflows` as a precedent for the package path.
- [ ] `docs/integrations/pi-dynamic-workflows.md` holds only a short retirement note, and `docs/README.md` links to the note under a retirement title.
- [ ] The retirement note names `.agro/skills/delegate/SKILL.md` as the replacement for bounded delegation.
- [ ] The retirement note states that a running Pi session keeps the tool until the operator restarts Pi or runs the Pi reload command.
- [ ] The retirement note states that a global Pi settings entry or a `pi -e` flag still loads the package, and that the harness does not change those installations.
- [ ] `CHANGELOG.md` has one new Unreleased entry for the retirement, and line 681 stays unchanged as history.
- [ ] `git grep -n -i 'pi-dynamic-workflows' -- docs .pi` lists only the retirement note and its `docs/README.md` link.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/integrations/pi-dynamic-workflows.md` exits 0.

## Summary

The default Pi package list in `.pi/settings.json` pins `pi-dynamic-workflows` at commit `dbc6800d1f725f7439e51705e2664c59484afcd1`. The package registers a `workflow` tool. That tool duplicates the bounded delegation that `.agro/skills/delegate/SKILL.md` owns. The settings test pins the same entry. Four current documentation files advertise the workflow tool. This task removes the pin and updates the test. It adds a negative identity assertion. It replaces the integration page with a short migration note. Retirement removes the package from harness defaults only. Operators keep the option to load the package through global Pi settings or `pi -e`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Default project-local Pi package list |
| `.pi/extensions/__tests__/settings.test.ts` | "pins the default Pi packages used by the harness" | Exact-list regression guard |
| `docs/harnesses/pi.md` | package bullet, `pi -e` line, "Dynamic workflows" section | Primary Pi harness documentation |
| `docs/installation.md` | line 188 default package sentence | Installation documentation |
| `docs/integrations/pi-fff.md` | package-path precedent sentence | Sibling integration page |
| `docs/integrations/pi-dynamic-workflows.md` | whole page | Becomes the retirement note |
| `docs/README.md` | line 58 link | Documentation index |
| `CHANGELOG.md` | Unreleased section | Release history |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Pi `workflow` tool | Removed from defaults | New project Pi sessions stop registering the workflow tool |
| `.pi/settings.json` `packages` | Entry removed | Nine entries remain |
| Public docs in mifunedev/agro-web | Disposition only | See Open Questions |

## Storage

N/A. The change edits one tracked configuration file and adds no persistent state.

## Architectural Decisions

- `.agro/skills/delegate/SKILL.md` is the single source of truth for bounded delegation in every coding harness.
- The negative assertion checks package identity by substring, so a changed source prefix or pin does not bypass the guard.
- The integration page stays as a retirement note, so inbound links resolve to the migration guidance.
- The harness does not read, edit, or purge global Pi settings, the Pi package cache, sessions, or gateways.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | exact nine-entry `packages` list | Removal and preservation of other entries |
| `.pi/extensions/__tests__/settings.test.ts` | new case: no entry contains `pi-dynamic-workflows` | Identity guard across npm, git, and URL sources |
| `.pi/extensions/__tests__/settings.test.ts` | `skills` stays undefined | Existing setting preserved |

Red step: write the new assertions first, and confirm that both cases fail against the base `.pi/settings.json`. Then remove the entry. Run `npm test` for the full Pi regression suite.

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives.
- Keep one source of truth for delegation.
- Edit only tracked harness files inside the sandbox. Touch no provider mirror and no global state.
- Add no explanatory comments to tracked code.

## Out of Scope

Changes to Pi upstream. Purges of global installations or caches. Migration of user workflow scripts. A replacement workflow engine. Removal of unrelated orchestration tools such as `@tintinweb/pi-subagents`. Edits to historical `CHANGELOG.md` entries.

## Open Questions

1. Does `agro init` or another scaffold path copy `.pi/settings.json` into initialized projects? The implementer runs `git grep -n 'settings.json' -- .agro/cli .agro/scripts` and records the distribution disposition in `progress.txt`.
2. Does mifunedev/agro-web document `pi-dynamic-workflows`? If yes, the advisor opens a matching issue there. If no, the PR body records "no public-docs change" with the search evidence.
3. What is the exact Pi reload command name for the migration note? If no verified command exists, the note says "restart Pi".

## Acceptance Criteria
- [ ] Every US-001 and US-002 criterion passes.
- [ ] `npm test` exits 0.
- [ ] `git diff --name-only` against the base commit lists only the files in Key Integration Points.
- [ ] The PR body records the distribution and public-documentation dispositions with evidence.

## Lessons

Filled by the advisor before undraft.
