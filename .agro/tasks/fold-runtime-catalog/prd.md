# PRD: Fold the runtime catalog into a constant and remove the openshell shim

Status: DRAFT

## User Stories

### US-001: Fold the runtime catalog into one constant

**Description:** As a maintainer, I want one `docker` constant instead of a runtime catalog so that the CLI holds no multi-runtime machinery for a single runtime.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/runtimes/` does not exist.
- [ ] `git grep -n -E 'RUNTIME_CATALOG|PROVISIONABLE_RUNTIMES|ProvisionableRuntimeId|SandboxRuntime\b|SANDBOX_RUNTIMES|findRuntime|runtimeIds|runtimeLines' -- .agro/cli/src` prints nothing.
- [ ] `lib/agro-config.ts` exports the constant `SANDBOX_RUNTIME = "docker"`. `validateAgroConfig` accepts an unset `runtime` and `runtime: "docker"`, and rejects each other value with `agro.json: runtime must be one of docker`.
- [ ] `AGRO_CONFIG_FIELDS` has no `runtime` entry, so `agro config set runtime docker` exits non-zero as an unknown key.
- [ ] `seedConfig` in `commands/sandbox.ts` writes no `runtime` field. A test reads the `agro.json` that `agro sandbox install docker --yes` writes and finds no `runtime` key.
- [ ] `agro sandbox install docker` keeps working: the existing install tests pass with the positional `docker`.
- [ ] `agro sandbox install` with no positional exits 1 with `a runtime is required, e.g. \`agro sandbox install docker\``. `agro sandbox install microsandbox` and `agro sandbox install openshell` exit 1 with `agro sandbox install: unknown runtime "<value>" — the only runtime is docker` and write no entry.
- [ ] `agro sandbox --help` prints no `Runtimes:` section.
- [ ] `agro run -- pnpm run typecheck` exits 0.

### US-002: Generic handling of an invalid registry entry and removal of the openshell shim

**Description:** As an operator with a registry entry from an earlier release, I want each verb to report an invalid `agro.json` and change nothing. Then no verb crashes, deletes the entry, or falls back to docker defaults.

**Acceptance Criteria:**

- [ ] `git grep -n -i -E 'RetiredRuntime|isRetiredRuntime|retiredRuntimeRefusal|assertActiveRuntime|RETIRED_RUNTIMES|retired openshell' -- .agro/cli/src` prints nothing.
- [ ] `agro sandbox list` with one healthy entry and one entry whose `agro.json` holds `runtime: "openshell"` exits 0. stdout lists only the healthy entry. stderr holds exactly one line. That line names the invalid entry and holds `runtime must be one of docker`. The command spawns no status probe for the invalid entry.
- [ ] `agro sandbox list --json` in the same state prints valid JSON with only the healthy entry on stdout and the same one warning line on stderr.
- [ ] `agro sandbox list` and `agro sandbox list --json` print no `runtime` column and no `runtime` key. The JSON key order is `name`, `checkout`, `repo`, `status`.
- [ ] A test covers an entry with malformed JSON in `agro.json`: `agro sandbox list` skips it with one warning line and lists the healthy entries.
- [ ] The targeted verbs are `shell`, `stop`, `restart`, `logs`, `ps`, `compose config`, `destroy`, `destroy --yes`, `egress log`, `egress reload`, and `sandbox upgrade`. A test runs each one through `runCli` against an entry with `runtime: "openshell"`. The exit status is 1. stderr holds the validation error `runtime must be one of docker` and one remedy line that names the path of that `agro.json`. The runner records zero calls. The entry directory still holds only the unchanged `agro.json`.
- [ ] A lifecycle verb that resolves its sandbox from the current directory skips an invalid entry during the `checkout` scan. It still resolves the healthy entry whose `checkout` holds the current directory.
- [ ] `materialize` in `lib/registry.ts` has no runtime check, and no lifecycle verb writes a file into an invalid entry.
- [ ] `agro run -- pnpm test` passes, apart from the baseline failures in `evidence/baseline.md`.

### US-003: Documentation, changelog, and the sandbox routing replay

**Description:** As a reader of the docs, I want the documentation to describe one runtime and the invalid-entry behavior. Then the docs match the CLI.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` describes `runtime` as a legacy field whose only accepted value is `docker`. It states that `agro sandbox list` skips an entry with an invalid `agro.json`, and that each other verb exits 1. The row does not mention `openshell (retired)`.
- [ ] `docs/lifecycle-commands.md`, `docs/quickstart.md`, and `docs/runtimes/overview.md` list `agro sandbox list` output as name, status, and checkout. `docs/runtimes/overview.md` quotes the new unknown-runtime refusal and no longer tells the reader that `agro sandbox --help` prints a runtime catalog.
- [ ] `docs/lifecycle-commands.md` does not show the screenshot `img/lifecycle-commands-sandbox-list.png` with a runtime column. If no other file references that image, the PR deletes it.
- [ ] `CHANGELOG.md` `## [Unreleased]` replaces the openshell removal line with a line about the invalid-entry behavior. `agro sandbox list` skips the entry with one warning line. Each other verb exits 1 with the validation error and a remedy line. A second line under `### Removed` records the removal of the `runtime` column and of the `runtime` key of `agro sandbox list --json`.
- [ ] `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` holds 17 decisions R1 to R17. Fresh decision-only agents make them against the final instruction files. Its provenance equals `sourceProvenance()`. `agro run -- pnpm exec vitest run .agro/scripts/__tests__/sandbox-routing.test.ts` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file.

