# PRD: npm user global prefix

Status: DRAFT

## User Stories

### US-001: Set the npm global prefix in the sandbox image

**Description:** As an operator, I want the sandbox user's npm global prefix to equal `NPM_USER_PREFIX` so that `claude update` and `codex update` install into the home volume without `sudo`.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` after the `RUN npm install -g cc-safety-net@1.0.6` step.
- [ ] `.agro/cli/src/__tests__/harness-catalog.test.ts` asserts that the Dockerfile declares `NPM_CONFIG_PREFIX` from `NPM_USER_PREFIX`, and asserts that the declaration follows the `cc-safety-net` install line.
- [ ] `npm test` exits 0.
- [ ] In a container built from the changed image, `docker exec -u sandbox <container> npm config get prefix` prints `/home/sandbox/.local`.
- [ ] In the same container, `docker exec -u sandbox <container> test -x /usr/local/bin/cc-safety-net` exits 0.

### US-002: Export the npm global prefix from login shells

**Description:** As an SSH operator, I want login shells to export the same npm prefix so that a harness self-update works in each session type.

**Acceptance Criteria:**

- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the line that exports `NPM_USER_PREFIX`.
- [ ] `.agro/scripts/__tests__/provision-python.test.ts` or a sibling test asserts that `path-env.sh` exports `NPM_CONFIG_PREFIX`.
- [ ] In a container built from the changed image with a fresh home volume, `docker exec -u sandbox <container> bash -lc 'npm config get prefix'` prints `/home/sandbox/.local`.
- [ ] `npm test` exits 0.

### US-003: Prove the prefix in the sandbox boot smoke and document the update path

**Description:** As a maintainer, I want CI to fail on a sandbox npm prefix outside the home volume so that the self-update failure cannot return.

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-boot-smoke.sh` runs `npm config get prefix` as the `sandbox` user through `docker exec` and through `bash -lc`. The script exits 1 when either value differs from `${NPM_USER_PREFIX:-/home/sandbox/.local}`.
- [ ] `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` covers the pass case and the mismatch case of the new check.
- [ ] `docs/harnesses/claude-code.md` and `docs/harnesses/codex.md` state that `claude update` and `codex update` run as the `sandbox` user without `sudo`.
- [ ] `npm test` exits 0.

## Summary

Verified current state:

- `.devcontainer/Dockerfile:43` sets `ENV NPM_USER_PREFIX="/home/sandbox/.local"`. No file sets `NPM_CONFIG_PREFIX` or `npm_config_prefix`. The npm global prefix for every user stays at the Node image default `/usr/local`.
- `.agro/cli/src/lib/harnesses/catalog.ts` installs `claude-code`, `codex`, `pi`, and `opencode` with `npm --prefix {{prefix}} install -g <package>`. `SANDBOX_HARNESS_PREFIX` is `/home/sandbox/.local`.
- A harness self-update calls a bare `npm install -g`. That command writes to `/usr/local/lib/node_modules`, and the `sandbox` user cannot write there. The command exits with `EACCES`.
- `sudo` resets the environment and applies `secure_path`. `secure_path` excludes `/home/sandbox/.local/bin`, so `sudo claude update` does not find `claude`.
- `.devcontainer/agro-env-generator.sh` copies the PID 1 environment into the systemd manager environment. An image `ENV` therefore reaches `agro-cron.service` and detached cron fires.
- `agro shell` runs `docker exec -it -u sandbox <container> zsh`. That shell inherits the image `ENV`.
- A login shell (SSH or `su -`) resets the environment. The Dockerfile appends `.agro/install/path-env.sh` to `/home/sandbox/.profile` and `/home/sandbox/.zprofile` to restore `NPM_USER_PREFIX`, `PNPM_HOME`, and `PATH`.

Selected approach: set npm's own environment key `NPM_CONFIG_PREFIX` to `NPM_USER_PREFIX`. Set the key in the image, and export the key from `path-env.sh`. npm then resolves `-g` to `/home/sandbox/.local` for the `sandbox` user. A self-update lands in the home volume, and the update survives a container recreate. The explicit `--prefix` in the harness catalog stays unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, `RUN npm install -g cc-safety-net@1.0.6` | Receives the new `ENV NPM_CONFIG_PREFIX` after the image-baked global install. |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX` export | Receives the login-shell export of `NPM_CONFIG_PREFIX`. |
| `.devcontainer/agro-env-generator.sh` | PID 1 environment copy | Carries the image `ENV` to systemd services. No change. |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `SANDBOX_HARNESS_PREFIX`, `installArgv` | Defines the install prefix that the npm global prefix must match. No change. |
| `.agro/scripts/sandbox-boot-smoke.sh` | `verify_nothing_installed` and a new prefix check | Proves the prefix in a booted container in CI. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `DOCKERFILE` assertions | Asserts the Dockerfile declaration and its position. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment | Added variable | `NPM_CONFIG_PREFIX=/home/sandbox/.local` for `docker exec`, Herdr panes, systemd services, and login shells. |
| `npm install -g` as `sandbox` | Behavior change | Writes to `/home/sandbox/.local` instead of `/usr/local`. |
| `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md` | Documentation | States the update path without `sudo`. |

