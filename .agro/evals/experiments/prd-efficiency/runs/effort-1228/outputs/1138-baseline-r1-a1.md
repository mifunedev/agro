# PRD: Point the sandbox npm global prefix at the home volume

Status: DRAFT

## User Stories

### US-001: Set the npm global prefix in the image environment

**Description:** As an operator, I want npm's global prefix for the `sandbox` user to equal `NPM_USER_PREFIX` so that `claude update` and `codex update` succeed without sudo.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`.
- [ ] The `ENV NPM_CONFIG_PREFIX` line comes after the root `RUN npm install -g cc-safety-net@1.0.6` step and after the `/opt/agro` build step.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the `NPM_USER_PREFIX` export.
- [ ] A red test in `.agro/cli/src/__tests__/harness-catalog.test.ts` fails before the Dockerfile change and passes after the change.
- [ ] A test in `.agro/scripts/__tests__/provision-python.test.ts` asserts the new `path-env.sh` export.
- [ ] `pnpm test` in `.agro/cli` exits 0.

### US-002: Add the export to existing home-volume profiles

**Description:** As an operator with an old home volume, I want the entrypoint to add the npm prefix export so that a recreate fixes it.

**Acceptance Criteria:**

- [ ] `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` appends the `NPM_CONFIG_PREFIX` export to `/home/sandbox/.profile` and `/home/sandbox/.zprofile` when the file lacks the export.
- [ ] The function leaves a file unchanged when the file already holds the export.
- [ ] The function keeps the file owner as the `sandbox` user.
- [ ] A test asserts the append behavior and the no-duplicate behavior against a temporary profile file.

### US-003: Prove the prefix in a built image

**Description:** As a maintainer, I want the image verifier to check the npm global prefix so that a regression fails before release.

**Acceptance Criteria:**

- [ ] `.agro/scripts/verify-sandbox-image.sh` runs `npm config get prefix` as the `sandbox` user in a login shell.
- [ ] The check reports `ok` when the output equals `/home/sandbox/.local`, and reports `fail` for any other output.
- [ ] In the built image, `npm install -g <small package>` as the `sandbox` user exits 0 without sudo, and the package binary lands in `/home/sandbox/.local/bin`.
- [ ] `command -v cc-safety-net` in the built image resolves under `/usr/local/bin`.

## Summary

Issue `work/issue-1138.md` reports that `claude update` and `codex update` fail in the sandbox with `EACCES` on `/usr/local/lib/node_modules`.

Verified current state:

- `.devcontainer/Dockerfile:43` sets `ENV NPM_USER_PREFIX="/home/sandbox/.local"`. Line 44 puts `$NPM_USER_PREFIX/bin` on `PATH`.
- `.agro/cli/src/lib/harnesses/catalog.ts:25` sets `SANDBOX_HARNESS_PREFIX = "/home/sandbox/.local"`. Each npm harness entry passes `npm --prefix {{prefix}} install -g`.
- No file sets `NPM_CONFIG_PREFIX` or writes a `prefix` key to an `.npmrc`. npm keeps the default global prefix `/usr/local` from the `node:22-trixie-slim` base image.
- A harness self-update calls a bare `npm install -g`. The `sandbox` user cannot write `/usr/local`.
- `.devcontainer/Dockerfile:48` installs `cc-safety-net@1.0.6` as root into `/usr/local`. `docs/security-considerations.md:96` requires that binary in the image.
- `.agro/install/path-env.sh` goes into `/home/sandbox/.profile` and `/home/sandbox/.zprofile` at image build. The home volume keeps these files across a recreate.
- `.devcontainer/entrypoint.sh:41` defines `reconcile_shell_env_exports`. The function rewrites old `NPM_USER_PREFIX` and `PNPM_HOME` exports on each boot.