### US-004: Manual review transcript

**Description:** As a reviewer, I want a command transcript from the branch CLI. With it, I can confirm the list and refusal behavior on a real registry.

**Acceptance Criteria:**

- [ ] `.agro/tasks/fold-runtime-catalog/evidence/manual-review.md` holds a transcript of `node .agro/cli/dist/agro.js` from a fresh build of this branch.
- [ ] The transcript uses a new temp directory as `AGRO_HOME`, passed inline. It seeds one healthy entry and one entry with `runtime: "openshell"`.
- [ ] The transcript shows `sandbox list` and `sandbox list --json` with the one warning line. Then it shows `destroy <invalid>` and `ps <invalid>` with exit 1 and the remedy line. Then it shows `ls` of the invalid entry with `agro.json` unchanged.
- [ ] The transcript shows `sandbox install microsandbox --yes` with exit 1.
- [ ] The transcript creates no container and no live resource, and it deletes the temp directory at the end.

## Summary

PR #1653 made Docker the only sandbox runtime. The CLI still derives that one value through `lib/runtimes/catalog.ts` (`RUNTIME_CATALOG`, `PROVISIONABLE_RUNTIMES`, `ProvisionableRuntimeId`), the alias `SandboxRuntime`, and `SANDBOX_RUNTIMES` in `lib/agro-config.ts`. `agro sandbox --help` prints a runtime catalog, and `agro sandbox list` prints a runtime column that shows `docker` for each valid entry.

Release 0.39 has not shipped, so registry entries with `runtime: "openshell"` can exist on user machines. After this change, such an entry fails validation. The approach replaces the runtime-specific shim with generic invalid-entry handling. `agro sandbox list` skips each entry whose `agro.json` fails validation and prints one warning line. Each verb that targets one invalid entry exits 1 with the validation error and a remedy line.

