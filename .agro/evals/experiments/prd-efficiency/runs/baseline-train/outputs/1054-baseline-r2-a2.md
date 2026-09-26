# PRD: Retire pi-dynamic-workflows from Pi defaults

Status: DRAFT

## User Stories

### US-001: Remove the dynamic workflow pin from the default Pi packages

**Description:** As an operator, I want the default Pi package list to exclude `pi-dynamic-workflows` so that bounded delegation in the harness has one owner, the `/delegate` skill.

**Acceptance Criteria:**

- [ ] `.pi/settings.json` contains no `packages` entry that names `pi-dynamic-workflows`.
- [ ] `.pi/settings.json` keeps the other nine `packages` entries in their current order.
- [ ] Every key other than `packages` in `.pi/settings.json` keeps its current value.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts the exact nine-entry `packages` list with `toEqual`.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts that no `packages` entry matches `/pi-dynamic-workflows/i`. The match covers `git:`, `npm:`, `https:`, and local-path sources.
- [ ] `npx vitest run .pi/extensions/__tests__/settings.test.ts` exits 0.
- [ ] Before the change to `.pi/settings.json`, the negative assertion fails. The worker records the failing run as evidence.

### US-002: Remove the retired tool from current documentation

**Description:** As an operator, I want current documentation to stop advertising the Pi `workflow` tool registration so that the documentation matches the default Pi configuration.

**Acceptance Criteria:**

- [ ] `docs/integrations/pi-dynamic-workflows.md` does not exist.
- [ ] `docs/README.md` has no link to `integrations/pi-dynamic-workflows.md`.
- [ ] `docs/harnesses/pi.md` has no "Default packages" bullet for `pi-dynamic-workflows`.
- [ ] `docs/harnesses/pi.md` has no `## Dynamic workflows` section.
- [ ] The `pi -e` example list in `docs/harnesses/pi.md` has no `pi-dynamic-workflows` source.
- [ ] `docs/installation.md` "What's Installed" does not list `pi-dynamic-workflows` as a default package.
- [ ] `docs/integrations/pi-fff.md` does not name `pi-dynamic-workflows` as an example of the package path.
- [ ] `docs/harnesses/pi.md` has a migration note. The note names `/delegate` as the replacement.
- [ ] The migration note states that a running Pi session keeps the `workflow` tool until the operator runs `/reload` or restarts Pi.
- [ ] The migration note states that a global Pi installation or a `pi -e` installation stays under operator control, and that the harness does not remove the installation.
- [ ] `grep -rn "pi-dynamic-workflows" docs .pi` prints only lines of the migration note.
- [ ] `CHANGELOG.md` `## [Unreleased]` has a `### Removed` entry that names the retirement, `/delegate`, and issue `#1054`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/pi.md` reports no finding on a line that this task adds or changes.

### US-003: Record the distribution and public-documentation disposition

**Description:** As an operator, I want an evidence-backed disposition for each distribution path and for public documentation so that no surface keeps the retired default.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-pi-dynamic-workflows/` holds an evidence note with one row per surface: repository checkout, sandbox image, published CLI package, `agro migrate`, and `mifunedev/agro-web`.
- [ ] Each row states "changed", "not affected", or "follow-up", and cites the file or command that proves the state.
- [ ] The `mifunedev/agro-web` row cites a search result for `pi-dynamic-workflows` in that repository, or holds the placeholder `<agro-web search result>` and a follow-up issue link.
- [ ] `npm test` exits 0 in the sandbox worktree.
- [ ] `git diff --name-only` against the base branch lists no path under `~/.pi`, `.claude/`, `.codex/`, `.agents/`, `.pi/skills`, `.pi/bridge`, or `.devcontainer/`.

## Summary

Issue #1054 retires `pi-dynamic-workflows` from the harness defaults. The package registers a `workflow` tool. That tool duplicates the bounded delegation that `/delegate` owns in `.agro/skills/delegate/SKILL.md`. Retirement removes the default. Retirement does not ban a global installation or a `pi -e` installation.

Verified current state at base commit `d341ebc`:

- `.pi/settings.json:27` pins `git:github.com/Michaelliv/pi-dynamic-workflows@dbc6800d1f725f7439e51705e2664c59484afcd1` as the last of ten `packages` entries.
- `.pi/extensions/__tests__/settings.test.ts:17` asserts the exact ten-entry list. The test has no negative identity assertion.
- `docs/integrations/pi-dynamic-workflows.md` documents the tool. `docs/README.md:58` links to the page.
- `docs/harnesses/pi.md:45`, `docs/harnesses/pi.md:60`, and `docs/harnesses/pi.md:137-141` advertise the package and the tool.
- `docs/installation.md:188` lists the package as a default.
- `docs/integrations/pi-fff.md:16` names the package as an example of the pinned-package path.
- `CHANGELOG.md:681` records the original addition under #451. That entry is history and stays unchanged.
- No file under `.devcontainer/` reads `.pi/settings.json`. The sandbox image does not bake the package list.
- `.agro/cli/package.json` publishes only `dist` and `NOTICE`. The published CLI does not ship `.pi/settings.json`.
- No probe under `.agro/evals/probes/` and no skill under `.agro/skills/` names the package.

