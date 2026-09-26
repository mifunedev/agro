# PRD: Retire the pi-langfuse surfaces

Status: DRAFT

## User Stories

### US-001: Remove the pi-langfuse installer

**Description:** As an operator, I want the superseded `pi-langfuse` fork installer removed so that the tree offers only the official `@langfuse/pi-observability-plugin` path.

**Acceptance Criteria:**

- [ ] `.pi/install/install-langfuse.sh` does not exist.
- [ ] `.agro/scripts/__tests__/pi-langfuse-install.test.ts` does not exist.
- [ ] `.pi/install/README.md` has no `install-langfuse.sh` table row.
- [ ] `.pi/install/README.md` has no `## Interim pi-langfuse source` section.
- [ ] `git grep -n -e install-langfuse -e pi-langfuse-install -- . ':!CHANGELOG.md'` prints no match.
- [ ] `npm test` exits 0.

### US-002: Remove the `langfuse` section from the configuration schema

**Description:** As an operator, I want the `langfuse` section removed from the `agro.json` schema so that `agro config set` offers no setting that reaches no process.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` has no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, or `LangfuseSettings` symbol.
- [ ] `OhConfig` in `.agro/cli/src/lib/oh-config.ts` has no `langfuse` property.
- [ ] `defaultOhConfig()` returns an object with no `langfuse` key.
- [ ] `validateOhConfig()` has no `langfuse` section check.
- [ ] `OH_CONFIG_FIELDS` has no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `agro config set langfuse.baseUrl <url>` exits 1 and prints `unknown field "langfuse.baseUrl"`.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] The tracked root `agro.json` has no `langfuse` key.
- [ ] `readOhConfig()` loads an `agro.json` that holds `"langfuse": { "baseUrl": "x", "privacyPreset": "everything" }` and throws no error.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.

### US-003: Remove the Langfuse configuration documentation

**Description:** As an operator, I want `docs/configuration.md` to document only live fields so that the reference matches the schema.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` has no `### Langfuse` section.
- [ ] `docs/configuration.md` has no `langfuse.baseUrl` row and no `langfuse.privacyPreset` row.
- [ ] `docs/configuration.md` still lists `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in the `## Secrets` list.
- [ ] `bash .agro/evals/probes/config-schema-parity.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-config-surfaces.sh` exits 0.
- [ ] `CHANGELOG.md` has one `### Removed` entry under `## [Unreleased]` that names both removed surfaces and links issue `#1127`.

## Summary

Issue #1127 retires two surfaces that the community `pi-langfuse` fork left behind. PR #1125 moved the documentation to the official Langfuse plugins for Claude Code, Pi, and Codex.

Verified current state:

- `.pi/install/install-langfuse.sh` pins `ryaneggz/pi-langfuse` at commit `51a59c854859bbb08a43baad98f0b9eb4a94588c`. The script applies an `@opentelemetry/sdk-node` override and runs `npm audit`. No Dockerfile, script, or document calls the script. Only `.pi/install/README.md` and `.agro/scripts/__tests__/pi-langfuse-install.test.ts` name the script.
- `.agro/cli/src/lib/oh-config.ts` defines the `langfuse` schema in 5 places: the `LangfusePrivacyPreset` type, the `LANGFUSE_PRIVACY_PRESETS` constant, the `LangfuseSettings` interface, the `OhConfig.langfuse` property, and the `langfuse: {}` default in `defaultOhConfig()`. `validateOhConfig()` checks the section. `OH_CONFIG_FIELDS` exposes the two `agro config set` paths.
- `renderComposeVars()` in `.agro/cli/src/lib/config-render.ts` renders no Langfuse value. `RETIRED_KEYS` lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- `validateOhConfig()` ignores a section it does not know. The tracked root `agro.json` already carries an unknown `install` section and loads.
- `sandbox install` builds each registry entry from `OH_CONFIG_FIELDS` through `overlaySettings()` in `.agro/cli/src/commands/sandbox.ts`. After the change, a recycle drops a stale `langfuse` section from the entry.

