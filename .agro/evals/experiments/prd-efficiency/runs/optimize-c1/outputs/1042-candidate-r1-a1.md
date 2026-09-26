# PRD: Split the repo bind from the home mount in sandbox install

Status: DRAFT

## User Stories

### US-001: Select build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only when `<dir>` holds `.devcontainer/Dockerfile` so that an empty host directory binds and runs the published image.

**Acceptance Criteria:**

- [ ] A red test first reproduces the issue symptom: `runSandboxInstall` with `repo: <empty tmp dir>` writes `image: { mode: "build" }` before the fix.
- [ ] After the fix, `repo: <empty tmp dir>` writes `repo: <dir>` and `image: { mode: "image" }` to `agro.json`.
- [ ] After the fix, the rendered compose env for `repo: <empty tmp dir>` contains `AGRO_REPO_DIR=<dir>`.
- [ ] After the fix, the wrapper argv for `repo: <empty tmp dir>` contains `--no-build` and does not contain `--build`.
- [ ] `repo: <dir>` with `<dir>/.devcontainer/Dockerfile` present writes `image: { mode: "build" }` and selects the build base.
- [ ] A seed with `image.mode: "build"` and a repo without `.devcontainer/Dockerfile` makes `runSandboxInstall` return 1 before the first wizard question.
- [ ] The stderr of that failure names `--repo`, the resolved path, and the missing `.devcontainer/Dockerfile`.
- [ ] That failure leaves no directory for the sandbox name under the registry root.
- [ ] `--image=<ref>` with the same seed returns 0, because the flag sets `image.mode` to `image` before the preflight.

### US-002: Add the --home-mount install flag and wizard prompt

**Description:** As an operator, I want `agro sandbox install docker --home-mount <dir>` so that I choose the `/home/sandbox` persistence path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs` accepts `--home-mount <dir>` and returns the value in a new `homeMount` field.
- [ ] `parseSandboxArgs` returns an error that names `--home-mount` when the value is missing.
- [ ] `--home-mount <dir>` alone writes `storage.homePath: <absolute dir>` and keeps `image.mode: "image"`.
- [ ] `--home-mount <dir>` alone renders `AGRO_HOME_MOUNT=<dir>` into the compose env.
- [ ] `--home-mount <dir>` alone materialises the image-only compose base, which carries no `/home/sandbox/harness` bind.
- [ ] `--home-mount <dir>` with `--repo <checkout>` renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`, and materialises the build base.
- [ ] `--home-mount <dir>` with a path that does not exist returns 1, names the flag and the path, and writes no registry entry.
- [ ] The wizard asks seven questions. The seventh question names the home mount and shows `blank` as the default.
- [ ] A blank wizard answer leaves `storage.homePath` unset. An absolute path answer sets `storage.homePath`.
- [ ] A `--home-mount` value becomes the wizard default for the seventh question.

### US-003: Guard config set storage.homePath against an existing volume

**Description:** As an operator, I want `agro config set storage.homePath` to refuse when the volume `<name>_workspace` exists so that a late change cannot orphan my sandbox state.

**Acceptance Criteria:**

- [ ] `runConfigSet("storage.homePath", <dir>, ...)` runs `docker volume inspect <name>_workspace` through an injectable runner.
- [ ] When that command exits 0, `runConfigSet` returns 1 and leaves `agro.json` unchanged.
- [ ] The refusal message names the volume, states that existing state in the volume becomes orphaned, and names the override flag.
- [ ] With the override flag, `runConfigSet` returns 0 and writes `storage.homePath`.
- [ ] When the inspect command exits non-zero, `runConfigSet` writes `storage.homePath` and returns 0.
- [ ] `runConfigSet` for any other field runs no `docker` command.
- [ ] `parseConfigArgs` accepts the override flag for `config set` and rejects the flag for `config show`.

### US-004: Update the install help and the user docs

