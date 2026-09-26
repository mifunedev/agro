# PRD: Separate the checkout bind from the home mount in `agro sandbox install`

Status: DRAFT

Source: `work/issue-1042.md` (issue 1042).

## User Stories

### US-001: Infer build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only for a harness checkout, so that an empty directory runs the published image.

**Acceptance Criteria:**

- [ ] With `--repo <empty dir>` and no seed `image.mode`, the entry `agro.json` holds `image.mode: "image"` and `repo: <empty dir>`.
- [ ] With `--repo <empty dir>`, the rendered compose env holds `AGRO_REPO_DIR=<empty dir>`.
- [ ] With `--repo <empty dir> --print-argv`, the printed argv contains `--no-build` and does not contain `--build`.
- [ ] With `--repo <empty dir>`, the install passes the published image ref to the compose run. `AGRO_SANDBOX_IMAGE` resolves to `image.ref` or to `DEFAULT_SANDBOX_IMAGE`, not to `sandbox-<name>`.
- [ ] With `--repo <dir>` and `<dir>/.devcontainer/Dockerfile` present, the entry holds `image.mode: "build"` and the base compose file binds `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}:/home/sandbox/harness`.
- [ ] `npm test` exits 0.

### US-002: Refuse a build without a Dockerfile before the wizard

**Description:** As an operator, I want a build without a Dockerfile to fail early, so that the error names my flag.

**Acceptance Criteria:**

- [ ] If the resolved `image.mode` is `build`, `--repo <dir>` is set, `<dir>/.devcontainer/Dockerfile` is absent, and no `--image`, `--image=<ref>`, or `--no-build` flag is set, the install exits 1.
- [ ] The refusal message names `--repo`, the resolved path, the missing file `.devcontainer/Dockerfile`, and `--image` as the remedy.
- [ ] The refusal happens before the first wizard question: the test `ask` function records zero questions.
- [ ] After the refusal, the registry directory holds no entry for the sandbox name.
- [ ] The runner records zero `bash` calls after the refusal.

### US-003: Add `--home-mount <dir>` to `agro sandbox install`

**Description:** As an operator, I want a create-time flag and a wizard prompt for `storage.homePath`, so that I persist `/home/sandbox` at a host path.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs` accepts `--home-mount <dir>` and returns the value. A missing value exits with `--home-mount requires a value`.
- [ ] `--home-mount <dir>` writes `storage.homePath: <absolute dir>` to the entry `agro.json`.
- [ ] `--home-mount <dir>` alone renders `AGRO_HOME_MOUNT=<dir>`, keeps `image.mode: "image"`, and writes the image-only compose base.
- [ ] `--home-mount <dir>` with `--repo <checkout>` renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`, and writes the build-capable compose base.
- [ ] The wizard asks seven questions. The seventh question contains `Home mount`, and its default shows `blank`.
- [ ] A blank answer to the home-mount question leaves `storage.homePath` unset.
- [ ] A relative `--home-mount` value resolves to an absolute path before the install writes the entry.

### US-004: Guard `agro config set storage.homePath`

**Description:** As an operator, I want `config set storage.homePath` to refuse when the sandbox volume exists, so that a late mount change does not orphan my data.

**Acceptance Criteria:**

- [ ] If `docker volume inspect <name>_workspace` exits 0, `agro config set storage.homePath <dir>` exits 1 and leaves `agro.json` unchanged.
- [ ] The refusal message names the volume `<name>_workspace`, states that the volume state becomes orphaned, and names the override flag `<override flag>`.
- [ ] With the override flag, the same command exits 0 and writes `storage.homePath`.
- [ ] If `docker volume inspect <name>_workspace` exits non-zero, the command exits 0 and writes `storage.homePath`.
- [ ] `agro config set <other field>` runs no `docker` command.
- [ ] `parseConfigArgs` accepts the override flag only on `config set`.

### US-005: Update the help text and the documentation

**Description:** As an operator, I want the help text and the docs to explain `--repo` and `--home-mount`, so that I pick the right flag.

**Acceptance Criteria:**

- [ ] `agro sandbox --help` lists `--home-mount <dir>` and states that `--repo` selects build mode only when the path holds `.devcontainer/Dockerfile`.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path and that build mode needs a harness checkout at that path.
- [ ] `docs/configuration.md` documents `--home-mount` as the create-time door to `storage.homePath` and states the orphaned-volume hazard of a later `config set`.
- [ ] `docs/configuration.md` states the new `repo` rule: the field alone does not select build mode.
- [ ] `npm test` exits 0, including `.agro/cli/src/__tests__/docs.test.ts`.

## Summary

Verified current state:

