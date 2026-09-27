# PRD: Separate the checkout mount and the home mount in sandbox install

Status: DRAFT

Source: `work/issue-1042.md`.

## User Stories

### US-001: Select build mode from checkout contents

**Description:** As an operator, I want `--repo` to select build mode only for a checkout so that I can bind any host directory.

**Acceptance Criteria:**

- [ ] `seedConfig()` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` only when `existsSync(<repo>/.devcontainer/Dockerfile)` is true and no seed sets `image.mode`.
- [ ] Red test: `runSandboxInstall({ runtime: "docker", name: "box", repo: <empty tmpdir>, yes: true, run })` returns 0 and writes `image: { mode: "image" }` to `agro.json`.
- [ ] For the same empty-directory install, the rendered env file contains `AGRO_REPO_DIR=<empty tmpdir>`.
- [ ] For the same empty-directory install, the wrapper argv contains `--no-build` and does not contain `--build`.
- [ ] For the same empty-directory install, `runSandbox` receives `image: true`, so the compose env sets `AGRO_SANDBOX_IMAGE` to the configured `image.ref` or to `DEFAULT_SANDBOX_IMAGE`.
- [ ] The test at `.agro/cli/src/__tests__/sandbox.test.ts:148` creates `<checkout>/.devcontainer/Dockerfile` in its fixture and still asserts `image: { mode: "build" }` and the build compose base.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Refuse build mode without a Dockerfile before the wizard

**Description:** As an operator, I want install to refuse build mode without a Dockerfile before the wizard so that the error names the flag.

**Acceptance Criteria:**

- [ ] Red test: a `--repo` directory whose `agro.json` sets `image.mode` to `build` and that holds no `.devcontainer/Dockerfile` makes `runSandboxInstall` return 1.
- [ ] The stderr of that refusal contains `--repo`, the resolved path, and `.devcontainer/Dockerfile`.
- [ ] The refusal occurs before the first wizard question: the injected `io.ask` receives zero calls.
- [ ] After the refusal, `<registry>/<name>/` does not exist.
- [ ] A preserved entry config with `image.mode` set to `build` and a `--repo` without `.devcontainer/Dockerfile` also returns 1 and leaves the entry directory unchanged.

### US-003: Add `--home-mount <dir>` to `agro sandbox install`

**Description:** As an operator, I want a `--home-mount` flag and wizard prompt so that I choose the `/home/sandbox` host path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs` in `.agro/cli/src/cli.ts` accepts `--home-mount <dir>` and fails with `requires a value` when the value is absent.
- [ ] `runSandboxInstall` resolves `--home-mount` to an absolute path and writes the path to `storage.homePath` in `agro.json`.
- [ ] Red test: `--home-mount <dir>` without `--repo` renders `AGRO_HOME_MOUNT=<dir>`, writes `image: { mode: "image" }`, and materializes the image-only compose base.
- [ ] Red test: `--home-mount <dir>` with `--repo <checkout that holds .devcontainer/Dockerfile>` renders `AGRO_HOME_MOUNT=<dir>` and `AGRO_REPO_DIR=<checkout>`, and materializes the build compose base.
- [ ] The wizard asks one new question for the host path of `/home/sandbox`. A blank answer leaves `storage.homePath` unset.
- [ ] The wizard test at `.agro/cli/src/__tests__/sandbox.test.ts:509` asserts seven questions in order, with the new question included.
- [ ] `--yes` still asks zero questions.

### US-004: Guard `agro config set storage.homePath` against an existing volume

**Description:** As an operator, I want `config set storage.homePath` to refuse when `<name>_workspace` exists so that I keep sandbox state.

**Acceptance Criteria:**

- [ ] `ConfigOptions` in `.agro/cli/src/commands/config.ts` accepts an injected `run: LifecycleRunner` for tests.
- [ ] Red test: when `docker volume inspect <name>_workspace` exits 0, `runConfigSet("storage.homePath", "/srv/x", ...)` returns 1 and leaves `agro.json` unchanged.
- [ ] The stderr of that refusal names `<name>_workspace` and states that the state in that volume becomes orphaned.
- [ ] The stderr of that refusal names the override flag `<override flag>`.
- [ ] Red test: with `<override flag>`, the same call returns 0 and writes `storage.homePath`.
- [ ] Red test: when `docker volume inspect <name>_workspace` exits non-zero, the call returns 0 without the override flag.
- [ ] `runConfigSet` for a key other than `storage.homePath` runs no `docker` command.

