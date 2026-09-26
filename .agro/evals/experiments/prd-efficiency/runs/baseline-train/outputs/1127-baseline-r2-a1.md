# PRD: Retire pi-langfuse remnants

Status: DRAFT

## User Stories

### US-001: Remove the pi-langfuse installer

**Description:** As an operator, I want the superseded community `pi-langfuse` installer removed so that the official `@langfuse/pi-observability-plugin` is the only Pi tracing path in the tree.

**Acceptance Criteria:**

- [ ] `.pi/install/install-langfuse.sh` does not exist.
- [ ] `.agro/scripts/__tests__/pi-langfuse-install.test.ts` does not exist.
- [ ] `.pi/install/README.md` has no `install-langfuse.sh` row and no "Interim pi-langfuse source" section.
- [ ] `git grep -n "install-langfuse"` prints no line outside `CHANGELOG.md` and `.agro/tasks/archive/`.

### US-002: Remove the `langfuse` configuration section

**Description:** As an operator, I want the dead `langfuse` section removed from the `agro.json` schema so that `agro config set` offers no setting that reaches no process.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/oh-config.ts` defines no `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, or `LangfuseSettings` symbol.
- [ ] `OhConfig` has no `langfuse` property, and `defaultOhConfig` returns no `langfuse` key.
- [ ] `validateOhConfig` has no `langfuse` branch.
- [ ] `OH_CONFIG_FIELDS` has no `langfuse.baseUrl` entry and no `langfuse.privacyPreset` entry.
- [ ] `agro config set langfuse.baseUrl <value>` exits 1 and writes no file.
- [ ] `validateOhConfig({ version: 1, langfuse: { baseUrl: 1, privacyPreset: "everything" } })` returns without an error and returns a `langfuse` value deep-equal to the input.
- [ ] `RETIRED_KEYS` in `.agro/cli/src/lib/config-render.ts` still holds `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`.
- [ ] The tracked root `agro.json` has no `langfuse` key.
- [ ] `docs/configuration.md` has no `### Langfuse` section and no `langfuse.baseUrl` or `langfuse.privacyPreset` row.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `npx vitest run .agro/cli` exits 0.

## Summary

Issue #1127 follows #1125. #1125 rewrote the Langfuse guide around the official
Claude Code, Pi, and Codex plugins. Two surfaces from the community `pi-langfuse`
fork remain.

Verified current state:

- `.pi/install/install-langfuse.sh` installs a pinned fork commit of `ryaneggz/pi-langfuse`.
  `.agro/scripts/__tests__/pi-langfuse-install.test.ts` tests the installer.
  `.pi/install/README.md` lists the installer and holds an "Interim pi-langfuse source" section.
  No other tracked file outside `CHANGELOG.md` and `.agro/tasks/archive/` names the installer.
- `.agro/cli/src/lib/oh-config.ts` defines `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, and `LangfuseSettings`.
  The file adds `langfuse` to `OhConfig`, to `defaultOhConfig`, to `validateOhConfig`, and to `OH_CONFIG_FIELDS`.
- `.agro/cli/src/lib/config-render.ts` reads no `langfuse` field.
  `RETIRED_KEYS` lists `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`, and `renderComposeVars` refuses to render either key.
- `validateOhConfig` returns `{ ...record, version: 1 }`.
  The function checks only known sections, so an unknown `langfuse` section passes through unchanged.
- The tracked root `agro.json` carries `"langfuse": {}`.
- `docs/configuration.md` holds a `### Langfuse` section with the two field rows.
- `agro config langfuse` routes to the integration wizard path. `INTEGRATIONS` in `.agro/cli/src/cli.ts` is empty, so this path is not a Langfuse surface.
  The `parseConfigArgs(["langfuse"])` case in `config-secret.test.ts` tests routing of an arbitrary integration name.

Selected approach: delete the installer and the configuration schema.
Keep the `RETIRED_KEYS` entries. Keep the secret keys `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`, because the official plugins read the key pair.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/install-langfuse.sh` | whole file | Delete. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | whole file | Delete. |
| `.pi/install/README.md` | table row, "Interim pi-langfuse source" section | Delete the row and the section. |
| `.agro/cli/src/lib/oh-config.ts` | `LangfusePrivacyPreset`, `LANGFUSE_PRIVACY_PRESETS`, `LangfuseSettings`, `OhConfig.langfuse`, `defaultOhConfig`, `validateOhConfig`, `OH_CONFIG_FIELDS` | Delete the `langfuse` schema. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Keep unchanged. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | `fullConfig` | Delete the `config.langfuse` assignment. Keep the retired-key assertions. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `langfuse.baseUrl` type-error case | Replace with a pass-through case for an unknown `langfuse` section. |
| `.agro/cli/src/__tests__/config-secret.test.ts` | "sets the langfuse fields…", "refuses a privacy preset…" | Replace with one case: `runConfigSet("langfuse.baseUrl", …)` exits 1 and writes no file. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | recycle round-trip case | Keep the `langfuse` value as evidence that the install preserves an unknown section. |
| `agro.json` | `langfuse` key | Delete. |
| `docs/configuration.md` | `### Langfuse` section | Delete the section. |
| `CHANGELOG.md` | `[Unreleased]` → `### Removed` | Add one entry for #1127. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro config set langfuse.baseUrl` | Removed | The command exits 1 with the unknown-field error. |
| `agro config set langfuse.privacyPreset` | Removed | The command exits 1 with the unknown-field error. |
| `agro config show` | Changed | A new default config shows no `langfuse` section. |
| `agro.json` schema | Removed field | `langfuse` becomes an unknown section. Validation ignores the section, and writes keep the section. |
| `.pi/install/install-langfuse.sh` | Removed | No replacement script. `docs/harnesses/pi.md` already documents `@langfuse/pi-observability-plugin`. |