**Description:** As an operator, I want the help text and docs to separate the two mounts so that I pick the correct flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp` lists `--home-mount <dir>` in the usage line and in the flag table.
- [ ] `printSandboxHelp` states that build mode applies only when the `--repo` path holds `.devcontainer/Dockerfile`.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path and that build mode requires a harness checkout at that path.
- [ ] `docs/configuration.md` documents `--home-mount` as the create-time door to `storage.homePath`.
- [ ] `docs/configuration.md` states the orphaned-volume hazard of a later `config set storage.homePath`, and names the override flag.
- [ ] `docs/lifecycle-commands.md` lists `--home-mount` wherever the document lists the install flags.

## Summary

The `agro sandbox install docker` verb has one flag, `--repo`, for two mounts. The operator in the issue passed an empty directory to `--repo` to persist the sandbox. The install failed inside `docker buildx` with an `lstat` error on `.devcontainer`.

Verified current state:

- `seedConfig` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` whenever `config.repo` is set (lines 118-121).
- The only `--repo` preflight is an existence check (lines 196-200).
- `runSandboxInstall` computes `useNoBuild` from `config.repo` and `image.mode` (lines 222-223).
- `runSandboxInstall` creates the registry entry with `mkdirSync(root)` after the wizard (lines 243-246). A preflight before the wizard therefore leaves no entry.
- `materialize` in `.agro/cli/src/lib/registry.ts` selects `composeImageOnly` when `opts.repo` is undefined (line 95).
- `renderComposeVars` in `.agro/cli/src/lib/config-render.ts` already maps `storage.homePath` to `AGRO_HOME_MOUNT` (line 40).
- `.devcontainer/docker-compose.image-only.yml` line 9 and `.devcontainer/docker-compose.yml` line 12 bind `AGRO_HOME_MOUNT` at `/home/sandbox`, with the `workspace` named volume as the fallback.
- The compose project name is `SANDBOX_NAME` (`.devcontainer/docker-compose.image-only.yml` line 1). Docker therefore names the volume `<name>_workspace`.
- `.devcontainer/entrypoint.sh` lines 161-166 detect a checkout by its control directory, not by the bind. An empty bind reaches the seed branch at lines 192-196.
- `runConfigSet` in `.agro/cli/src/commands/config.ts` writes any field with `setConfigField` and has no runner.

Selected approach:

1. In `seedConfig`, infer `build` only when `<repo>/.devcontainer/Dockerfile` exists. Keep a seeded `image.mode` as is.
2. Move the `--image=<ref>` override ahead of the wizard.
3. Run the build preflight after that override. The wizard does not change `image.mode`, so the new order keeps the current behavior.
4. Add `--home-mount <dir>` to the parser, the install options, `seedConfig`, and the wizard.
5. Add a volume guard to `runConfigSet` for the `storage.homePath` key only.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Mode inference, build preflight, `homeMount` option, seventh wizard prompt |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs`, the `runSandboxInstall` call near line 1165 | Parse `--home-mount` and pass the value to the install |
| `.agro/cli/src/cli.ts` | `printSandboxHelp` (lines 251-285) | Install help text |
| `.agro/cli/src/cli.ts` | `ConfigArgs`, `parseConfigArgs`, the `runConfigSet` call near line 1063 | Parse the override flag and pass the flag to `runConfigSet` |
| `.agro/cli/src/commands/config.ts` | `ConfigOptions`, `runConfigSet` | Volume guard for `storage.homePath` |
| `.agro/cli/src/lib/oh-config.ts` | `storage.homePath` validation (lines 194-205) | Existing absolute-path rule. Reuse the rule. Do not duplicate the rule. |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Unchanged. Selects the compose base from `repo`. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Unchanged. Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --repo <dir>` | Behavior change | Selects build mode only when `<dir>/.devcontainer/Dockerfile` exists. |
| `agro sandbox install docker --home-mount <dir>` | New flag | Sets `storage.homePath`. |
| `agro sandbox install` wizard | New prompt | Seventh question for the home mount. The default is blank, which means the named volume. |
| `agro sandbox install` preflight | New error | Exit 1 when `image.mode` is `build` and the repo lacks `.devcontainer/Dockerfile`. |
| `agro config set storage.homePath <dir>` | New guard | Exit 1 when the volume `<name>_workspace` exists, unless the operator passes `<override flag>`. |
| `printSandboxHelp` | Text change | Documents both flags and the build-mode rule. |

## Storage