Selected approach: delete the installer and its test. Delete the schema, the field paths, the default, and the tracked `agro.json` key. Update the tests that assert the old fields. Keep `RETIRED_KEYS` unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | `describe("pi-langfuse installer")` | Delete. |
| `.pi/install/README.md` | file table, `## Interim pi-langfuse source` | Remove the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig()`, `validateOhConfig()`, `OH_CONFIG_FIELDS` | Remove the schema and the two field paths. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep both Langfuse entries. No edit. |
| `agro.json` | `langfuse` | Remove the empty section. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `langfuse.baseUrl` validation case | Remove the case. Add an unknown-section load case. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | `fullConfig()` | Remove the `config.langfuse` assignment. Keep the retired-key list. |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `sets the langfuse fields...`, `refuses a privacy preset...` | Replace with one case: `langfuse.baseUrl` is an unknown field. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | registry round-trip case | Remove `langfuse` from the expected object. Assert that the recycled entry has no `langfuse` key. |
| `docs/configuration.md` | `### Langfuse` | Remove the section and its two rows. |
| `CHANGELOG.md` | `## [Unreleased]` | Add one `### Removed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | Exits 1 with `unknown field`. |
| `agro config set langfuse.privacyPreset` | Removed | Exits 1 with `unknown field`. |
| `agro config set` field list | Changed | The list no longer shows the two `langfuse.*` paths. |
| `agro.json` schema | Changed | A `langfuse` section is an unknown section. Validation ignores it. |
| `agro sandbox install` | Changed | A recycle drops a stale `langfuse` section from the registry entry. |
| `.pi/install/install-langfuse.sh` | Removed | Operators install `@langfuse/pi-observability-plugin` per `docs/integrations/langfuse.md`. |

## Storage

The change edits the `agro.json` schema. The change adds no storage. An existing `agro.json` with a `langfuse` section keeps loading. `sandbox install` rewrites the registry entry without that section.

## Architectural Decisions

- `OH_CONFIG_FIELDS` stays the single source for settable fields. The removal happens there, and `agro config set`, the field list, and `overlaySettings()` follow.
- `RETIRED_KEYS` keeps `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. A stale compose variable still fails loudly.
- Validation stays permissive for unknown sections. The change adds no rejection and no migration for a stale `langfuse` section.
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` stay in the secret allow-list in `.agro/cli/src/lib/secrets.ts`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | Load a config with a stale `langfuse` section. | Validation ignores the unknown section. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `ohConfigFieldPaths()` has no path that starts with `langfuse.`. | The two field paths are gone. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `defaultOhConfig("x")` has no `langfuse` key. | The default is gone. |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `runConfigSet("langfuse.baseUrl", ...)` returns 1 and writes nothing. | The `agro config set` path is gone. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Round-trip with a stale `langfuse` section. | A recycle keeps every live field and drops `langfuse`. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Existing retired-key cases. | `RETIRED_KEYS` still holds both Langfuse names. |
| `.agro/evals/probes/config-schema-parity.sh` | Whole probe. | Documentation and schema stay in parity. |

Run `npm test` and `npm run typecheck` from the repository root inside the sandbox.

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth: `OH_CONFIG_FIELDS` owns settable fields.
- Fail loudly on a retired compose variable.
- Keep old `agro.json` files loadable.
- Add no explanatory comment to tracked code.

## Out of Scope

- The `docs/integrations/langfuse.md` guide. PR #1125 owns the guide.
- The Langfuse secrets `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`.
- Historical `CHANGELOG.md` entries that name `pi-langfuse`.
- The unknown `install` section in the tracked root `agro.json`.
- A migration that strips a `langfuse` section from an operator `agro.json`.
- The `mifunedev/agro-web` repository. The removed fields do not appear on a public page that this task can verify.

## Open Questions

1. The Langfuse comment block in `.example.env` names `pi-langfuse` and `LANGFUSE_PRIVACY_PRESET`. Issue #1127 does not name `.example.env`. Should this task rewrite that comment block to point at the official Pi plugin?
   - A. Yes: rewrite the comment block in US-003.
   - B. No: open a separate issue.
   This question does not block the plan. The default is B.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `git grep -n -e langfuse -e Langfuse -- .agro/cli/src/lib/oh-config.ts agro.json` prints no match.
- [ ] `git grep -n -e 'langfuse\.' -- docs/configuration.md` prints no match.
- [ ] `git grep -n LANGFUSE_PRIVACY_PRESET -- .agro/cli/src/lib/config-render.ts` prints one match.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.
- [ ] `bash .agro/evals/probes/config-schema-parity.sh` exits 0.

## Lessons

Filled by the advisor before undraft.