Today `materialize` falls back to `{ version: 1 }` through `safeReadAgroConfig`. `runDestroy` removes the entry directory after `docker compose down`. The by-name check must therefore run before `materialize` and before any compose call.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/runtimes/catalog.ts` | `RUNTIME_CATALOG`, `PROVISIONABLE_RUNTIMES`, `findRuntime`, `runtimeIds` | Deleted |
| `.agro/cli/src/lib/agro-config.ts` | `SandboxRuntime`, `SANDBOX_RUNTIMES`, `RETIRED_RUNTIMES`, `isRetiredRuntime`, `RetiredRuntimeError`, `retiredRuntimeRefusal`, `assertActiveRuntime`, `validateAgroConfig`, `AGRO_CONFIG_FIELDS` | Constant `SANDBOX_RUNTIME`; generic invalid-entry error |
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall` | Drop `runtime` write; refuse any positional other than `docker` |
| `.agro/cli/src/controllers/sandbox.ts` | `runtimeLines`, `printSandboxHelp`, `parseSandboxArgs` | Drop the `Runtimes:` section |
| `.agro/cli/src/cli.ts` | `runtimeLines` re-export, `runCli` catch of `RetiredRuntimeError` | Catch the generic invalid-entry error and exit 1 |
| `.agro/cli/src/commands/sandbox-list.ts` | `runSandboxList` | Skip invalid entries with one warning line; drop the runtime column |
| `.agro/cli/src/commands/lifecycle.ts` | `sandboxRoot`, `runDestroy` | Validate the entry before `materialize` |
| `.agro/cli/src/commands/egress.ts` | `runEgress` | Validate the entry |
| `.agro/cli/src/services/sandbox-upgrade.ts` | `runSandboxUpgrade` | Validate the entry |
| `.agro/cli/src/lib/registry.ts` | `materialize`, `resolveSandboxRoot`, `entryRepo` | Drop the runtime check; skip invalid entries in the `checkout` scan |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install <runtime>` | Kept | `docker` stays a required positional. Each other value exits 1 with `unknown runtime "<value>" — the only runtime is docker`. |
| `agro sandbox --help` | Removed section | No `Runtimes:` section. |
| `agro sandbox list [--json]` | Changed | No `runtime` column or key. An invalid entry produces one stderr warning line and no row. |
| `agro shell|stop|restart|logs|ps|destroy|compose config|egress|sandbox upgrade` | Changed | An invalid target entry exits 1 with the validation error and a remedy line. |
| `agro config set runtime` | Removed | `runtime` is no longer a settable key. |
| `agro.json` `runtime` | Narrowed | Legacy field. Unset or `docker` is valid. Each other value fails validation. |

## Storage

The registry stays at `${AGRO_HOME:-~/.agro}/sandboxes/<name>/agro.json`. The schema keeps the optional `runtime` field so that entries from releases up to 0.39 that hold `runtime: "docker"` stay valid. New entries carry no `runtime` field. No verb rewrites or deletes an invalid entry.

## Architectural Decisions

- `docker` stays a required positional of `agro sandbox install`. Reason: the README, `docs/lifecycle-commands.md`, the sandbox skill, and each error remedy in the CLI cite `agro sandbox install docker`. A required positional keeps each documented command valid and keeps a future second runtime additive. The parser compares the positional with `SANDBOX_RUNTIME`.
- `runtime` stays in the schema as a legacy field with one accepted value. Reason: removing the field would make `runtime: "openshell"` pass validation, and verbs would then treat an openshell entry as a docker entry. The supervisor decision forbids that fallback.
- One generic invalid-entry path replaces the runtime-specific shim. `readAgroConfig` is the single source of truth for validity. The list verb catches the error per entry. Targeted verbs raise one error type that `runCli` maps to exit 1.
- `agro sandbox list --json` drops the `runtime` key. Reason: the key holds `docker` for each listed entry and carries no information. Release 0.39 has not shipped, and no tracked consumer reads the key.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | runtime docker or unset accepted; openshell and podman rejected; `runtime` not in `AGRO_CONFIG_FIELDS` | US-001 schema |
| `.agro/cli/src/__tests__/sandbox.test.ts` | install writes no `runtime`; unknown positional refusal; list skip with one warning; malformed JSON skip; no runtime column or key | US-001, US-002 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | parse `install docker`; missing positional; help has no `Runtimes:` | US-001 |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | delete the runtime catalog cases | US-001 |
| `.agro/cli/src/__tests__/invalid-entry.test.ts` (replaces `retired-runtime.test.ts`) | each targeted verb exits 1, spawns nothing, keeps the entry; cwd scan skips an invalid entry | US-002 |
| `.agro/cli/src/lib/__tests__/registry.test.ts` | replace the retired materialize case | US-002 |
| `.agro/cli/src/__tests__/compose-verbs.test.ts`, `.agro/cli/src/__tests__/execution-target.test.ts`, `.agro/cli/src/lib/__tests__/config-render.test.ts` | keep `runtime: "docker"` fixtures valid | US-001 |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | observed record matches the new provenance | US-003 |

## Design Principles

- Prefer a smaller truthful model: one constant for one runtime.
- Validate once, in `readAgroConfig`, and handle the error generically.
- A failed read changes nothing on disk and spawns nothing.
- No explanatory comments in tracked code. Prose follows `/ste`.

## Out of Scope

- A second sandbox runtime or a microsandbox install path.
- A migration that rewrites or deletes invalid registry entries.
- `agro run` isolation modes (`--isolation microvm`), which do not read the registry `runtime` field.
- `agro config` and `agro secret` with `--sandbox <name>`. These verbs read and write one field and do not spawn compose or delete files.

## Open Questions

None

## Acceptance Criteria

- [ ] `git grep -n -i -E 'RUNTIME_CATALOG|PROVISIONABLE_RUNTIMES|ProvisionableRuntimeId|SANDBOX_RUNTIMES|RetiredRuntime|isRetiredRuntime|assertActiveRuntime' -- .agro/cli/src` prints nothing.
- [ ] `agro run -- pnpm run typecheck` exits 0.
- [ ] `agro run -- pnpm test` passes, apart from the baseline failures.
- [ ] `agro run -- pnpm run build` exits 0.
- [ ] `agro sandbox list` lists healthy entries and prints one warning line for each invalid entry.
- [ ] A verb that targets an invalid entry exits 1, prints the validation error and a remedy line, and keeps the entry.
- [ ] The PR is ready for review with green CI.

## Lessons

- Claim: `materialize` fell back to `{ version: 1 }` when the function could not read `agro.json`, so a verb could write docker files into an invalid entry. Evidence: `safeReadAgroConfig` in `lib/registry.ts` at `581343a5`. Outcome: fixed in this PR. `materialize` now reads strictly, and each targeted verb validates the entry before `materialize` (`90377912`).
- Claim: the `docs/lifecycle-commands.md` table says that `agro sandbox list` shows every registry entry, but the verb skips an invalid entry. Evidence: commit `58a7e35c`. Outcome: dropped. The verb still reports each entry, as a row or as one warning line, and `docs/configuration.md` documents the warning. A change to that file forces a new routing replay of 17 agents for one word.
- Claim: Git ignores `.agro/tasks/*/evidence/`, so `baseline.md` stayed untracked until the advisor added it with `git add -f`. Evidence: `git status` after US-004. Outcome: dropped. `manual-review.md` in `/git` already documents `git add -f` for evidence files.
- Claim: the task brief named `docs/runtimes/openshell.md` as a hashed routing file, but that file does not exist and `sandbox-routing.ts` does not hash it. Evidence: `instructionFiles` in `.agro/scripts/__tests__/helpers/sandbox-routing.ts`. Outcome: dropped. No code or document depends on the brief.
- Proposed issues: none.
