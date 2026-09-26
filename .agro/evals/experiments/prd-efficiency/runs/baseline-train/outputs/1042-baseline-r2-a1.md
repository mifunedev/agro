# PRD: Separate the checkout bind from the home mount in `agro sandbox install`

Status: BLOCKED

## User Stories

### US-001: Select build mode from checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only when `<dir>` holds `.devcontainer/Dockerfile` so that an empty host directory boots the published image.

**Acceptance Criteria:**

- [ ] `seedConfig()` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` only when the seed carries no `image.mode` and `existsSync(<repo>/.devcontainer/Dockerfile)` returns `true`.
- [ ] With `--repo <empty dir>` and `--yes`, the entry `agro.json` holds `repo: <empty dir>` and `image: { mode: "image" }`.
- [ ] With `--repo <empty dir>`, the rendered compose env contains `AGRO_REPO_DIR=<empty dir>`.
- [ ] With `--repo <empty dir> --print-argv`, the wrapper argv contains `--no-build` and does not contain `--build`.
- [ ] With `--repo <empty dir>` and no `image.ref`, the compose env passed to the wrapper sets `AGRO_SANDBOX_IMAGE` to `DEFAULT_SANDBOX_IMAGE`.
- [ ] The test at `.agro/cli/src/__tests__/sandbox.test.ts:148` creates `.devcontainer/Dockerfile` in its fixture and still asserts `image: { mode: "build" }`.
- [ ] `npx vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-002: Refuse build mode without a Dockerfile before the wizard

**Description:** As an operator, I want install to refuse build mode when `.devcontainer/Dockerfile` is absent so that the error names my flag and leaves no entry.

**Acceptance Criteria:**

- [ ] If the merged config has `image.mode: "build"`, `repo` is set, and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall()` returns 1.
- [ ] The preflight runs before `runWizard()`. A test with an `io.ask` stub records zero questions for this case.
- [ ] The stderr message contains the string `--repo`, the resolved repo path, and the string `.devcontainer/Dockerfile`.
- [ ] After the refusal, `<registry>/<name>/` does not exist.
- [ ] The refusal also applies with `--print-argv`, and the runner records no `bash` call.

### US-003: Add the `--home-mount <dir>` install flag and wizard prompt

**Description:** As an operator, I want to set the `/home/sandbox` host path at create time so that the sandbox persists at my host path.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs()` in `.agro/cli/src/cli.ts` accepts `--home-mount <dir>`, and a missing value returns the error `sandbox install: --home-mount requires a value`.
- [ ] `runSandboxInstall()` resolves `--home-mount` to an absolute path and writes the path to `storage.homePath`.
- [ ] If the `--home-mount` directory does not exist, `runSandboxInstall()` returns 1 before the wizard and writes no entry.
- [ ] `--home-mount <dir>` without `--repo` renders `AGRO_HOME_MOUNT=<dir>`, keeps `image.mode: "image"`, and materializes the image-only compose base.
- [ ] `--home-mount <dir>` with `--repo <checkout>` renders `AGRO_HOME_MOUNT=<dir>` and `AGRO_REPO_DIR=<checkout>`, and materializes the build-capable compose base.
- [ ] The wizard asks one home-mount question after the Docker socket question. The default is the current `storage.homePath`, and a blank default leaves `storage.homePath` unset.
- [ ] The wizard test at `.agro/cli/src/__tests__/sandbox.test.ts:509` asserts seven questions in the new order.

### US-004: Guard `agro config set storage.homePath` against an existing volume

**Description:** As an operator, I want `agro config set storage.homePath` to refuse a change after first boot so that I do not orphan volume state silently.

**Acceptance Criteria:**

- [ ] If the key is `storage.homePath`, the new value differs from the current value, and `docker volume inspect <name>_workspace` exits 0, `runConfigSet()` returns 1 and leaves `agro.json` unchanged.
- [ ] The refusal message names the volume `<name>_workspace`, states that the existing state in the volume becomes orphaned, and names the override flag `<override flag>`.
- [ ] With `<override flag>`, `runConfigSet()` writes the value and returns 0.
- [ ] If `docker volume inspect <name>_workspace` exits non-zero, `runConfigSet()` writes the value and returns 0.
- [ ] `runConfigSet()` runs no `docker` command for a key other than `storage.homePath`.

### US-005: Update the help text and the operator documentation

