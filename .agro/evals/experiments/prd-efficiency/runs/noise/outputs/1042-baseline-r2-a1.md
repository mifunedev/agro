# PRD: Separate the checkout bind from the home mount in `agro sandbox install`

Status: DRAFT

Source: `work/issue-1042.md`.

## User Stories

### US-001: Select build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only for a harness checkout so that an empty host directory runs the published image.

**Acceptance Criteria:**

- [ ] `seedConfig()` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` only when the seed sets no mode and `existsSync(join(repo, ".devcontainer", "Dockerfile"))` returns `true`.
- [ ] A test runs `runSandboxInstall` with `--repo <empty dir>` and `yes: true`. The test asserts that `agro.json` holds `image.mode: "image"` and `repo: <empty dir>`.
- [ ] The same test asserts that the rendered `--extra-env-file` contains `AGRO_REPO_DIR=<empty dir>`.
- [ ] A test runs `runSandboxInstall` with `--repo <empty dir>` and `printArgv: true`. The printed argv contains `--no-build` and does not contain `--build`.
- [ ] The test at `.agro/cli/src/__tests__/sandbox.test.ts:148` writes `.devcontainer/Dockerfile` into its checkout fixture and still asserts `image: { mode: "build" }` and the build compose base.
- [ ] `pnpm test` exits 0.

### US-002: Refuse build mode without a Dockerfile before the wizard

**Description:** As an operator, I want an early exit when build mode has no Dockerfile so that `agro` names the flag and the path, not buildx.

**Acceptance Criteria:**

- [ ] When the effective `image.mode` is `build`, `repo` is set, and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall` returns 1.
- [ ] The error on stderr contains the string `--repo`, the resolved repo path, and the string `.devcontainer/Dockerfile`.
- [ ] The check runs before `runWizard`. A test with an `io.ask` stub asserts that the stub receives no question.
- [ ] The check runs before `mkdirSync(root)`. A test asserts that `<registry>/<name>` does not exist after the refusal.
- [ ] The test fixture sets `image.mode: "build"` through `<repo>/agro.json`.
- [ ] `--image=<ref>` sets `image.mode` to `image` before the check. A test with `image.mode: "build"` in the seed, no Dockerfile, and `--image=<ref>` returns 0.
- [ ] `pnpm test` exits 0.

### US-003: Add `--home-mount <dir>` to `agro sandbox install`