The change adds no new store. `--home-mount` writes the existing `storage.homePath` field of `agro.json` in the registry entry. The guard reads Docker volume state through `docker volume inspect`. The guard writes nothing.

## Architectural Decisions

- **Source of truth for build mode:** the checkout contents decide. The presence of `--repo` does not decide. An explicit `image.mode` in a seed or an entry still wins.
- **Preflight location:** the build preflight runs before the wizard and before `mkdirSync(root)`. A failed preflight therefore writes no registry entry.
- **Compose base:** `materialize` keeps selecting the base from `repo`. `--home-mount` alone therefore keeps the image-only base. This task does not change `materialize`.
- **Guard scope:** the volume guard applies only to the `storage.homePath` key. The guard derives `<name>` from the `name` field of the target `agro.json`.
- **Runner injection:** `ConfigOptions` gains an optional `run?: LifecycleRunner`, defaulting to `spawnRunner`, in the style of `SandboxInstallOptions`.
- **Execution location:** all changes run on the host CLI. The sandbox image and the entrypoint do not change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | Empty `--repo` dir resolves to `image.mode: "image"`, renders `AGRO_REPO_DIR`, and passes `--no-build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Existing case at line 148: add `.devcontainer/Dockerfile` to the fixture. The case keeps its build-mode assertions. | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seeded `image.mode: "build"` without the Dockerfile returns 1, asks nothing, and writes no entry | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--image=<ref>` with the same seed returns 0 | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `homeMount` alone and `homeMount` with `repo`: config, rendered env, and compose base | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `homeMount` with a missing path returns 1 and writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | The wizard case at line 509 asks seven questions. Blank and path answers for the seventh question. | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `parseSandboxArgs` with `--home-mount <dir>` and with a missing value | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | Guard refuses on an existing volume, proceeds with the override, proceeds on a missing volume, and skips Docker for other fields | US-003 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `parseConfigArgs` accepts the override flag on `set` and rejects the flag on `show` | US-003 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh` | Existing compose-string probe stays green | Regression |
| `.agro/evals/probes/oh-home-mount.sh` | Existing compose-string probe stays green | Regression |
| `.agro/evals/probes/oh-image-only-deploy.sh` | Existing compose-string probe stays green | Regression |

The implementer runs `<cli test command>` for the vitest suite and `npm --prefix .agro/cli run typecheck` for types. The implementer runs each probe with `bash <probe path>`.

## Design Principles

- Keep one source of truth: the checkout contents select build mode.
- Fail inside `agro`, before Docker runs, with a message that names the flag, the path, and the missing file.
- Put a create-time decision at create time. Guard the late door.
- Add no explanatory comments to tracked code, per `AGENTS.md`.
- Change no compose file and no entrypoint.

## Out of Scope

- UID and GID reconciliation for the empty-bind path in `.devcontainer/entrypoint.sh`. The issue tracks this edge separately.
- The rename of `--repo` to `--checkout`. The issue tracks the rename separately.
- Any change to `materialize`, to the compose files, or to `renderComposeVars`.
- Public docs in `mifunedev/agro-web`. Open question 4 covers this surface.

## Open Questions

1. What is the name of the override flag for `config set storage.homePath`? The issue does not name the flag. The plan uses `<override flag>`. A candidate is `--orphan-volume`, because the name states the consequence.
2. Must `--home-mount <dir>` refuse a missing host path? The plan refuses a missing path, to match the `--repo` preflight. In the alternative design, the CLI creates the directory on the host.
3. Must the build preflight also run when the operator passes `--no-build`? Per the issue, the plan runs the preflight whenever `image.mode` is `build` and `config.repo` has a value.
4. Does the new flag and the build-mode rule require a matching change in `mifunedev/agro-web`?
5. What is the exact vitest command for `.agro/cli`? The `package.json` grep found `build` and `typecheck` scripts, but no `test` script.
6. Must the guard run when `config set` targets the project root without `--sandbox`? The plan runs the guard for both scopes, with `<name>` from the target `agro.json`.

## Acceptance Criteria

- [ ] Each US-001 to US-004 criterion passes.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-home-mount.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-image-only-deploy.sh` exits 0.
- [ ] The diff adds no explanatory comment to tracked code.

## Lessons

Filled by the advisor before undraft.
