# PRD: Retire the pi-langfuse fork surfaces

Status: DRAFT

## User Stories

### US-001: Remove the Pi Langfuse fork installer

**Description:** As an operator, I want the fork installer gone so that the official Pi plugin is the only path.

**Acceptance Criteria:**

- [ ] The installer is absent: `git ls-files .pi/install/install-langfuse.sh` prints nothing.
- [ ] The installer test is absent: `git ls-files .agro/scripts/__tests__/pi-langfuse-install.test.ts` prints nothing.
- [ ] `.pi/install/README.md` has no `install-langfuse.sh` row and no "Interim pi-langfuse source" section.
- [ ] `git grep -n 'install-langfuse'` prints no match outside `CHANGELOG.md` and the task folder.

### US-002: Remove the langfuse configuration section

**Description:** As an operator, I want the dead langfuse config keys removed so that the schema lists only live settings.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` defines no `LangfuseSettings`, `LangfusePrivacyPreset`, or `LANGFUSE_PRIVACY_PRESETS` symbol.
- [ ] `OhConfig` has no `langfuse` property, and the default config at line 135 has no `langfuse` entry.
- [ ] `OH_CONFIG_FIELDS` has no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `runConfigSet("langfuse.baseUrl", ...)` returns 1, and a test asserts the result.
- [ ] A test loads a config file that holds a `langfuse` section, and the load succeeds.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] `docs/configuration.md` has no `langfuse.baseUrl` row and no `langfuse.privacyPreset` row.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.

## Summary

Langfuse publishes official plugins for Claude Code, Pi, and Codex. Issue #1125 rewrote the documentation around the official plugins. Two surfaces from the community pi-langfuse fork remain, and no document references either surface.

The first surface is `.pi/install/install-langfuse.sh`, with its test and its README row. The second surface is the `langfuse` config section. `renderComposeVars` already refuses both keys through `RETIRED_KEYS`, so no process reads the keys. Operators set `LANGFUSE_BASE_URL` in the harness environment.

The approach deletes both surfaces and keeps `RETIRED_KEYS`. Config validation ignores unknown sections, so an existing config file with a `langfuse` section keeps loading.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | whole file | Delete. |
| `.pi/install/README.md` | line 8 row, "Interim pi-langfuse source" section from line 11 | Delete the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, default at line 135, validation at lines 245-249, `OH_CONFIG_FIELDS` lines 350-351 | Remove the schema, the validation, and the two set paths. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` lines 22-23 | Keep unchanged. |
| `docs/configuration.md` | "Langfuse" subsection, lines 146-157 | Remove the two rows. Remove the subsection when no content remains. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | The command exits 1 as an unknown field. |
| `agro config set langfuse.privacyPreset` | Removed | The command exits 1 as an unknown field. |
| Pi install helper | Removed | Operators install `@langfuse/pi-observability-plugin` per `docs/integrations/langfuse.md`. |

## Storage

The config file loses the `langfuse` section from its schema. No migration is necessary, because validation ignores unknown sections. The compose env file keeps its refusal of the two retired keys through `RETIRED_KEYS`.

## Architectural Decisions

- `docs/integrations/langfuse.md` stays the single source for Langfuse setup.
- `RETIRED_KEYS` stays the guard that fails loudly on a stale compose variable.
- The deletion adds no compatibility shim for the removed set paths.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/config-secret.test.ts` | Replace the langfuse set cases at lines 255-270 with one case: `runConfigSet("langfuse.baseUrl", ...)` returns 1. | US-002 set paths are gone. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | Replace the `langfuse.baseUrl` type case at lines 163-165 with a case that loads a config with a `langfuse` section. | US-002 unknown section loads. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Drop `config.langfuse` from `fullConfig` at line 72. Keep the retired-key cases at lines 30-31. | `RETIRED_KEYS` still refuses both keys. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Drop the `langfuse` entries at lines 355 and 371 from the round-trip case. | Sandbox install round trip compiles and passes. |

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth for each policy.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to `docs/integrations/langfuse.md`.
- Changes to the `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` secret handling in `.agro/cli/src/lib/secrets.ts`.
- Changes to the public documentation site in the agro-web repository.

## Open Questions

1. `npm test` runs `vitest run` at the repository root. Confirm that this run includes the `.agro/cli` tests, or name the `<cli test command>` that runs them.
2. The prose at `docs/configuration.md` line 149 names the Langfuse key pair. Confirm that the implementer deletes the whole "Langfuse" subsection, or keeps the prose in another subsection.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `git grep -n -i 'privacyPreset'` prints no match outside `CHANGELOG.md` and the task folder.
- [ ] `CHANGELOG.md` has one entry for the removal.

## Lessons

Filled by the advisor before undraft.
