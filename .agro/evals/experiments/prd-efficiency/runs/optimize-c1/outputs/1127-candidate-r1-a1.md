# PRD: Retire community Langfuse surfaces

Status: DRAFT

## User Stories

### US-001: Remove the pi-langfuse fork installer

**Description:** As an operator, I want the superseded community `pi-langfuse` installer removed so that the tree offers only the official `@langfuse/pi-observability-plugin` path.

**Acceptance Criteria:**

- [ ] `git ls-files .pi/install/install-langfuse.sh` prints nothing.
- [ ] `git ls-files .agro/scripts/__tests__/pi-langfuse-install.test.ts` prints nothing.
- [ ] `.pi/install/README.md` holds no `install-langfuse.sh` row and no "Interim pi-langfuse source" section.
- [ ] The `slack-manifest.json` row in `.pi/install/README.md` stays unchanged.
- [ ] `git grep -n 'install-langfuse\|pi-langfuse-install'` prints nothing outside `CHANGELOG.md`.
- [ ] `npm test` exits 0.

### US-002: Remove the langfuse configuration section

**Description:** As an operator, I want the dead `langfuse` configuration section removed so that `agro config set` offers no field that reaches no process.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` holds no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, or `langfuse` member of `OhConfig`.
- [ ] `defaultOhConfig` returns no `langfuse` key.
- [ ] `validateOhConfig` holds no `langfuse` section check.
- [ ] `OH_CONFIG_FIELDS` holds no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `runConfigSet("langfuse.baseUrl", ...)` returns 1 and writes no config file. A red test proves this before the removal.
- [ ] `validateOhConfig` accepts `{ version: 1, langfuse: { baseUrl: "x", privacyPreset: "full-debug" } }` without an error.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still holds `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] The tracked `agro.json` holds no `langfuse` key.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.

### US-003: Remove the langfuse configuration documentation

**Description:** As an operator, I want the configuration reference to match the schema so that the documentation names no removed field.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` holds no `### Langfuse` section, no `langfuse.baseUrl` row, and no `langfuse.privacyPreset` row.
- [ ] The `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` names in the `## Secrets` list of `docs/configuration.md` stay unchanged.
- [ ] `CHANGELOG.md` holds a `### Removed` entry under `## [Unreleased]` that names the installer and the `langfuse` configuration section.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .pi/install/README.md` reports no finding on a changed line.

## Summary

Langfuse publishes official plugins for Claude Code, Pi, and Codex. Issue #1127 records that #1125 rewrote `docs/integrations/langfuse.md` around those plugins. Two surfaces from the community `pi-langfuse` fork remain.

Verified current state:

- `.pi/install/install-langfuse.sh` pins `ryaneggz/pi-langfuse` at commit `51a59c854859bbb08a43baad98f0b9eb4a94588c`. `.agro/scripts/__tests__/pi-langfuse-install.test.ts` tests the script. `.pi/install/README.md` documents the script in a table row and in an "Interim pi-langfuse source" section. No other tracked file names the script.
- `.agro/cli/src/lib/oh-config.ts` declares the `langfuse` section in five places: the types and the `LANGFUSE_PRIVACY_PRESETS` constant at lines 68-84, the `OhConfig` member at line 104, the `defaultOhConfig` value at line 135, the `validateOhConfig` check at lines 245-249, and the two `OH_CONFIG_FIELDS` entries at lines 350-351.
- `renderComposeVars` in `.agro/cli/src/lib/config-render.ts` renders no Langfuse variable. `RETIRED_KEYS` lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- `OhConfig` carries an index signature `[key: string]: unknown`. `validateOhConfig` checks only known sections. An `agro.json` that holds a `langfuse` section therefore keeps loading after the removal.
- The tracked `agro.json` holds `"langfuse": {}` at line 23.
- `docs/configuration.md` holds the `### Langfuse` section at lines 146-157.