## Storage

`agro.json` is the storage. The change deletes one schema section. No migration
is necessary. An existing `agro.json` with a `langfuse` section loads, and each
write keeps the section unchanged.

## Architectural Decisions

- `oh-config.ts` stays the single source of truth for the configuration schema. `OH_CONFIG_FIELDS` alone controls which paths `agro config set` accepts.
- `RETIRED_KEYS` stays the guard against stale compose variables. A stale `LANGFUSE_BASE_URL` or `LANGFUSE_PRIVACY_PRESET` still fails loudly.
- Operators set `LANGFUSE_BASE_URL` in the harness environment. No `agro` setting replaces the section.
- The change adds no migration that strips the `langfuse` section from existing files. Pass-through is the existing behavior.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/config-secret.test.ts` | `runConfigSet("langfuse.baseUrl", "http://x", …)` exits 1, and `agro.json` does not exist after the call | US-002: the set path is gone. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `validateOhConfig` accepts `{ langfuse: { baseUrl: 1, privacyPreset: "everything" } }` and returns the section unchanged | US-002: unknown-section pass-through. |
| `.agro/cli/src/lib/__tests__/oh-config.test.ts` | `defaultOhConfig("x")` has no `langfuse` key | US-002: the default is gone. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing retired-key cases for `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` | US-002: `RETIRED_KEYS` stays intact. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing recycle round-trip case | US-002: an install keeps an unknown `langfuse` section. |
| `.agro/scripts/__tests__/pi-langfuse-install.test.ts` | deleted | US-001. |

Write the three new cases first and observe them fail. Then delete the schema.

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives.
- Keep one source of truth for each policy: `OH_CONFIG_FIELDS` for settable paths, `RETIRED_KEYS` for dead compose variables.
- Add no explanatory comments to tracked code.
- Break no existing `agro.json`.

Surface review:

- **Host and sandbox:** applied. All edits are repository files. The implementation runs in the sandbox.
- **Lifecycle door:** applied. `agro config set` loses two paths. No other verb changes.
- **Canonical and provider surfaces:** not applicable. The change touches no skill, hook, or provider mirror.
- **Root and scaffold:** applied. `defaultOhConfig` shapes new projects. The root `agro.json` changes.
- **Interactive and headless processes:** not applicable. The change starts no process.
- **Local and remote operation:** not applicable. No runtime behavior depends on the session.
- **Parallel operation:** not applicable. The two stories touch disjoint files and fit one worker.
- **Public documentation:** applied. `docs/configuration.md` changes. `mifunedev/agro-web` needs a matching check for `langfuse.baseUrl` and `langfuse.privacyPreset`. See open question 2.
- **Verification:** applied. See the test plan.

## Out of Scope

- The `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` secret allow-list entries.
- `docs/integrations/langfuse.md` and the harness guides. #1125 owns that content.
- The `RETIRED_KEYS` entries.
- A migration that strips `langfuse` from existing `agro.json` files.
- The generic `agro config <integration>` routing and its test.
- Archived task artifacts under `.agro/tasks/archive/`.

## Open Questions

1. `.example.env` lines 85–94 name `pi-langfuse` and describe `LANGFUSE_PRIVACY_PRESET` as a shell export. No official plugin reads a privacy preset. Does this task rewrite that comment block?
   - A. Yes. Rewrite the block to name `@langfuse/pi-observability-plugin` and drop `LANGFUSE_PRIVACY_PRESET`. (Recommended.)
   - B. No. Open a follow-up issue.
2. Does `mifunedev/agro-web` document `langfuse.baseUrl`, `langfuse.privacyPreset`, or `install-langfuse.sh`? If `mifunedev/agro-web` documents a removed surface, the operator opens a matching change in `mifunedev/agro-web`. `<agro-web search result>`

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes.
- [ ] `npx vitest run` exits 0 from the repository root.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `git grep -n -e "LANGFUSE_PRIVACY_PRESETS" -e "LangfuseSettings" -e "install-langfuse"` prints no line outside `CHANGELOG.md` and `.agro/tasks/archive/`.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Removed` holds one entry that links #1127.

## Lessons

Filled by the advisor before undraft.