- `seedConfig()` sets `image.mode` to `build` when `config.repo` is set and no seed sets a mode (`.agro/cli/src/commands/sandbox.ts:123-126`).
- The install checks only that the `--repo` path exists (`.agro/cli/src/commands/sandbox.ts:197-201`). The check does not read the directory contents.
- `materialize()` writes the build-capable compose base when `repo` is set, and the image-only base otherwise (`.agro/cli/src/lib/registry.ts`).
- The build-capable base sets `image: ${AGRO_SANDBOX_IMAGE:-${OH_SANDBOX_IMAGE:-sandbox-${SANDBOX_NAME:-agro}}}` with `pull_policy: missing` (`.devcontainer/docker-compose.yml:5-6`). If the install sets image mode with the build-capable base and passes no image ref, Compose tries to pull `sandbox-<name>`. US-001 closes this gap: the install passes `image: true` to `runSandbox`, which resolves the ref from `--image=<ref>`, then `image.ref`, then `DEFAULT_SANDBOX_IMAGE` (`.agro/cli/src/commands/lifecycle.ts:163-167`).
- `renderComposeVars()` already renders `AGRO_HOME_MOUNT` from `storage.homePath` (`.agro/cli/src/lib/config-render.ts:40`).
- `validateOhConfig` rejects a relative `storage.homePath` and a reserved path (`.agro/cli/src/lib/oh-config.ts:192-207`).
- The Compose project name is `${SANDBOX_NAME:-agro}` and the named volume key is `workspace` (`.devcontainer/docker-compose.yml:1`, `.devcontainer/docker-compose.yml:46`). The volume name is `<name>_workspace`.
- `runConfigSet` has no runner parameter today (`.agro/cli/src/commands/config.ts`). US-004 adds `run?: LifecycleRunner` to `ConfigOptions`.
- `defaultOhConfig()` sets `image.mode: "build"` (`.agro/cli/src/lib/oh-config.ts:133`). `seedConfig()` replaces that default unless a seed sets a mode.
- The entrypoint seeds an empty bind at `/home/sandbox/harness` from the image (`.devcontainer/entrypoint.sh:159-196`). No entrypoint change is needed.

Selected approach: change only the CLI. Keep the compose files, the entrypoint, and the probes unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Mode inference, preflight, `--home-mount`, wizard prompt, image ref pass-through |
| `.agro/cli/src/cli.ts` | `parseSandboxArgs`, `SANDBOX_VALUE_FLAGS`, `SandboxArgs`, `printSandboxHelp`, `parseConfigArgs`, `printConfigHelp` | Flag parsing and help text |
| `.agro/cli/src/commands/config.ts` | `runConfigSet`, `ConfigOptions` | Volume guard for `storage.homePath` |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection. No change expected. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`. No change expected. |
| `.agro/cli/src/commands/lifecycle.ts` | `runSandbox` | Resolves the image ref when `image: true`. No change expected. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install --repo <dir>` | Behavior change | Build mode needs `<dir>/.devcontainer/Dockerfile`. Otherwise the install binds `<dir>` and runs the published image. |
| `agro sandbox install --home-mount <dir>` | New flag | Sets `storage.homePath` at create time. |
| Install wizard | New prompt | Seventh question: the home-mount host path. The default is blank, which keeps the named volume. |
| `agro config set storage.homePath` | New guard | Refuses when `<name>_workspace` exists, unless the operator passes `<override flag>`. |
| `agro sandbox --help`, `agro config --help` | Text change | Documents `--home-mount`, the new `--repo` rule, and the override flag. |
| `docs/installation.md`, `docs/quickstart.md`, `docs/configuration.md` | Docs change | See US-005. |

## Storage

The change adds no new store. The install writes `storage.homePath` into the existing entry file `agro.json` under the registry root. The `writeOhConfig` pattern in `.agro/cli/src/lib/oh-config.ts` stays the only writer.

## Architectural Decisions

- **Source of truth for build mode:** the file `<repo>/.devcontainer/Dockerfile` decides the inferred mode. A seed `image.mode` from the repo `agro.json` or from the existing entry still wins over the inference.
- **Preflight order:** the install resolves the mode and runs the Dockerfile check before the wizard and before `mkdirSync(root)`. The wizard does not change `image.mode`, so the check stays valid after the wizard.
- **Compose base:** `repo` alone selects the build-capable base, as today. `--home-mount` never selects a base.
- **Volume check location:** `runConfigSet` calls `docker volume inspect <name>_workspace` through the injected runner. `<name>` comes from the target root `agro.json`, with `agro` as the fallback. That fallback matches `${SANDBOX_NAME:-agro}`.
- **Affected surfaces:**

