# PRD: Separate the checkout bind from the home mount in sandbox install

Status: DRAFT

Source: `work/issue-1042.md`.

## User Stories

### US-001: Select build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only when `<dir>` holds `.devcontainer/Dockerfile` so that an empty host directory binds and runs the published image.

**Acceptance Criteria:**

- [ ] A red test in `.agro/cli/src/__tests__/sandbox.test.ts` runs `--repo <empty dir> --yes` and expects `image.mode` `"image"` in the entry. The test fails before the change.
- [ ] For `--repo <empty dir>`, the rendered compose env holds `AGRO_REPO_DIR=<empty dir>`.
- [ ] For `--repo <empty dir> --print-argv`, the printed argv holds `--no-build` and holds no `--build`.
- [ ] For `--repo <checkout>` with `.devcontainer/Dockerfile`, the test at `.agro/cli/src/__tests__/sandbox.test.ts:148` passes without edits.
- [ ] If a seed sets `image.mode` to `"build"` and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall` returns 1 before the wizard asks a question.
- [ ] The stderr text of that refusal names `--repo`, the resolved path, and `.devcontainer/Dockerfile`.
- [ ] After that refusal, `entryRoot(<name>)` does not exist.

### US-002: Add the `--home-mount` install flag and wizard prompt

**Description:** As an operator, I want `agro sandbox install docker --home-mount <dir>` so that I set `storage.homePath` at create time.

**Acceptance Criteria:**

- [ ] `--home-mount <dir> --yes` writes `storage.homePath` as the resolved `<dir>` into the entry `oh.json`.
- [ ] `--home-mount <dir>` renders `AGRO_HOME_MOUNT=<dir>` into the compose env.
- [ ] `--home-mount <dir>` without `--repo` keeps `image.mode` `"image"` and materializes the `composeImageOnly` base.
- [ ] `--home-mount <dir> --repo <checkout>` renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR` and materializes the `composeRepo` base.
- [ ] The wizard asks for the home mount. A blank answer leaves `storage.homePath` unset.
- [ ] The wizard test at `.agro/cli/src/__tests__/sandbox.test.ts:509` expects seven questions in the new order.
- [ ] If `<dir>` does not exist, the install returns 1, names `--home-mount`, and writes no entry. See Open Question 2.

### US-003: Guard `config set storage.homePath` against an existing volume

**Description:** As an operator, I want `agro config set storage.homePath` to refuse when the named volume `<name>_workspace` exists so that I do not orphan sandbox state by accident.

**Acceptance Criteria:**

- [ ] If the runner reports that `<name>_workspace` exists, `runConfigSet` returns 1 and leaves `oh.json` unchanged.
- [ ] The refusal text names the volume and states that the volume state becomes orphaned.
- [ ] With the override flag `<override flag>`, `runConfigSet` writes the value and returns 0.
- [ ] If the volume does not exist, `runConfigSet` writes the value without the override flag.
- [ ] A `config set` of a different key runs no volume check.

### US-004: Update the help text and the documentation

