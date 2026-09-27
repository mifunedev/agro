# PRD: Retire the Langfuse fork surfaces

Status: DRAFT

## User Stories

### US-001: Remove the Pi Langfuse fork installer

**Description:** As an operator, I want the tree to drop the community `pi-langfuse` fork installer so that the official plugin `@langfuse/pi-observability-plugin` is the only Pi tracing path.

**Acceptance Criteria:**

- [ ] `.pi/install/install-langfuse.sh` does not exist.
- [ ] `.agro/scripts/__tests__/pi-langfuse-install.test.ts` does not exist.
- [ ] `.pi/install/README.md` has no `install-langfuse.sh` row and no `## Interim pi-langfuse source` section.
- [ ] `git grep -n 'install-langfuse' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no line.
- [ ] `npx vitest run .agro/scripts/__tests__` exits 0.

### US-002: Remove the `langfuse` section of `agro.json`

**Description:** As an operator, I want `agro config` to drop `langfuse.baseUrl` and `langfuse.privacyPreset` so that the configuration lists only settings that reach a process.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` has no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, or `LangfuseSettings` symbol.
- [ ] `OhConfig` has no `langfuse` field, and `defaultOhConfig` returns no `langfuse` key.
- [ ] The validator in `oh-config.ts` has no `expectSection(record, "langfuse")` block.
- [ ] `OH_CONFIG_FIELDS` has no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `agro config set langfuse.baseUrl <url>` exits 1, and the error names an unknown field.
- [ ] A new test in `.agro/cli/src/lib/__tests__/oh-config.test.ts` reads a config that holds `{ "langfuse": { "baseUrl": 1, "privacyPreset": "everything" } }`, and the read does not throw.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still holds `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] The root `agro.json` has no `langfuse` key.
- [ ] `docs/configuration.md` has no `### Langfuse` section and no `langfuse.baseUrl` or `langfuse.privacyPreset` row.
- [ ] `npm run typecheck` exits 0.
- [ ] `npx vitest run .agro/cli` exits 0.

## Summary

Issue #1127 is the input. PR #1125 moved the Langfuse documentation to the official plugins for Claude Code, Pi, and Codex. Two surfaces from the community `pi-langfuse` fork remain.

Verified current state:

- `.pi/install/install-langfuse.sh` pins `ryaneggz/pi-langfuse` at commit `51a59c854859bbb08a43baad98f0b9eb4a94588c`. The script applies an OpenTelemetry override and runs `npm audit`.
- `.agro/scripts/__tests__/pi-langfuse-install.test.ts` tests that script.
- `.pi/install/README.md:8` lists the script. `.pi/install/README.md:11-21` describe the interim fork pin.
- `.agro/cli/src/lib/oh-config.ts:68-84` define the Langfuse types and the preset list. Line 104 adds `langfuse` to `OhConfig`. Line 135 sets `langfuse: {}` in `defaultOhConfig`. Lines 245-249 validate the section. Lines 350-351 register the two `agro config set` paths.
- `OhConfig` carries `[key: string]: unknown`. The validator checks only the named sections. An unknown `langfuse` section therefore loads without error after the removal.
- `.agro/cli/src/lib/config-render.ts:22-23` hold `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` in `RETIRED_KEYS`. These entries stay.
- `docs/configuration.md:146-157` document the section. `agro.json:23` holds `"langfuse": {}`.

The selected approach deletes each surface and updates each test that names the retired fields. The approach adds no replacement setting. Operators set `LANGFUSE_BASE_URL` in the harness environment.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | `describe("pi-langfuse installer")` | Delete. |
| `.pi/install/README.md` | table row, `## Interim pi-langfuse source` | Remove the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig`, validator block, `OH_CONFIG_FIELDS` | Remove the schema, the default, the validation, and the two set paths. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep both `LANGFUSE_*` entries. No change. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | `fullConfig` line 72 | Remove the `config.langfuse` assignment. Keep the retired-key list at lines 30-31. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `langfuse.baseUrl` row, lines 162-166 | Replace the row with an unknown-section load test. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | the `pi-langfuse installer` suite | Delete the test file. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | round-trip fixture, lines 355 and 371 | Remove the `langfuse` entries, or keep them as proof that the install preserves an unknown section. |
| `agro.json` | `"langfuse": {}` | Remove the key. |
| `docs/configuration.md` | `### Langfuse`, lines 146-157 | Remove the section. |
| `CHANGELOG.md` | `## [Unreleased]` | Add a `### Removed` entry that cites #1127. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | The command exits 1 with the unknown-field error. |
| `agro config set langfuse.privacyPreset` | Removed | The command exits 1 with the unknown-field error. |
| `agro.json` `langfuse` section | Removed from schema | An existing section loads and has no effect. |
| `.pi/install/install-langfuse.sh` | Removed | Operators install `@langfuse/pi-observability-plugin` per `docs/harnesses/pi.md`. |

## Storage

`agro.json` is the only persistent store. The task removes the `langfuse` key from the tracked root `agro.json`. The task writes no migration. The validator ignores an unknown section, so existing sandbox configs keep loading.

## Architectural Decisions

- `docs/integrations/langfuse.md` stays the single source for Langfuse setup.
- `RETIRED_KEYS` stays the guard against a stale compose variable. `renderComposeEnv` refuses both `LANGFUSE_*` keys.
- The validator does not reject an unknown `langfuse` section. A rejection breaks existing configs.
- `.example.env` keeps `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. `secrets.ts` still allows both keys.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | Read a config with a `langfuse` section that holds invalid values. | The read does not throw. Write the new test red first against the current validator. |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `runConfigSet("langfuse.baseUrl", ...)` returns 1. | The set path is gone. Write the new test red first. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Existing retired-key cases. | `RETIRED_KEYS` still refuses both `LANGFUSE_*` keys. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Existing install round trip. | The install still preserves the config fields. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | Deleted. | The installer is gone. |

Run `npx vitest run .agro/cli .agro/scripts/__tests__` and `npm run typecheck` from the repository root.

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth for Langfuse setup.
- Keep old configs loading. Keep stale compose variables failing loudly.
- Add no explanatory comments to tracked code.

## Out of Scope

- `docs/integrations/langfuse.md` and the harness docs. PR #1125 owns them.
- The `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` secrets.
- The `langfuse` integration-help argument that `parseConfigArgs` accepts in `config-secret.test.ts:59-61`.
- `.agro/tasks/archive/` and `.agro/knowledge/` history.

## Open Questions

1. `.example.env:86` names `pi-langfuse`. `.example.env:92-94` name `LANGFUSE_PRIVACY_PRESET` as a shell export. The issue does not name `.example.env`. Does the task update the `.example.env` comment block to name the official plugin?
2. Does `mifunedev/agro-web` mirror the `docs/configuration.md` Langfuse rows? If yes, the web docs need a matching change.
3. Does the `sandbox.test.ts` round trip drop the `langfuse` entries, or keep them as an unknown-section preservation check?

## Acceptance Criteria

- [ ] `git grep -n -e 'langfuse\.baseUrl' -e 'langfuse\.privacyPreset' -e 'install-langfuse' -- ':!CHANGELOG.md' ':!.agro/tasks' ':!.agro/knowledge'` prints no line.
- [ ] `git grep -n 'LANGFUSE_BASE_URL' .agro/cli/src/lib/config-render.ts` prints one line.
- [ ] `npx vitest run .agro/cli .agro/scripts/__tests__` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `CHANGELOG.md` `## [Unreleased]` has a `### Removed` entry that cites #1127.

## Lessons

Filled by the advisor before undraft.