**Description:** As an operator, I want the help text and the documentation to describe both mounts so that I pick the right flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp()` in `.agro/cli/src/cli.ts` lists `--home-mount <dir>` and states that `--repo` selects build mode only when `<dir>/.devcontainer/Dockerfile` exists.
- [ ] `printConfigHelp()` names the override flag for `storage.homePath`.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path and that build mode requires a harness checkout at that path.
- [ ] The `storage.homePath` row in `docs/configuration.md` names `--home-mount` as the create-time flag and describes the orphaned-volume hazard.
- [ ] `npx vitest run .agro/cli/src/__tests__/docs.test.ts .agro/cli/src/__tests__/cli-first-help.test.ts` exits 0.

## Summary

The operator ran `agro sandbox install docker --repo <empty dir>`. The intent was to persist the sandbox at that host path. The install failed inside `docker buildx` with `lstat <dir>/.devcontainer: no such file or directory`.

Verified current state:

- `seedConfig()` sets `image.mode` to `build` whenever `repo` is set (`.agro/cli/src/commands/sandbox.ts:123-126`).
- The only `--repo` preflight is an existence check (`.agro/cli/src/commands/sandbox.ts:197-201`).
- `runSandboxInstall()` writes the entry at `.agro/cli/src/commands/sandbox.ts:244-247`, before `runSandbox()` starts the build.
- `materialize()` selects `composeRepo` when `repo` is set (`.agro/cli/src/lib/registry.ts:95`).
- The build-capable base uses `AGRO_REPO_DIR` as the build context and as the harness bind (`.devcontainer/docker-compose.yml:9-13`).
- The build-capable base defaults the image to `sandbox-<name>` with pull policy `missing` (`.devcontainer/docker-compose.yml:5-6`). Without `AGRO_SANDBOX_IMAGE`, a no-build start against that base has no image to pull.
- `renderComposeVars()` renders `storage.homePath` as `AGRO_HOME_MOUNT` (`.agro/cli/src/lib/config-render.ts:40`).
- `.devcontainer/entrypoint.sh:160-196` seeds the control plane into `/home/sandbox/harness` when the bind holds no control directory.
- No install flag sets `storage.homePath`. Only `agro config set storage.homePath` sets the field.

Selected approach:

1. Detect a checkout with `existsSync(<repo>/.devcontainer/Dockerfile)`. Select build mode only for a checkout.
2. For a non-checkout `--repo`, keep the bind and the build-capable base. Pass `image: true` to `runSandbox()`, so that the published image runs.
3. Run the build-mode preflight after the seeds merge and before the wizard.
4. Add `--home-mount <dir>` and one wizard question. Both write `storage.homePath`.
5. Guard `config set storage.homePath` with a `docker volume inspect` check.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, `seedConfig()`, `runWizard()`, `runSandboxInstall()` | Build-mode selection, preflight, `--home-mount`, wizard prompt |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs()`, sandbox dispatch near line 1165, `printSandboxHelp()` | Flag parse, option pass-through, help text |
| `.agro/cli/src/cli.ts` | `ConfigArgs`, `parseConfigArgs()`, config dispatch near line 1063, `printConfigHelp()` | Override flag parse and help text |
| `.agro/cli/src/commands/config.ts` | `ConfigOptions`, `runConfigSet()` | Named-volume guard for `storage.homePath` |
| `.agro/cli/src/commands/lifecycle.ts` | `runSandbox()`, `DEFAULT_SANDBOX_IMAGE` | Existing image-ref resolution that US-001 reuses |
| `.agro/cli/src/lib/registry.ts` | `materialize()` | Compose base selection. No change expected |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars()` | Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`. No change expected |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install --repo <dir>` | Behavior change | Build mode requires `<dir>/.devcontainer/Dockerfile`. Other directories bind and run the published image |
| `agro sandbox install --home-mount <dir>` | New flag | Sets `storage.homePath` at create time |
| `agro sandbox install` wizard | New question | Asks for the home mount after the Docker socket question |
| `agro config set storage.homePath` | New guard | Refuses when `<name>_workspace` exists, unless the operator passes `<override flag>` |
| `agro config set <override flag>` | New flag | Overrides the named-volume guard |
| `agro sandbox --help`, `agro config --help` | Text change | Describe both mounts and the override flag |
| `docs/installation.md`, `docs/quickstart.md`, `docs/configuration.md` | Documentation | Describe `--repo`, `--home-mount`, and the orphaned-volume hazard |

## Storage

The entry file `~/.agro/sandboxes/<name>/agro.json` holds the state. This task adds no field. `--home-mount` writes the existing `storage.homePath` field. The detection result writes the existing `image.mode` field. Follow the existing `writeOhConfig()` path in `runSandboxInstall()`.

## Architectural Decisions

- **Source of truth for build mode:** the presence of `<repo>/.devcontainer/Dockerfile` decides the inferred mode. An explicit `image.mode` in a seed or in the existing entry still wins over the inference.
- **No new `--build` flag:** the CLI has no flag that sets `image.mode` to `build`. The preflight covers the seed and the existing-entry sources only.
- **Compose base:** `materialize()` keeps its `repo`-keyed selection. A non-checkout `--repo` keeps the build-capable base, because only that base carries the `/home/sandbox/harness` bind. `--home-mount` alone keeps the image-only base.
- **Image ref for a non-checkout bind:** `runSandboxInstall()` passes `image: true` to `runSandbox()`. `runSandbox()` resolves the ref as `image.ref`, then `DEFAULT_SANDBOX_IMAGE`. `image.ref` stays unset in `agro.json`, which matches the bare `--image` behavior at `.agro/cli/src/__tests__/sandbox.test.ts:254`.
- **Preflight order:** the Dockerfile check and the `--home-mount` existence check run before the wizard and before `mkdirSync(root)`. A refusal writes no entry.
- **Volume guard scope:** the guard compares the new value with the current value. An unchanged value skips the `docker` call. The guard inspects `<name>_workspace`, where `<name>` is the `name` field of the target `agro.json`.
- **Runner injection:** `ConfigOptions` gains `run?: LifecycleRunner`, so that tests stub `docker volume inspect`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` writes `image.mode: "image"`, renders `AGRO_REPO_DIR`, and sets `AGRO_SANDBOX_IMAGE` to the default ref | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir> --print-argv` shows `--no-build` and no `--build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Line 148 case with a `.devcontainer/Dockerfile` fixture still selects build mode | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seed `image.mode: "build"` without a Dockerfile returns 1, asks nothing, names `--repo`, the path, and `.devcontainer/Dockerfile`, and writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone renders `AGRO_HOME_MOUNT`, keeps image mode, and materializes the image-only base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` with a checkout `--repo` renders both keys and materializes the build-capable base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | A missing `--home-mount` directory returns 1 and writes no entry | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | The wizard asks seven questions in order | US-003 |
| `.agro/cli/src/__tests__/cli.property.test.ts` or `<parser test file>` | `parseSandboxArgs()` accepts `--home-mount <dir>` and rejects a missing value | US-003 |
| `.agro/cli/src/__tests__/config-secret.test.ts` (`oh config set` block) | Existing volume refuses, override writes, absent volume writes, other keys run no `docker` | US-004 |
| `.agro/cli/src/__tests__/docs.test.ts`, `.agro/cli/src/__tests__/cli-first-help.test.ts` | Help and docs cases stay green | US-005 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `.agro/evals/probes/oh-home-mount.sh`, `.agro/evals/probes/oh-image-only-deploy.sh` | Compose-string probes stay green | All stories |

Run the suite with `npx vitest run` from the repository root. Run the typecheck with `npm --prefix .agro/cli run typecheck`.

## Design Principles

- Follow the non-negotiables in `AGENTS.md`. The application agent implements in the sandbox. Tracked code gets no explanatory comments.
- Infer intent from repository state, not from the presence of a flag.
- Fail before the wizard and before any write. An error names the flag, the path, and the missing file.
- Put a create-time decision at create time. Guard the later door instead of removing it.
- Reuse `runSandbox()` image resolution. Add no second resolution path.

## Out of Scope

- UID and GID reconciliation for a non-checkout bind (`.devcontainer/entrypoint.sh:167-191`). The issue tracks this edge separately.
- The rename of `--repo` to `--checkout`. The issue tracks this rename separately.
- Changes to the compose files, the compose wrapper, or `materialize()`.
- A `--build` install flag.
- Public documentation in `mifunedev/agro-web`. Open question 4 covers this surface.

## Open Questions

1. What is the name of the override flag for `agro config set storage.homePath`? The plan uses `<override flag>`. The candidate `--force` matches `agro update --force`.
2. Must `--home-mount <dir>` exist before install? The plan requires the directory to exist, which matches `--repo`. Docker otherwise creates the missing directory as root.
3. Do later lifecycle verbs, such as `agro up` and `agro restart`, start a non-checkout `--repo` entry with the published image? Only `runSandboxInstall()` reads `image.mode`. A later verb can fall back to the image `sandbox-<name>`. Confirm the behavior, or add the verb to scope.
4. Does `mifunedev/agro-web` document `--repo` or `storage.homePath`? If the site documents either surface, open a matching change there.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `npx vitest run` exits 0 from the repository root.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh`, `bash .agro/evals/probes/oh-home-mount.sh`, and `bash .agro/evals/probes/oh-image-only-deploy.sh` each report PASS.
- [ ] The diff touches no file under `.devcontainer/`.
- [ ] The diff adds no explanatory comment to tracked code.

## Lessons

Filled by the advisor before undraft.
