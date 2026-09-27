# PRD: Retire the pi-langfuse fork surfaces

Status: DRAFT

## User Stories

### US-001: Remove the pi-langfuse fork installer

**Description:** As an operator, I want the obsolete fork installer removed so that the only documented Pi tracing path is `@langfuse/pi-observability-plugin`.

**Acceptance Criteria:**

- [ ] The file `.pi/install/install-langfuse.sh` does not exist.
- [ ] The file `.agro/scripts/__tests__/pi-langfuse-install.test.ts` does not exist.
- [ ] `.pi/install/README.md` contains no `install-langfuse.sh` row and no "Interim pi-langfuse source" section.
- [ ] `git grep -n 'install-langfuse' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no match.

### US-002: Remove the langfuse section from the agro.json schema

**Description:** As an operator, I want the dead `langfuse` configuration removed so that `agro config set` offers no setting that reaches no process.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` contains no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, or `langfuse` member of `OhConfig`.
- [ ] `defaultOhConfig` returns an object with no `langfuse` key.
- [ ] `validateOhConfig` performs no check on the `langfuse` section.
- [ ] `OH_CONFIG_FIELDS` contains no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] A red test proves that `runConfigSet("langfuse.baseUrl", ...)` exits 1 as an unknown field. The test fails before the change and passes after the change.
- [ ] A test proves that `readOhConfig` loads an `agro.json` that carries `langfuse: { baseUrl: 1 }` without an error.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] `docs/configuration.md` contains no `langfuse.baseUrl` row, no `langfuse.privacyPreset` row, and no `### Langfuse` section.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm --dir .agro/cli typecheck` exits 0.

## Summary

Issue #1127 removes two surfaces that the community `pi-langfuse` fork left behind. Issue #1125 moved the documentation to the official Langfuse plugins for Claude Code, Pi, and Codex.

Verified current state:

- `.pi/install/install-langfuse.sh` pins the `ryaneggz/pi-langfuse` fork commit. `.agro/scripts/__tests__/pi-langfuse-install.test.ts` tests the helper. `.pi/install/README.md:8` lists the helper, and lines 11 to 22 hold the interim-source note.
- `.agro/cli/src/lib/oh-config.ts:68-84` defines the preset type, the preset list, and `LangfuseSettings`. Line 104 adds `langfuse` to `OhConfig`. Line 135 sets `langfuse: {}` in `defaultOhConfig`. Lines 245-249 validate the section. Lines 350-351 register the two settable fields.
- `OhConfig` has the index signature `[key: string]: unknown`. `validateOhConfig` checks only named sections. An existing `agro.json` with a `langfuse` section therefore keeps loading after the change.
- `.agro/cli/src/lib/config-render.ts:22-23` lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` in `RETIRED_KEYS`. These entries stay.
- `docs/configuration.md:146-157` documents the section and the two fields.

Selected approach: delete the helper, the helper test, the schema, and the documentation rows. Update the tests that reference the removed schema.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | `describe("pi-langfuse installer")` | Delete. |
| `.pi/install/README.md` | table row, "Interim pi-langfuse source" section | Remove the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig`, `validateOhConfig`, `OH_CONFIG_FIELDS` | Remove the schema. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep unchanged. |
| `docs/configuration.md` | `### Langfuse` section | Remove the section. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | The command exits 1 as an unknown field. |
| `agro config set langfuse.privacyPreset` | Removed | The command exits 1 as an unknown field. |
| `agro.json` `langfuse` section | Ignored | Validation ignores the section. Loading continues. |
| `.pi/install/install-langfuse.sh` | Removed | No replacement script. The operator installs `@langfuse/pi-observability-plugin`. |

## Storage

`agro.json` keeps its format. New configurations omit the `langfuse` key. Existing configurations keep the key as an unvalidated unknown section. No migration runs.

## Architectural Decisions

- `LANGFUSE_BASE_URL` in the harness environment is the only source of the Langfuse host.
- `RETIRED_KEYS` keeps both Langfuse names. A stale compose variable still fails loudly.
- The change does not strip a `langfuse` section from an existing `agro.json`. A rewrite by `agro config set` or `agro sandbox install` keeps unknown keys through the `OhConfig` index signature.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/config-secret.test.ts` | Replace the two langfuse cases with one case: `runConfigSet("langfuse.baseUrl", ...)` exits 1. | The settable paths are gone. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | Remove the `langfuse.baseUrl` invalid-type row. Add a case: `langfuse: { baseUrl: 1 }` loads without an error. | Unknown sections keep loading. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Remove `config.langfuse` from `fullConfig`. Keep the retired-key cases for `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. | Retired keys still fail. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Keep the `langfuse` round-trip input at lines 355 and 371. | `agro sandbox install` preserves an unknown section. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | Delete. | The helper is gone. |

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives.
- Keep one source of truth: the harness environment owns the Langfuse host.
- Add no explanatory comments to tracked code.

## Out of Scope

- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in `.agro/cli/src/lib/secrets.ts`.
- `docs/integrations/langfuse.md` and the official plugin documentation from #1125.
- A migration that strips `langfuse` from existing `agro.json` files.
- Public documentation in `mifunedev/agro-web`. The configuration reference change needs a check there.

## Open Questions

1. Does `mifunedev/agro-web` document `langfuse.baseUrl` or `langfuse.privacyPreset`? If yes, the operator opens a matching change in that repository.
2. Does the operator want a `CHANGELOG.md` entry for the removed `agro config set` paths? The `/git` changelog procedure decides the default.

## Acceptance Criteria

- [ ] `git grep -n -e 'install-langfuse' -e 'privacyPreset' -e 'LangfuseSettings' -- .agro/cli/src/lib docs .pi .agro/scripts` prints no match.
- [ ] `RETIRED_KEYS` still lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm --dir .agro/cli typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
