# PRD: Separate the repo bind from build mode and add --home-mount

Status: DRAFT

## User Stories

### US-001: Infer build mode from the checkout contents

**Description:** As an operator, I want `--repo` to build only from a real checkout so that an empty directory still installs.

**Acceptance Criteria:**

- [ ] `seedConfig()` sets `image.mode` to `build` only when `<repo>/.devcontainer/Dockerfile` exists and the seed sets no `image.mode`.
- [ ] If `--repo` names an existing directory without `.devcontainer/Dockerfile`, the entry keeps `repo` and sets `image.mode` to `image`.
- [ ] For `--repo <empty dir>`, the rendered compose env contains `AGRO_REPO_DIR=<empty dir>`.
- [ ] For `--repo <empty dir> --print-argv`, the printed argv contains no `--build` token.
- [ ] The existing test "--repo renders AGRO_REPO_DIR into the compose env and selects the build base" in `.agro/cli/src/__tests__/sandbox.test.ts` passes against a fixture that holds `.devcontainer/Dockerfile`.

### US-002: Refuse build mode without a Dockerfile before the wizard

**Description:** As an operator, I want an early named error so that a bad build request fails before Docker runs.

**Acceptance Criteria:**

- [ ] If the merged config sets `image.mode` to `build` and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall()` returns a non-zero code.
- [ ] The install command runs this check before `runWizard()`, so the wizard asks no question.
- [ ] The stderr message names the `--repo` flag, the resolved path, and the missing `.devcontainer/Dockerfile` file.
- [ ] After this refusal, no registry entry directory exists for the sandbox name.

### US-003: Add the --home-mount install flag and wizard prompt

**Description:** As an operator, I want a `--home-mount` install flag so that I choose the sandbox home path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs()` accepts `--home-mount <dir>` and returns an error when the value is missing.
- [ ] `runSandboxInstall()` resolves the value to an absolute path and writes the path to `storage.homePath`.
- [ ] `--home-mount <dir>` renders `AGRO_HOME_MOUNT=<dir>` and keeps `image.mode` at `image`.
- [ ] `--home-mount <dir>` without `--repo` writes the image-only compose base.
- [ ] `--home-mount <dir>` with `--repo <checkout>` renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR` and writes the build-capable compose base.
- [ ] The wizard asks for the home mount path. A blank answer leaves `storage.homePath` unset.
- [ ] The wizard test "asks exactly six questions in order and writes the answers" in `.agro/cli/src/__tests__/sandbox.test.ts` changes to seven questions and passes.

### US-004: Guard config set storage.homePath against an existing volume

**Description:** As an operator, I want `config set storage.homePath` to refuse on a booted sandbox so that I do not orphan state.

**Acceptance Criteria:**

- [ ] If the volume `<name>_workspace` exists, `runConfigSet()` for `storage.homePath` returns a non-zero code and leaves `agro.json` unchanged.
- [ ] The refusal message states that existing state in `<name>_workspace` becomes orphaned and names the override flag.
- [ ] With the override flag, `runConfigSet()` writes the value and returns 0.
- [ ] If the volume does not exist, `runConfigSet()` writes the value without the override flag.
- [ ] The volume check uses an injectable runner, so the tests run without Docker.

### US-005: Update help text and documentation

**Description:** As an operator, I want the docs to describe both mounts so that I pick the correct flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp()` in `.agro/cli/src/cli.ts` lists `--home-mount <dir>` and states that build mode needs `.devcontainer/Dockerfile` in the `--repo` path.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` is a host path and that build mode applies only when that path is a harness checkout.
- [ ] `docs/configuration.md` documents `--home-mount` as the create-time door to `storage.homePath` and states the orphaned-volume hazard.
- [ ] `docs/lifecycle-commands.md` lists `--home-mount` and the `config set` override flag.
- [ ] `pnpm test:scripts` passes, including `.agro/cli/src/__tests__/docs.test.ts`.

## Summary

Issue 1042 reports that `agro sandbox install docker --repo <empty dir>` fails inside `docker buildx` with an `lstat` error on `.devcontainer`.

Verified current state:

- `seedConfig()` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` whenever `config.repo` is set and the seed sets no mode.
- `runSandboxInstall()` checks only that the `--repo` directory exists. The function does not inspect the directory contents.
- `runSandboxInstall()` sets `useNoBuild` from `config.repo` and `image.mode`.
- `materialize()` in `.agro/cli/src/lib/registry.ts` picks the compose base from `opts.repo` alone.
- `renderComposeVars()` in `.agro/cli/src/lib/config-render.ts` already renders `AGRO_HOME_MOUNT` from `storage.homePath`.
- `.devcontainer/docker-compose.image-only.yml` already carries the home mount line.
- `.devcontainer/entrypoint.sh` seeds the control plane into an empty bind at the /home/sandbox/harness mount point.
- `runConfigSet()` in `.agro/cli/src/commands/config.ts` writes any known field with no volume check.
- `namedVolumes()` in `.agro/cli/src/commands/lifecycle.ts` lists the volume suffixes that the compose files declare.