Selected approach: set `NPM_CONFIG_PREFIX` to `NPM_USER_PREFIX` in three places. The Dockerfile `ENV` covers `docker exec` sessions. The `path-env.sh` export covers login shells that reset the environment. The entrypoint reconcile step covers home volumes that an older image created. npm reads `NPM_CONFIG_PREFIX` as the global prefix, so a bare `npm install -g` lands in `/home/sandbox/.local`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, `RUN npm install -g cc-safety-net@1.0.6`, `/opt/agro` build | Holds the new `ENV NPM_CONFIG_PREFIX` line after the root npm steps |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX` export | Holds the new login-shell export |
| `.devcontainer/entrypoint.sh` | `reconcile_shell_env_exports` | Appends the export to existing home-volume profiles |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `SANDBOX_HARNESS_PREFIX`, `HARNESS_PREFIX_TOKEN` | Install prefix that the new npm prefix must equal; no change |
| `.agro/scripts/verify-sandbox-image.sh` | `run`, `ok`, `fail` | Built-image check for the npm prefix |
| `.agro/evals/probes/harness-one-door.sh` | `PREFIX` parse of `ENV NPM_USER_PREFIX` | Must stay PASS; no change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment variable `NPM_CONFIG_PREFIX` | Added | Equals `NPM_USER_PREFIX` for the `sandbox` user |
| `npm install -g` as the `sandbox` user | Behavior change | Installs into `/home/sandbox/.local` instead of `/usr/local` |
| `/home/sandbox/.profile`, `/home/sandbox/.zprofile` | Modified at boot | The entrypoint appends one export line when the line is missing |

## Storage

The home volume stores the npm global tree at `/home/sandbox/.local/lib/node_modules` and the binaries at `/home/sandbox/.local/bin`. `agro harness install` already uses this location. No schema change applies.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of truth. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` in each place.
- Use the environment variable, not an `.npmrc` file. `.agro/hooks/deny-secret-paths.sh` and `.claude/settings.json` deny agent access to `.npmrc`.
- Root image steps keep `/usr/local`. The `ENV` line comes after the last root `npm install -g` step, so `cc-safety-net` stays in the image layer.
- `sudo` resets the environment. A root `npm install -g` through `sudo` keeps `/usr/local`, and this task does not change that path.
- The harness catalog keeps its explicit `npm --prefix` arguments.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` after the `cc-safety-net` step | US-001 image environment and step order |
| `.agro/scripts/__tests__/provision-python.test.ts` | `path-env.sh` exports `NPM_CONFIG_PREFIX` from `NPM_USER_PREFIX` | US-001 login-shell export |
| `<entrypoint test file>` | `reconcile_shell_env_exports` appends the export once and keeps an existing export | US-002 |
| `.agro/scripts/verify-sandbox-image.sh` | `npm config get prefix` as `sandbox` equals `/home/sandbox/.local` | US-003 built image |
| `.agro/evals/probes/harness-one-door.sh` | Probe stays PASS | No regression of the install prefix contract |

## Design Principles

- Keep one source of truth for each value. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX`.
- Make the smallest change that fixes the defect.
- Add no tracked code comments.
- The sandbox user owns the home volume. No fix uses sudo or a root-owned install.

## Out of Scope

- Changes to the harness catalog install arguments.
- Changes to sudo `secure_path`.
- Harness self-update scheduling or version pins.
- Host installs through `agro harness install --host`.

## Open Questions

1. Which file holds the entrypoint tests? No test in the grounding named `reconcile_shell_env_exports`. The implementation owner picks `<entrypoint test file>` or adds one under `.agro/scripts/__tests__/`.
2. Does a user-facing page in `docs/` or in `mifunedev/agro-web` describe harness updates? The grounding found none. The advisor confirms before undraft.

## Acceptance Criteria

- [ ] In a rebuilt sandbox, `claude update` as the `sandbox` user exits 0 without sudo.
- [ ] After `agro destroy <name>` and a new `agro shell <name>` on the same home volume, the updated `claude --version` output stays the same.
- [ ] `pnpm test` in `.agro/cli` exits 0.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` reports PASS.
- [ ] `.agro/scripts/verify-sandbox-image.sh` reports the npm prefix check as `ok`.

## Lessons

Filled by the advisor before undraft.