**Description:** As an operator, I want an install flag and a wizard prompt that set `storage.homePath` so that I choose the `/home/sandbox` host path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs` in `.agro/cli/src/cli.ts` accepts `--home-mount <dir>`. A missing value returns the error `sandbox install: --home-mount requires a value`.
- [ ] `runSandboxInstall` resolves the value to an absolute path and writes the path to `storage.homePath` in `agro.json`.
- [ ] A test with `--home-mount <dir>` asserts that the rendered env contains `AGRO_HOME_MOUNT=<dir>`, that `agro.json` holds `image.mode: "image"`, and that `.devcontainer/docker-compose.yml` in the entry does not contain `/home/sandbox/harness`.
- [ ] A test with `--home-mount <dir>` and `--repo <checkout with .devcontainer/Dockerfile>` asserts that the rendered env contains both `AGRO_HOME_MOUNT=<dir>` and `AGRO_REPO_DIR=<checkout>`, and that the entry compose base contains `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}:/home/sandbox/harness`.
- [ ] The wizard asks one new question that contains the string `/home/sandbox`. The default answer is blank, and a blank answer leaves `storage.homePath` unset.
- [ ] The wizard tests at `.agro/cli/src/__tests__/sandbox.test.ts:509` and `:531` expect the new question count and the new question order.
- [ ] `pnpm test` exits 0.

### US-004: Guard `agro config set storage.homePath` against an existing volume

**Description:** As an operator, I want `config set storage.homePath` to refuse on an existing volume so that a mount swap never orphans my state silently.

**Acceptance Criteria:**

- [ ] `runConfigSet` accepts an injected `run: LifecycleRunner`, in the same pattern as `RepoOptions`.
- [ ] For the key `storage.homePath` and a non-empty value that differs from the current value, `runConfigSet` runs `docker volume inspect <name>_workspace`. `<name>` is the configured container name of the target root.
- [ ] When `docker volume inspect` exits 0 and the operator does not pass `--orphan-volume`, `runConfigSet` returns 1 and writes nothing to `agro.json`.
- [ ] The refusal message names the volume `<name>_workspace`, states that the volume state becomes orphaned, and names `--orphan-volume`.
- [ ] With `--orphan-volume`, `runConfigSet` writes `storage.homePath` and returns 0.
- [ ] When `docker volume inspect` exits non-zero, `runConfigSet` writes `storage.homePath` and returns 0.
- [ ] `parseConfigArgs` accepts `--orphan-volume` only for `config set`.
- [ ] Tests in `.agro/cli/src/__tests__/config-secret.test.ts` or a new `config-set.test.ts` cover the four cases above with a stub runner.
- [ ] `pnpm test` exits 0.

### US-005: Update help text and documentation

**Description:** As an operator, I want the help text and the docs to state what each mount does so that I choose the correct flag.

**Acceptance Criteria:**

- [ ] `printSandboxHelp` in `.agro/cli/src/cli.ts` lists `--home-mount <dir>` in the usage line and in the flag table.
- [ ] `printSandboxHelp` states that `--repo` selects build mode only when `<dir>/.devcontainer/Dockerfile` exists.
- [ ] `printConfigHelp` lists `--orphan-volume` for `config set`.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path, and that build mode requires a harness checkout at that path.
- [ ] The `storage.homePath` row in `docs/configuration.md` names `--home-mount` as the create-time door and states the orphaned-volume hazard of a later `config set`.
- [ ] The `repo` row in `docs/configuration.md` no longer states that `repo` alone selects build mode.
- [ ] `pnpm test` exits 0, including `.agro/cli/src/__tests__/docs.test.ts` and `.agro/cli/src/__tests__/cli-first-help.test.ts`.

## Summary

Verified current state:

- `seedConfig()` sets `image.mode` to `build` whenever `repo` is set and the seed sets no mode (`.agro/cli/src/commands/sandbox.ts:118-121`).
- The only `--repo` preflight is an existence check (`.agro/cli/src/commands/sandbox.ts:196-200`).
- `runSandboxInstall` writes the entry with `mkdirSync(root)` after the wizard, before `runSandbox`.
- `materialize()` selects the build compose base when `opts.repo` is set, and the image-only base otherwise (`.agro/cli/src/lib/registry.ts:95-101`).
- `renderComposeVars` renders `AGRO_HOME_MOUNT` from `storage.homePath` and `AGRO_REPO_DIR` from `repo` (`.agro/cli/src/lib/config-render.ts:40-41`).
- Both compose bases bind `${AGRO_HOME_MOUNT:-...workspace}` at `/home/sandbox`. Only `docker-compose.yml` binds `AGRO_REPO_DIR` at `/home/sandbox/harness`.
- The entrypoint seeds the control plane into `/home/sandbox/harness` when that path holds no control directory (`.devcontainer/entrypoint.sh:159-196`).
- `readOhConfig` rejects a relative `storage.homePath` and a reserved path (`.agro/cli/src/lib/oh-config.ts:194-207`).
- `runConfigSet` takes no runner and runs no docker command today (`.agro/cli/src/commands/config.ts:43`).
- The test at `.agro/cli/src/__tests__/sandbox.test.ts:148` uses an empty `mkdtemp` directory as the checkout and expects `image.mode: "build"`. US-001 breaks that test unless the fixture gains `.devcontainer/Dockerfile`.

Selected approach: keep `repo` as the bind source. Derive build mode from the checkout contents. Add one preflight before the wizard. Add `--home-mount` as the create-time door to `storage.homePath`. Guard the late door in `config set`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Build-mode inference, preflight, `--home-mount`, wizard prompt |
| `.agro/cli/src/cli.ts` | `parseSandboxArgs`, `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `printSandboxHelp`, `parseConfigArgs`, `ConfigArgs`, `printConfigHelp`, the `runSandboxInstall` and `runConfigSet` call sites | Flag parsing and help text |
| `.agro/cli/src/commands/config.ts` | `runConfigSet`, `ConfigOptions` | Volume guard for `storage.homePath` |
| `.agro/cli/src/commands/lifecycle.ts` | `configuredContainerName`, `namedVolumes` | Source of the volume name `<name>_workspace` |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection; no change expected |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Env rendering; no change expected |
| `.agro/cli/src/__tests__/sandbox.test.ts` | install, wizard, and re-install suites | Coverage for US-001 to US-003 |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install --home-mount <dir>` | New flag | Sets `storage.homePath` at create time |
| `agro sandbox install --repo <dir>` | Behavior change | Selects build mode only when `<dir>/.devcontainer/Dockerfile` exists |
| `agro sandbox install` preflight | New error | Exits 1 before the wizard when build mode has no Dockerfile |
| `agro sandbox install` wizard | New prompt | Asks for the `/home/sandbox` host path; blank keeps the named volume |
| `agro config set storage.homePath <dir> --orphan-volume` | New guard and flag | Refuses when `<name>_workspace` exists, unless the operator passes `--orphan-volume` |
| `agro sandbox --help`, `agro config --help` | Text change | Documents the new flags and the build-mode rule |
| `docs/installation.md`, `docs/quickstart.md`, `docs/configuration.md` | Text change | Documents both mounts and the hazard |

## Storage

The change writes no new field. `storage.homePath`, `repo`, and `image.mode` already exist in `agro.json` under `~/.agro/sandboxes/<name>/`. The preflight writes no file. The volume guard reads docker state and writes `agro.json` only after the guard passes.

## Architectural Decisions

- `repo` stays the single source for the `/home/sandbox/harness` bind. `storage.homePath` stays the single source for the `/home/sandbox` bind.
- The presence of `<repo>/.devcontainer/Dockerfile` decides the inferred build mode. An explicit `image.mode` in a seed still wins over the inference.
- The preflight runs on the effective mode after the `--image=<ref>` override. The implementation moves the `--image=<ref>` override ahead of the preflight and the wizard. The wizard does not change `image`.
- `--home-mount` does not set `repo`, so `materialize()` keeps the image-only base.
- The guard lives in `runConfigSet`, not in `setConfigField`, because the guard needs docker access and a sandbox name.
- The CLI resolves `--home-mount` to an absolute path with `resolve()`, the same way the CLI resolves `--repo`. `readOhConfig` keeps its reserved-path check.

Surface review:

- Host and sandbox: applied. All changes run on the host CLI.
- Lifecycle door: applied. `sandbox install` and `config set` change. `up`, `stop`, and `destroy` do not change.
- Canonical and provider surfaces: not applicable. No skill or hook changes.
- Root and scaffold: applied. The CLI ships to initialized projects through the package.
- Interactive and headless processes: not applicable. No persistent process.
- Local and remote operation: applied. The guard runs `docker` on the host that runs the CLI.
- Parallel operation: not applicable. No shared mutable state is added.
- Public documentation: applied. `mifunedev/agro-web` needs a matching change for `--home-mount`. See Open Questions.
- Verification: applied. See Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` gives `image.mode: "image"` and `AGRO_REPO_DIR` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir> --print-argv` has `--no-build` and no `--build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | line 148 fixture gains `.devcontainer/Dockerfile`; build base stays | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | seed `image.mode: "build"` without Dockerfile exits 1, asks nothing, writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | seed `image.mode: "build"` without Dockerfile plus `--image=<ref>` exits 0 | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone: `AGRO_HOME_MOUNT`, image mode, image-only base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` with `--repo <checkout>`: both keys, build base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | wizard question count and order include the home-mount question | US-003 |
| `.agro/cli/src/__tests__/cli.property.test.ts` | `parseSandboxArgs` accepts `--home-mount <dir>` and rejects a missing value | US-003 |
| `.agro/cli/src/__tests__/config-set.test.ts` (new) | volume exists and no override: exit 1, file unchanged | US-004 |
| `.agro/cli/src/__tests__/config-set.test.ts` (new) | volume exists and override: exit 0, file written | US-004 |
| `.agro/cli/src/__tests__/config-set.test.ts` (new) | volume absent: exit 0, file written | US-004 |
| `.agro/cli/src/__tests__/docs.test.ts`, `cli-first-help.test.ts` | help and docs stay consistent | US-005 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `oh-home-mount.sh`, `oh-image-only-deploy.sh` | compose strings stay unchanged | Regression floor |

Commands: `pnpm test` and `pnpm run typecheck` from the repository root. Run each probe with `bash .agro/evals/probes/<probe>.sh`.

## Design Principles

- Keep one source of truth for each mount: `repo` for the checkout bind, `storage.homePath` for the home bind.
- Fail before the wizard, before any write, and in `agro`, not in Docker.
- Put a create-time decision at create time. Guard the late door, and do not remove the late door.
- Add no comments to tracked code (`AGENTS.md`, principle 5).
- Change no compose file and no entrypoint.

## Out of Scope

- The rename of `--repo` to `--checkout`. A separate issue tracks the rename.
- UID and GID reconciliation for the empty-bind path in `.devcontainer/entrypoint.sh:167-191`.
- A new explicit `--build` install flag. The issue mentions "an explicit flag", and no such flag exists today.
- A guard for `config set storage.homePath ""`, which moves state from a host bind back to the named volume.
- Cleanup of a registry entry after a failure in `runSandbox`. The issue scopes the no-entry rule to the preflight.

## Open Questions

1. Confirm the override flag name `--orphan-volume` for `config set storage.homePath`. The plan selects this name, because the name states the consequence. The existing `--force` belongs to `agro update`.
2. When `docker volume inspect` cannot run (for example, `docker` is not on `PATH`), does the guard refuse or proceed? This plan proceeds, because no volume can exist without Docker on the host.
3. A registry entry written by the current bug holds `image.mode: "build"` and an empty `repo`. A re-install with the same name inherits that mode and hits the new preflight. Does the preflight message tell the operator to run `agro config set --sandbox <name> image.mode image`, or does the install ignore an entry-inherited `build` mode when the Dockerfile is absent? This plan uses the message.
4. Does the issue's "explicit flag" for build mode refer to a planned flag? This plan treats only an `agro.json` seed as explicit.
5. Does `mifunedev/agro-web` document `agro sandbox install` flags? If so, who opens the matching change?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh`, `bash .agro/evals/probes/oh-home-mount.sh`, and `bash .agro/evals/probes/oh-image-only-deploy.sh` each report PASS.
- [ ] `git diff --stat` shows no change under `.devcontainer/`.
- [ ] The diff adds no code comment.

## Lessons

Filled by the advisor before undraft.