### US-005: Update help text and documentation

**Description:** As an operator, I want help text and docs that describe both mounts so that I pick the correct flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp` in `.agro/cli/src/cli.ts` lists `--home-mount <dir>` in the usage line and in the flag list.
- [ ] `printSandboxHelp` states that `--repo` selects build mode only when `<dir>/.devcontainer/Dockerfile` exists.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path and that build mode needs a harness checkout at that path.
- [ ] `docs/configuration.md` documents `--home-mount` as the create-time door to `storage.homePath`.
- [ ] `docs/configuration.md` states the orphaned-volume hazard of `config set storage.homePath` after the first `up`, and names `<override flag>`.
- [ ] `.agro/cli/src/__tests__/docs.test.ts` and `.agro/cli/src/__tests__/cli-first-help.test.ts` pass under `<cli test command>`.

## Summary

The operator ran `agro sandbox install docker --repo ~/sandboxes/agro-sbx-1 --name agro-sbx-1` against an empty directory. The operator wanted `/home/sandbox` to persist at that host path. The install failed in `docker buildx` with `lstat .../.devcontainer: no such file or directory`.

Verified current state:

- `seedConfig()` sets `image.mode` to `build` when `config.repo` is defined and no seed sets a mode (`.agro/cli/src/commands/sandbox.ts:123-126`).
- The only `--repo` preflight is `existsSync(repo)` (`.agro/cli/src/commands/sandbox.ts:197-201`).
- `runSandboxInstall` passes `noBuild` to `runSandbox` when `image.mode` is not `build`. The function does not pass `image: true` (`.agro/cli/src/commands/sandbox.ts:224-230`).
- `runSandbox` sets `AGRO_SANDBOX_IMAGE` only when `image` or `imageRef` is set (`.agro/cli/src/commands/lifecycle.ts:163-169`).
- The build compose base defaults the image to `sandbox-<name>` with `pull_policy: missing` (`.devcontainer/docker-compose.yml:5-6`). A repo bind in image mode therefore needs `image: true`. Without it, Compose pulls a local image name that no registry holds.
- `materialize()` selects the compose base from `opts.repo` (`.agro/cli/src/lib/registry.ts:94-96`).
- `renderComposeVars()` renders `AGRO_HOME_MOUNT` from `storage.homePath` and `AGRO_REPO_DIR` from `repo` (`.agro/cli/src/lib/config-render.ts:40-41`).
- `oh-config.ts:194-203` rejects a relative `storage.homePath`.
- The entrypoint seeds the control plane into an empty `/home/sandbox/harness` bind (`.devcontainer/entrypoint.sh:161-196`).
- `runConfigSet` writes any known field with no Docker check (`.agro/cli/src/commands/config.ts:43-76`).
- The named volume follows the pattern `${name}_${volume}` (`.agro/cli/src/commands/lifecycle.ts:348`). The home volume is `workspace` in both compose bases.

Selected approach: detect a checkout by the presence of `<repo>/.devcontainer/Dockerfile`. Run the build-mode preflight before the wizard. Pass `image: true` to `runSandbox` when a repo bind runs in image mode. Add `--home-mount` as a create-time flag and wizard prompt. Guard `config set storage.homePath` with a `docker volume inspect` check and an override flag.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, `seedConfig`, `runWizard`, `runSandboxInstall` | Mode inference, preflight, `--home-mount`, wizard prompt, `image: true` pass-through |
| `.agro/cli/src/commands/lifecycle.ts` | `runSandbox`, `DEFAULT_SANDBOX_IMAGE`, `configuredImage` | Image ref resolution for image mode; no change planned |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection from `repo`; no change planned |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`; no change planned |
| `.agro/cli/src/lib/oh-config.ts` | `storage.homePath` validation | Absolute-path check for the new flag value; no change planned |
| `.agro/cli/src/commands/config.ts` | `ConfigOptions`, `runConfigSet` | Volume guard and override flag |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs`, `printSandboxHelp`, `parseConfigArgs`, config dispatch at line 1063 | Flag parsing, help text, override-flag plumbing |
| `.devcontainer/docker-compose.yml` | `build.context`, `volumes` | Build context and both mounts; no change planned |
| `.devcontainer/docker-compose.image-only.yml` | `volumes` | Home mount only; no change planned |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --repo <dir>` | Behavior change | Build mode needs `<dir>/.devcontainer/Dockerfile`. Other directories bind in image mode. |
| `agro sandbox install docker --home-mount <dir>` | New flag | Sets `storage.homePath` at create time. |
| `agro sandbox install` wizard | New prompt | Asks for the host path of `/home/sandbox`. Blank keeps the named volume. |
| `agro config set storage.homePath <dir>` | New refusal | Exits 1 when `<name>_workspace` exists, unless the operator passes `<override flag>`. |
| `agro sandbox --help` | Text change | Documents `--home-mount` and the checkout rule for `--repo`. |