Selected approach: delete the pin, tighten the test, delete the integration page, and add one migration note to `docs/harnesses/pi.md`. Pi reads the project package list at startup. A checkout that pulls the change loses the default at the next Pi start or `/reload`. The harness does not uninstall a cached package.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Default project-local Pi package list. Remove the dynamic workflow pin. |
| `.pi/extensions/__tests__/settings.test.ts` | `pins the default Pi packages used by the harness` | Exact-list and negative-identity regression test. |
| `docs/harnesses/pi.md` | "Default packages", `pi -e` examples, `## Dynamic workflows` | Remove the package. Add the migration note. |
| `docs/integrations/pi-dynamic-workflows.md` | whole file | Delete. |
| `docs/README.md` | "Integrations" list | Remove the link. |
| `docs/installation.md` | "What's Installed" | Remove the package from the default list. |
| `docs/integrations/pi-fff.md` | package-path paragraph | Remove the reference to the retired package. |
| `CHANGELOG.md` | `## [Unreleased]` | Add a `### Removed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Pi `workflow` tool | Removed from defaults | A new Pi session in the harness does not load `workflow` from project settings. |
| `.pi/settings.json` `packages` | Changed | The list shrinks from ten entries to nine entries. |
| `docs/integrations/pi-dynamic-workflows.md` | Removed | The page URL stops resolving in the repository docs. |
| `mifunedev/agro-web` | Open question | Public documentation can mirror the removed page. See Open Questions. |

## Storage

N/A. The task changes a tracked configuration file and documentation. The task adds no persistent state. The task does not touch the Pi package cache, session files, or global Pi settings.

## Architectural Decisions

- `.pi/settings.json` is the source of truth for default project Pi packages.
- `/delegate` is the single owner of bounded delegation. No replacement workflow engine is added.
- The negative test matches the package name `pi-dynamic-workflows` case-insensitively, not the commit hash. A reintroduction from any source fails the test.
- The migration note lives in `docs/harnesses/pi.md`. A standalone page for a retired tool contradicts the rule to delete obsolete paths.
- The harness does not remove operator-managed installations. Global settings and `pi -e` flags stay outside harness control.
- No ADR is required. The change removes one default and adds no abstraction.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | Exact nine-entry `packages` list | US-001 keeps every other entry and the order. |
| `.pi/extensions/__tests__/settings.test.ts` | No entry matches `/pi-dynamic-workflows/i` | US-001 blocks reintroduction from `git:`, `npm:`, `https:`, or local-path sources. |
| `.pi/extensions/__tests__/settings.test.ts` | `settings.skills` is `undefined` | Existing assertion stays green. |
| `npm test` | Full vitest suite | Pi extension tests and other suites stay green. |
| `grep -rn "pi-dynamic-workflows" docs .pi` | Only migration-note lines | US-002 removes every other current reference. |
| `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/pi.md` | Changed lines | US-002 prose follows `/ste`. |

Order: write the negative assertion first. Run the test and record the failure. Then edit `.pi/settings.json` and run the test again.

## Design Principles

- Delete obsolete paths. Do not leave a dormant alternative.
- Keep one source of truth for each behavior.
- Keep the change in the sandbox worktree. Do not touch the host, global Pi state, or provider mirrors.
- Write no explanatory comments in tracked code.
- Keep history intact. Do not edit the #451 `CHANGELOG.md` entry or archived task evidence.

## Out of Scope

- Changes to Pi upstream or to the `pi-dynamic-workflows` upstream repository.
- Removal of global installations, cached packages, or `pi -e` usage.
- Migration of operator workflow scripts.
- A replacement workflow engine.
- Removal of `@tintinweb/pi-subagents`, `@tintinweb/pi-tasks`, or other orchestration packages.
- Edits to `CHANGELOG.md` history entries.

## Open Questions

1. Does `mifunedev/agro-web` publish a page or a link for `pi-dynamic-workflows`? This repository holds no evidence. The implementation owner searches `mifunedev/agro-web` and records the result in the US-003 evidence note. A match needs a follow-up issue in that repository.
2. Does a CI docs build or a link checker fail on the deleted page? `.github/workflows/ci-harness.yml` watches `docs/**`. The implementation owner confirms the result `<CI docs check result>` on the draft PR.

## Acceptance Criteria

- [ ] `.pi/settings.json` has nine `packages` entries and no entry that names `pi-dynamic-workflows`.
- [ ] `.pi/extensions/__tests__/settings.test.ts` holds the exact-list assertion and the case-insensitive negative identity assertion.
- [ ] `npm test` exits 0 in the sandbox worktree.
- [ ] `grep -rn "pi-dynamic-workflows" docs .pi` prints only migration-note lines.
- [ ] The migration note names `/delegate`, the `/reload` or restart boundary, and the global-override boundary.
- [ ] The diff touches no global Pi settings, package cache, session file, gateway file, or provider mirror.
- [ ] The US-003 evidence note gives a disposition for each distribution surface and for `mifunedev/agro-web`.
- [ ] CI on the draft PR for branch `task/1054-retire-pi-dynamic-workflows` reports success.

## Lessons

Filled by the advisor before undraft.