Selected approach: derive build mode from the presence of `<repo>/.devcontainer/Dockerfile`. Refuse an explicit build mode without that file before the wizard runs. Add `--home-mount` as the install door to `storage.homePath`. Guard the later `config set` door with a volume check and an override flag.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig()`, `runWizard()`, `runSandboxInstall()`, `SandboxInstallOptions` | Mode inference, preflight, wizard prompt, `homeMount` option |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs()`, `printSandboxHelp()`, `parseConfigArgs()` | Flag parsing and help text |
| `.agro/cli/src/commands/config.ts` | `runConfigSet()`, `ConfigOptions` | Volume guard and override flag |
| `.agro/cli/src/commands/lifecycle.ts` | `namedVolumes()`, `LifecycleRunner` | Volume naming and injectable runner |
| `.agro/cli/src/lib/registry.ts` | `materialize()` | Compose base selection, unchanged |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars()` | Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`, unchanged |
| `.devcontainer/entrypoint.sh` | empty-bind seed branch | Seeds an empty bind at the /home/sandbox/harness mount point, unchanged |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --repo <dir>` | Behavior change | Build mode applies only when `<dir>` holds `.devcontainer/Dockerfile`. |
| `agro sandbox install docker --home-mount <dir>` | New flag | Sets `storage.homePath` at create time. |
| Install wizard | New prompt | Asks for the home mount path. The default is blank. |
| `agro config set storage.homePath <dir>` | New guard | Refuses when `<name>_workspace` exists, unless the operator passes the override flag. |
| Install help text | Text change | Documents `--home-mount` and the build-mode rule. |

## Storage

The registry entry `agro.json` under the sandbox entry directory holds `repo`, `image.mode`, and `storage.homePath`. The schema does not change. The guard reads Docker volume state and writes nothing.

## Architectural Decisions

- The checkout contents are the source of truth for inferred build mode. A seed or entry value for `image.mode` still wins.
- The preflight runs before the wizard and before the entry directory exists, so a refusal leaves no registry entry.
- `--image=<ref>` keeps its current effect: the flag forces `image.mode` to `image`.
- `--home-mount` does not set `repo`, so `materialize()` keeps the image-only base.
- The `config set` guard applies only to `storage.homePath`. Other fields keep their current behavior.
- The volume check runs on the host through the injected `LifecycleRunner`. The proposed probe is `docker volume inspect <name>_workspace`.
- The rename of `--repo` to `--checkout` stays in a separate issue.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` sets `image.mode` to `image`, renders `AGRO_REPO_DIR`, and prints no `--build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Existing `--repo` build case with a `.devcontainer/Dockerfile` fixture | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seed `image.mode: "build"` without a Dockerfile exits non-zero, asks nothing, and writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone and `--home-mount` with `--repo <checkout>` | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Wizard asks seven questions in order | US-003 |
| `.agro/cli/src/__tests__/cli.property.test.ts` | `parseSandboxArgs()` accepts `--home-mount <dir>` and rejects a missing value | US-003 |
| New file `.agro/cli/src/__tests__/config-set.test.ts` | Refusal when the volume exists, write with the override flag, write when no volume exists | US-004 |
| `.agro/cli/src/__tests__/docs.test.ts` | Docs stay consistent with the CLI | US-005 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh` | Compose-string probe stays green | Regression |
| `.agro/evals/probes/oh-home-mount.sh` | Home mount probe stays green | Regression |
| `.agro/evals/probes/oh-image-only-deploy.sh` | Image-only probe stays green | Regression |

Run `pnpm test:scripts` from the repository root. Run each probe with `bash <probe path>`.

## Design Principles

- Keep one source of truth for each decision: the checkout decides build mode, and the operator decides the home path at create time.
- Fail before side effects: refuse in preflight, before the wizard and before the registry write.
- Name the flag, the path, and the missing file in every refusal.
- Add no explanatory comments to tracked code.
- Apply YAGNI: add one flag, one prompt, and one guard.

## Out of Scope

- The rename of `--repo` to `--checkout`.
- UID and GID reconciliation for the empty-bind path in `.devcontainer/entrypoint.sh`.
- Changes to the compose files or to the entrypoint.
- Migration of data from `<name>_workspace` to a host path.
- Public docs in the mifunedev/agro-web repository, unless the operator asks for them.

## Open Questions

1. What is the name of the `config set` override flag? The proposal is `--force`.
2. Without `--sandbox`, `config set` writes the project root. Does the guard derive the volume name from `name` in that `agro.json`?
3. Must the volume check use `docker volume inspect`, or must the check reuse `namedVolumes()` from `lifecycle.ts`?
4. Does `agro-web` need a matching docs change for `--home-mount`?

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0 from the repository root.
- [ ] `pnpm run typecheck` exits 0 from the repository root.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh`, `bash .agro/evals/probes/oh-home-mount.sh`, and `bash .agro/evals/probes/oh-image-only-deploy.sh` report PASS.
- [ ] A failed install preflight leaves no registry entry.

## Lessons

Filled by the advisor before undraft.