Selected approach: delete the installer, the installer test, and the schema paths. Keep `RETIRED_KEYS`. Convert the tests that assert the `langfuse` fields into tests that assert the removal and the tolerance of a stale section.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | `describe("pi-langfuse installer")` | Delete. |
| `.pi/install/README.md` | `install-langfuse.sh` row, "Interim pi-langfuse source" section | Remove the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig`, `validateOhConfig`, `OH_CONFIG_FIELDS` | Remove each `langfuse` declaration. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep both Langfuse entries unchanged. |
| `agro.json` | `langfuse` key | Remove the key. |
| `docs/configuration.md` | `### Langfuse` section | Remove the section. |
| `CHANGELOG.md` | `## [Unreleased]` | Add a `### Removed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl <value>` | Removed | The command rejects the path as an unknown field. |
| `agro config set langfuse.privacyPreset <value>` | Removed | The command rejects the path as an unknown field. |
| `agro.json` schema | Removed section | `validateOhConfig` ignores a `langfuse` section. A write keeps the section unchanged. |
| `.pi/install/install-langfuse.sh` | Removed script | The official plugin install in `docs/integrations/langfuse.md` replaces the script. |

## Storage

The sandbox configuration file `agro.json` loses the `langfuse` section from its schema and from `defaultOhConfig`. No migration runs. An existing `langfuse` section stays in the file as an unknown key.

## Architectural Decisions

- `docs/integrations/langfuse.md` stays the one source of truth for Langfuse setup. Operators set `LANGFUSE_BASE_URL` in the harness environment.
- `RETIRED_KEYS` keeps both Langfuse variables, so a stale compose variable still fails with `refusing to render retired variable`.
- The schema keeps no tolerance code for the removed section. The `OhConfig` index signature already accepts unknown sections.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/config-secret.test.ts` | Replace "sets the langfuse fields the old dotenv had no home for" and "refuses a privacy preset outside the documented set" with one removal case. In that case, `runConfigSet("langfuse.baseUrl", ...)` returns 1. `runConfigSet("langfuse.privacyPreset", ...)` returns 1. No config file exists after either call. | US-002: the two `agro config set` paths are gone. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | Remove the `langfuse.baseUrl` row from the invalid-field table. Add a case: `validateOhConfig` accepts a legacy `langfuse` section. Add a case: `defaultOhConfig("x")` has no `langfuse` key. | US-002: the schema is gone and a stale section still loads. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Remove `config.langfuse` from `fullConfig`. Keep `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` in the retired-key list. | US-002: `RETIRED_KEYS` still refuses both variables. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Keep the `langfuse` value in the recycle round-trip at lines 355 and 371. | US-002: a recycle preserves a legacy `langfuse` section. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | Delete the file. | US-001: the installer test leaves with the installer. |

Run `npm run typecheck` and `npm test` from the repository root inside the sandbox.

## Design Principles

- Delete obsolete paths. Leave no dormant alternative.
- Keep one source of truth for Langfuse setup.
- Keep the loud failure for a stale compose variable.
- Add no comment to tracked code.

## Out of Scope

- A change to `docs/integrations/langfuse.md` or to the harness documents under `docs/harnesses/`.
- A change to `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in `.agro/cli/src/lib/secrets.ts`.
- A migration that deletes a `langfuse` section from an existing `agro.json`.
- A change to `mifunedev/agro-web`, unless the operator answers question 2 with yes.

## Open Questions

1. The `.example.env` comment at lines 85-94 names `pi-langfuse` and `LANGFUSE_PRIVACY_PRESET`. Should this task rewrite that comment to name the official plugins?
   A. Yes, rewrite the comment in US-003.
   B. No, file a separate issue.
2. Does `mifunedev/agro-web` document `langfuse.baseUrl`, `langfuse.privacyPreset`, or `install-langfuse.sh`? The operator must check <agro-web path> before the pull request merges.

## Acceptance Criteria

- [ ] `git grep -n 'langfuse\.baseUrl\|langfuse\.privacyPreset\|LANGFUSE_PRIVACY_PRESETS'` prints no line in `.agro/cli/src/lib/` or `docs/`, except test lines that assert the removal.
- [ ] `git ls-files .pi/install/install-langfuse.sh .agro/scripts/__tests__/pi-langfuse-install.test.ts` prints nothing.
- [ ] `RETIRED_KEYS` holds `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.

## Lessons

Filled by the advisor before undraft.