## Storage

The home volume holds each self-updated package under `/home/sandbox/.local/lib/node_modules` and each binary under `/home/sandbox/.local/bin`. This task adds no new storage location. The task follows the existing `NPM_USER_PREFIX` pattern.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of truth. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` in the Dockerfile and in `path-env.sh`.
- The environment variable wins over a file. The repository hooks deny access to `.npmrc` (`.agro/hooks/deny-secret-paths.sh`), and a file in the home volume does not reach an existing volume.
- The `ENV` line follows the `cc-safety-net` install. Otherwise the build installs `cc-safety-net` under `/home/sandbox/.local` in the `base` stage, and the `final` stage deletes `/home/sandbox`.
- `sudo` keeps the `/usr/local` prefix because `sudo` resets the environment. This task does not change `sudoers`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`; the declaration follows the `cc-safety-net` install | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` or a sibling test | `path-env.sh` exports `NPM_CONFIG_PREFIX` | US-002 |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | Prefix check passes on `/home/sandbox/.local`; prefix check fails on `/usr/local` | US-003 |
| `.github/workflows/sandbox-boot-guard.yml` | `bash .agro/scripts/sandbox-boot-smoke.sh` against the built image | US-001, US-002, US-003 in a real container |

## Design Principles

- Keep one source of truth: derive the npm prefix from `NPM_USER_PREFIX`.
- Keep agent work inside the sandbox: a harness updates itself as the `sandbox` user, with no `sudo`.
- Survive a recreate: every update lands in the home volume.
- Make the smallest change: add one variable in two places, plus the proof.
- Add no explanatory comments to tracked code.

Surface review:

- Host and sandbox: applied. The change is in the image and in the sandbox shell profile.
- Lifecycle door: not applicable. No `agro` verb changes. `agro harness install` keeps its explicit `--prefix`, and `agro update` keeps `--prefix <owning prefix>`.
- Canonical and provider surfaces: not applicable. No skill, hook, or symlink changes.
- Root and scaffold: applied. Initialized projects receive the change through the published image.
- Interactive and headless processes: applied. Herdr panes inherit the image `ENV`; systemd services receive the variable through `agro-env-generator.sh`.
- Local and remote operation: applied. Login shells over SSH receive the variable through `path-env.sh`.
- Parallel operation: not applicable. The prefix is shared by design, as the harness door already shares the prefix.
- Public documentation: applied for `docs/harnesses/`. The `mifunedev/agro-web` impact is an open question.
- Verification: applied. See the test plan.

## Out of Scope

- A change to `sudoers` or `secure_path`.
- A change to the harness catalog `installArgv` or `uninstallArgv`.
- A migration of packages that already sit under `/usr/local/lib/node_modules`.
- A change to `pnpm` global installs, which use `PNPM_HOME`.

## Open Questions

1. An existing home volume keeps the old `path-env.sh` copy in `/home/sandbox/.profile` and `/home/sandbox/.zprofile`. A login shell on that volume does not export `NPM_CONFIG_PREFIX`. Choose one:
   - A. Accept the gap. `docker exec` shells, Herdr panes, and systemd services receive the image `ENV`.
   - B. Extend `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` to append the missing export on boot.
2. `docker exec -u root <container> npm install -g <package>` inherits the image `ENV` and writes root-owned files under `/home/sandbox/.local`. The entrypoint repairs ownership on the next boot. Confirm that this behavior is acceptable, or name `<alternative>`.
3. Confirm whether `mifunedev/agro-web` publishes `docs/harnesses/` content with a dependency on this change. If `mifunedev/agro-web` publishes such content, name `<agro-web path>`.

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `bash .agro/scripts/sandbox-boot-smoke.sh` exits 0 against the changed image.
- [ ] In the changed image, `docker exec -u sandbox <container> npm install -g <small package>` exits 0 and writes `/home/sandbox/.local/lib/node_modules/<small package>`.
- [ ] After `agro destroy <name>` without volume deletion and a new `agro shell <name>`, the package from the previous check stays under `/home/sandbox/.local/lib/node_modules`.
- [ ] `git grep -n NPM_CONFIG_PREFIX` lists `.devcontainer/Dockerfile` and `.agro/install/path-env.sh`.

## Lessons

Filled by the advisor before undraft.
