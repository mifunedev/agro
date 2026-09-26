# PRD: Retire the pi-langfuse fork surfaces

Status: DRAFT

## User Stories

### US-001: Remove the Pi Langfuse installer

**Description:** As an operator, I want the fork installer gone so that Pi uses the official Langfuse plugin.

**Acceptance Criteria:**

- [ ] The file `.pi/install/install-langfuse.sh` is absent.
- [ ] The test file `.agro/scripts/__tests__/pi-langfuse-install.test.ts` is absent.
- [ ] `.pi/install/README.md` has no `install-langfuse.sh` row and no "Interim pi-langfuse source" section.
- [ ] `git grep -n 'install-langfuse'` prints no line outside `CHANGELOG.md`.

### US-002: Remove the langfuse configuration schema

**Description:** As an operator, I want the dead `langfuse` settings removed so that configuration shows only live fields.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` has no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, or `LangfuseSettings` symbol.
- [ ] `OhConfig` has no `langfuse` property, and `defaultOhConfig` returns no `langfuse` key.
- [ ] `readOhConfig` runs no `langfuse` section validation.
- [ ] `OH_CONFIG_FIELDS` has no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `runConfigSet("langfuse.baseUrl", ...)` returns exit status 1, and the config file stays unchanged.
- [ ] A test reads an `agro.json` that holds `langfuse: { baseUrl: 1, privacyPreset: "everything" }`, and `readOhConfig` returns without an error.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] `npx vitest run .agro/cli/src` exits 0.
- [ ] `npm run typecheck` exits 0.

### US-003: Remove the langfuse configuration documentation

**Description:** As an operator, I want the configuration reference to match the schema so that no dead field appears.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` has no `### Langfuse` subsection and no `langfuse.baseUrl` or `langfuse.privacyPreset` row.
- [ ] The secret list in `docs/configuration.md` still names `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` that names the removed installer and the removed `langfuse` settings.

## Summary

Langfuse publishes official plugins for Claude Code, Pi, and Codex. Issue #1125 rewrote the documentation around those plugins. Two surfaces from the community `pi-langfuse` fork remain in the tree.

The first surface is the Pi installer at `.pi/install/install-langfuse.sh`. The installer pins a fork commit, applies an OpenTelemetry override, and runs an npm audit. The test `.agro/scripts/__tests__/pi-langfuse-install.test.ts` covers the installer. `.pi/install/README.md` lists the installer in line 8 and explains the fork pin in lines 11 to 21.

The second surface is the `langfuse` section of the configuration schema in `.agro/cli/src/lib/oh-config.ts`. The type lives in lines 68 to 84 and line 104. The default lives in line 135. Validation lives in lines 245 to 249. The `agro config set` paths live in lines 350 and 351. No process reads these values. `renderComposeVars` in `.agro/cli/src/lib/config-render.ts` lists both compose names in `RETIRED_KEYS` and refuses to render them. Operators set `LANGFUSE_BASE_URL` in the harness environment instead.

The selected approach deletes both surfaces and the matching tests and documentation rows. The approach keeps the `RETIRED_KEYS` entries, so a stale compose variable still fails. The `OhConfig` index signature `[key: string]: unknown` accepts unknown sections, so an existing `agro.json` with a `langfuse` section keeps loading.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Fork installer to delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | `describe("pi-langfuse installer")` | Installer test to delete. |
| `.pi/install/README.md` | installer row, "Interim pi-langfuse source" section | Index rows to delete. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig`, `readOhConfig`, `OH_CONFIG_FIELDS` | Schema, default, validation, and settable paths to delete. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep both `LANGFUSE_*` entries unchanged. |
| `.agro/cli/src/__tests__/config-secret.test.ts` | "sets the langfuse fields the old dotenv had no home for", "refuses a privacy preset outside the documented set" | Replace with a refusal test for the removed path. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `langfuse.baseUrl` row of the validation table | Delete the row. Add the legacy-section load test. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | `fullConfig` line 72 | Delete the `config.langfuse` assignment. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | round-trip fixture lines 355 and 371 | Delete the `langfuse` key from the fixture and from the expectation. |
| `docs/configuration.md` | `### Langfuse` subsection, lines 146 to 157 | Documentation rows to delete. |
| `CHANGELOG.md` | `## [Unreleased]` | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | The command exits with status 1 as an unknown path. |
| `agro config set langfuse.privacyPreset` | Removed | The command exits with status 1 as an unknown path. |
| `agro.json` `langfuse` section | Ignored | The loader accepts the section and validates nothing in the section. |
| `.pi/install/install-langfuse.sh` | Removed | Operators install `@langfuse/pi-observability-plugin` per `docs/integrations/langfuse.md`. |

## Storage

N/A. The task removes a configuration section and stores no new state. Existing `agro.json` files need no migration.

## Architectural Decisions

- `docs/integrations/langfuse.md` stays the source of truth for Langfuse setup.
- `RETIRED_KEYS` stays the guard against stale `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` compose variables.
- The loader treats `langfuse` as an unknown section. The task adds no migration and no warning.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/config-secret.test.ts` | `runConfigSet("langfuse.baseUrl", ...)` returns 1 and writes no config file | US-002 removed settable path |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `readOhConfig` loads a file with an invalid `langfuse` section | US-002 backward compatibility |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing retired-key cases for `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` | US-002 retired keys still fail |
| `.agro/cli/src/__tests__/sandbox.test.ts` | round-trip fixture without `langfuse` | US-002 fixture matches the schema |

Run `npx vitest run .agro/cli/src` and `npm run typecheck` from the repository root inside the sandbox.

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth for Langfuse setup.
- Keep the loud failure for stale compose variables.
- Add no code comments.

## Out of Scope

- The `langfuse` integration help argument that `parseConfigArgs` accepts.
- The `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` secret keys in `.agro/cli/src/lib/secrets.ts`.
- The Langfuse comment block in `.example.env`.
- Public documentation in the mifunedev/agro-web repository.

## Open Questions

1. The `.example.env` comment at line 92 names `LANGFUSE_PRIVACY_PRESET`. Does the operator want that comment updated in this task?
2. Does the mifunedev/agro-web repository document `langfuse.baseUrl`, `langfuse.privacyPreset`, or the Pi installer?

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `git grep -n -i 'privacyPreset\|install-langfuse' -- .agro/cli .agro/scripts .pi docs` prints no line.
- [ ] `npx vitest run` exits 0 from the repository root.
- [ ] `npm run typecheck` exits 0 from the repository root.

## Lessons

Filled by the advisor before undraft.