**Description:** As an operator, I want the help text and the docs to describe the two mounts so that I pick the correct flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp` in `.agro/cli/src/cli.ts` lists `--home-mount <dir>` and states that `--repo` selects build mode only for a checkout that holds `.devcontainer/Dockerfile`.
- [ ] `docs/installation.md` and `docs/quickstart.md` state the same `--repo` rule.
- [ ] `docs/configuration.md` names `--home-mount` as the create-time door to `storage.homePath` and states the orphaned-volume hazard.
- [ ] `.agro/cli/src/__tests__/docs.test.ts` and `.agro/cli/src/__tests__/cli-first-help.test.ts` pass.

## Summary

Verified current state:

- `seedConfig` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `"build"` for any `repo` value.
- `runSandboxInstall` checks only that the `--repo` path exists. The check returns before the entry write.
- `runSandboxInstall` writes the entry with `mkdirSync(root)`, `writeOhConfig`, and `materialize` before `runSandbox`. A build failure leaves the entry.
- `materialize` in `.agro/cli/src/lib/registry.ts:95` selects `composeImageOnly` when `repo` is undefined.
- `.agro/cli/src/lib/config-render.ts:40` renders `AGRO_HOME_MOUNT` from `storage.homePath`.
- `runConfigSet` in `.agro/cli/src/commands/config.ts:43` has no runner and no volume check.
- `.agro/cli/src/commands/lifecycle.ts:348` builds volume names as `${name}_${volume}`.

Selected approach: compute build eligibility from `existsSync(join(repo, ".devcontainer/Dockerfile"))` in `seedConfig`. Refuse a `"build"` seed without the Dockerfile before the wizard. Add `homeMount` to `SandboxInstallOptions` and to the `cli.ts` flag table. Add a volume probe with a `LifecycleRunner` to `runConfigSet` for the key `storage.homePath` only.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Build-mode rule, preflight, flag, prompt |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection from `repo` |
| `.agro/cli/src/lib/config-render.ts` | `AGRO_HOME_MOUNT`, `AGRO_REPO_DIR` render | Compose env keys |
| `.agro/cli/src/commands/config.ts` | `runConfigSet`, `ConfigOptions` | Volume guard |
| `.agro/cli/src/commands/lifecycle.ts` | `namedVolumes` | Volume-name convention |
| `.agro/cli/src/cli.ts` | flag table near line 737, `printSandboxHelp` | Flag parse and help |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | New flag | `--home-mount <dir>` sets `storage.homePath` |
| `agro sandbox install` | Behavior change | `--repo` selects build mode only for a checkout |
| `agro sandbox install` wizard | New prompt | Home mount, default blank |
| `agro config set storage.homePath` | New guard | Refuse when `<name>_workspace` exists; `<override flag>` bypasses |

## Storage

The entry `oh.json` under the registry root holds `storage.homePath` and `image.mode`. The schema does not change. The `config set` guard reads the Docker named volume `<name>_workspace` and never writes to it.

## Architectural Decisions

- The checkout contents are the source of truth for build eligibility. The flag presence is not.
- An explicit `image.mode` of `"build"` stays authoritative. A missing Dockerfile turns the explicit value into a refusal, not a silent downgrade.
- `--home-mount` sets only `storage.homePath`. `materialize` keeps `repo` as the only input for the compose base.
- Only `config set` guards the volume. The install flag needs no guard, because install is the create-time door.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` gives image mode, `AGRO_REPO_DIR`, no `--build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | build seed without Dockerfile returns 1, no entry | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone and with `--repo` | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | wizard asks seven questions | US-002 |
| `.agro/cli/src/__tests__/config-repo.test.ts` or a new config test | volume exists, override, no volume, other key | US-003 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `oh-home-mount.sh`, `oh-image-only-deploy.sh` | existing compose-string probes | No regression |

Run the unit tests with `<test command>` from `.agro/cli`. See Open Question 3.

## Design Principles

- Apply the root `AGENTS.md` rule: no explanatory comments in tracked code.
- Fail before the wizard and before any entry write.
- Name the flag, the path, and the missing file in each refusal.
- Keep the flag rename out of this change.

## Out of Scope

- The `--repo` to `--checkout` rename.
- UID and GID reconciliation in the empty-bind path of `.devcontainer/entrypoint.sh`.
- Cleanup of an entry after a later `docker buildx` failure.
- Changes to `mifunedev/agro-web`. See Open Question 4.

## Open Questions

1. What is the name of the `config set` override flag? The proposal is `--force`.
2. Must `--home-mount` refuse a missing directory, or must the command create the directory?
3. What is the exact unit test command in `.agro/cli`? The plan did not verify the `package.json` script.
4. Does `mifunedev/agro-web` document `--repo` or `storage.homePath` and need a matching change?

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `<test command>` in `.agro/cli` exits 0.
- [ ] The three compose-string probes exit 0.
- [ ] The diff adds no explanatory comment to tracked code.

## Lessons

Filled by the advisor before undraft.