| Surface | Mark |
|---|---|
| Host and sandbox | Applied: all changes are CLI code on the host path. The install runs on the host. |
| Lifecycle door | Applied: `sandbox install` and `config set` change. Other verbs stay unchanged. |
| Canonical and provider surfaces | Not applicable: no skill, hook, or mirror changes. |
| Root and scaffold | Applied to the published CLI. Scaffolded projects get the change through the CLI. |
| Interactive and headless processes | Not applicable: no persistent process. |
| Local and remote operation | Applied: the preflight runs before any Docker call, so a remote host gets the same error. |
| Parallel operation | Not applicable: no shared mutable state beyond the per-name registry entry. |
| Public documentation | Open: see Open Questions. |
| Verification | Applied: see Test Plan. |

## Test Plan (TDD)

Write each failing test first. Run `npm test` from the repository root. Run `npm run typecheck` from `.agro/cli/`.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | Update the case at line 148: create `<checkout>/.devcontainer/Dockerfile` in the fixture, then expect `image.mode: "build"` | US-001: a real checkout keeps build mode |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` gives `image.mode: "image"`, renders `AGRO_REPO_DIR`, and passes `--no-build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` passes a `SANDBOX_IMAGE` env to the wrapper call | US-001: image ref pass-through |
| `.agro/cli/src/__tests__/sandbox.test.ts` | seed `image.mode: "build"` and no Dockerfile: exit 1, zero questions, no entry, zero `bash` calls | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | seed `image.mode: "build"`, no Dockerfile, and `--image`: exit 0 | US-002: remedy works |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone; `--home-mount` with `--repo <checkout>` | US-003: rendered keys and compose base |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Update the wizard case at line 509 to seven questions; add a blank-answer case | US-003: wizard prompt |
| `.agro/cli/src/__tests__/config-secret.test.ts` | parse `--home-mount` and the override flag; volume present refuses; override proceeds; volume absent proceeds; other fields run no `docker` | US-003, US-004 |
| `.agro/cli/src/__tests__/docs.test.ts` | Existing cases | US-005 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `.agro/evals/probes/oh-home-mount.sh`, `.agro/evals/probes/oh-image-only-deploy.sh` | Existing probes, run with `bash <probe>` | Compose strings stay unchanged |

## Design Principles

- Keep the change in the CLI. The compose files and the entrypoint already support an arbitrary bind.
- Fail before side effects. The preflight runs before the wizard, the registry write, and the Docker call.
- Name the cause in the error: the flag, the path, and the missing file.
- Put a create-time decision at create time. `--home-mount` is the create-time door. `config set` refuses by default.
- Add no code comments. Express intent through names and tests.

## Out of Scope

- UID and GID reconciliation for an empty bind (`.devcontainer/entrypoint.sh:167-191`). The issue tracks this edge separately.
- The rename of `--repo` to `--checkout`.
- A new explicit build flag. The only explicit build source today is a seed `image.mode`.
- Removal of a registry entry after a failure in `docker compose up`. This task covers only a preflight failure.
- A wizard answer that clears a preserved `storage.homePath`.
- A guard on `agro config set storage.homePath ""` against an existing host bind.

## Open Questions

1. What is the name of the override flag for `config set storage.homePath`? The plan uses `<override flag>`. The existing `--force` flag on `agro update` is one candidate.
2. What does `config set storage.homePath` do if the `docker` command is absent or cannot reach the daemon? The plan treats a non-zero exit as "volume absent". An inside-sandbox `config set` has no Docker socket by default, so that path skips the guard.
3. Must `--home-mount <dir>` exist on the host before the install? Docker creates a missing bind source as a root-owned directory. The plan does not add an existence check.
4. An entry left by an earlier `--repo <empty dir>` install holds `image.mode: "build"`. A rerun with the same name fails the preflight. Does the preflight treat a mode from the existing entry as a seed, or does the install infer the mode again? The plan treats the mode as a seed and names `--image` as the remedy.
5. Does `mifunedev/agro-web` mirror `docs/installation.md`, `docs/quickstart.md`, or `docs/configuration.md`? If `agro-web` mirrors a changed page, the docs change needs a matching change there.

## Acceptance Criteria

- [ ] `agro sandbox install docker --repo <empty dir> --name <name> --yes --print-argv` prints an argv with `--no-build` and without `--build`.
- [ ] A seed `image.mode: "build"` with a repo that lacks `.devcontainer/Dockerfile` exits 1 with the guidance message and creates no registry entry.
- [ ] `--home-mount <dir>` renders `AGRO_HOME_MOUNT=<dir>`, keeps `image.mode: "image"`, and selects the image-only compose base.
- [ ] `--home-mount <dir>` with `--repo <checkout>` renders both keys and selects the build-capable compose base.
- [ ] `agro config set storage.homePath <dir>` refuses when `<name>_workspace` exists, and proceeds with `<override flag>`.
- [ ] `npm test` exits 0 from the repository root.
- [ ] `npm run typecheck` exits 0 from `.agro/cli/`.
- [ ] Each of the three compose-string probes exits 0.

## Lessons

Filled by the advisor before undraft.