## Storage

The entry file `agro.json` under the registry keeps its current schema. `storage.homePath` and `repo` already exist. The Docker named volume `<name>_workspace` stays the default home store. No schema change.

## Architectural Decisions

- The checkout file `<repo>/.devcontainer/Dockerfile` is the source of truth for build capability. The presence of `--repo` is not.
- An explicit `image.mode` from the repo seed or from the preserved entry config wins over detection. The preflight then validates that mode.
- `repo` keeps its single role as the bind source. `materialize()` keeps the build-capable base whenever `repo` is set. Image mode with a repo relies on `AGRO_SANDBOX_IMAGE` and `--no-build`.
- `storage.homePath` is a create-time decision. The install flag is the primary door. `config set` stays available behind the guard.
- The volume guard runs on the host through the injected `LifecycleRunner`, so tests stub `docker volume inspect`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` resolves to image mode, renders `AGRO_REPO_DIR`, argv has `--no-build` and no `--build`, sets `AGRO_SANDBOX_IMAGE` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Line-148 case with a `.devcontainer/Dockerfile` fixture still selects build mode and the build base | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seed `image.mode: "build"` without a Dockerfile exits 1, asks nothing, writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone renders `AGRO_HOME_MOUNT` and selects the image-only base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` with a checkout renders both keys and selects the build base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Wizard asks seven questions; `--yes` asks none | US-003 |
| `.agro/cli/src/__tests__/cli.property.test.ts` or `<parser test file>` | `parseSandboxArgs` accepts `--home-mount <dir>` and rejects a missing value | US-003 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | Refusal when the volume exists; success with `<override flag>`; success when the volume is absent; no `docker` call for other keys | US-004 |
| `.agro/cli/src/__tests__/docs.test.ts`, `.agro/cli/src/__tests__/cli-first-help.test.ts` | Help and docs stay consistent | US-005 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `.agro/evals/probes/oh-home-mount.sh`, `.agro/evals/probes/oh-image-only-deploy.sh` | Compose-string probes exit 0 | Regression floor |

Run each probe with `bash .agro/evals/probes/<probe>.sh`. Run the CLI suite with `<cli test command>`. Run `npm --prefix .agro/cli run typecheck`.

Existing fixtures in `sandbox.test.ts` that pass an empty `--repo` and assert `image.mode: "build"` need a `.devcontainer/Dockerfile` file. Check the cases at lines 178, 315, and 427.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Fail before side effects. Each refusal exits before the wizard and before the registry write.
- Name the flag, the path, and the missing file in each error.
- Keep one meaning per flag. `--repo` binds a checkout. `--home-mount` binds the home.
- Add no machinery beyond the four fixes in the issue.

## Out of Scope

- The flag rename from `--repo` to `--checkout`. The issue tracks that rename separately.
- UID and GID reconciliation on the empty-bind path (`.devcontainer/entrypoint.sh:167-191`). The issue tracks that edge separately.
- Changes to the compose files, the entrypoint, or the compose probes.
- An existence check or ownership check for the `--home-mount` directory.
- Public documentation in `mifunedev/agro-web`.

## Open Questions

1. What is the name of the override flag for `agro config set storage.homePath`? The proposal is `--orphan-volume`. The plan writes `<override flag>` until the operator confirms a name.
2. Which command runs the CLI test suite? The plan writes `<cli test command>`. The grounding verified only the `typecheck` script in `.agro/cli/package.json`.
3. Must `agro-web` document `--home-mount` in the same release? This plan excludes that change.

## Acceptance Criteria

- [ ] Each US-001 to US-005 acceptance criterion passes.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh`, `bash .agro/evals/probes/oh-home-mount.sh`, and `bash .agro/evals/probes/oh-image-only-deploy.sh` each exit 0.
- [ ] `git diff --stat` shows no change under `.devcontainer/`.

## Lessons

Filled by the advisor before undraft.
