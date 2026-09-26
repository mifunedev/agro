# PRD: Sandbox npm global prefix matches the harness prefix

Status: DRAFT

## User Stories

### US-001: Set the npm global prefix to the home-volume prefix

**Description:** As a sandbox agent, I want npm global installs in my home volume so that harness self-updates work without sudo.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` in the `base` stage.
- [ ] The `NPM_CONFIG_PREFIX` line comes after the root `RUN npm install -g cc-safety-net@1.0.6` line.
- [ ] No `npm install -g` instruction without `--prefix` follows the `NPM_CONFIG_PREFIX` line in `.devcontainer/Dockerfile`.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the `NPM_USER_PREFIX` export.
- [ ] A new case in `.agro/cli/src/__tests__/harness-catalog.test.ts` fails before the change and passes after the change.
- [ ] The new case asserts that the Dockerfile sets `NPM_CONFIG_PREFIX` to the same value as `NPM_USER_PREFIX`.
- [ ] The new case asserts that `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX`.
- [ ] `npm test` exits 0.

### US-002: Prove the prefix in the booted sandbox

**Description:** As an operator, I want the boot smoke to check the npm prefix so that a regression fails CI.

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-boot-smoke.sh` runs `npm config get prefix` as the `sandbox` user through `docker exec -u sandbox <cid> bash -lc`.
- [ ] If the output differs from `NPM_USER_PREFIX`, the smoke exits 1 and names the actual prefix.
- [ ] A new case in `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` makes the fake `docker` stub report /usr/local and expects exit 1.
- [ ] The existing passing fixture cases in `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` still exit 0.
- [ ] `npm test` exits 0.

### US-003: Document harness self-update

**Description:** As an operator, I want the harness docs to state the update path so that nobody runs sudo updates.

**Acceptance Criteria:**

- [ ] `docs/harnesses/overview.md` states that `claude update` and `codex update` run as the `sandbox` user without `sudo`.
- [ ] `docs/harnesses/overview.md` states that the update lands in /home/sandbox/.local and persists across a container recreate.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/overview.md` reports no finding on the new lines.

## Summary

The issue is work/issue-1138.md. `claude update` and `codex update` fail inside the sandbox with `EACCES` on /usr/local/lib/node_modules.

Verified current state:

- `.devcontainer/Dockerfile` line 43 sets `ENV NPM_USER_PREFIX="/home/sandbox/.local"`. No line sets `NPM_CONFIG_PREFIX`.
- `.devcontainer/Dockerfile` line 50 runs `npm install -g cc-safety-net@1.0.6` as root. That install needs the default /usr/local prefix.
- `.agro/cli/src/lib/harnesses/catalog.ts` line 25 sets `SANDBOX_HARNESS_PREFIX` to /home/sandbox/.local. Each npm harness installs with an explicit `npm --prefix`.
- `.agro/install/path-env.sh` exports `NPM_USER_PREFIX` and `PATH`. The Dockerfile appends this file to /home/sandbox/.profile and /home/sandbox/.zprofile.
- `.devcontainer/docker-compose.yml` line 12 mounts the home volume at /home/sandbox.

A harness self-update calls a bare `npm install -g`. npm reads its global prefix from `NPM_CONFIG_PREFIX`. With no value, npm uses /usr/local, which the `sandbox` user cannot write.

Selected approach: set `NPM_CONFIG_PREFIX` to `NPM_USER_PREFIX` in the image environment and in the login-shell profile. The image `ENV` covers `docker exec` and non-login processes. The profile export covers `su -` and login shells that reset the environment. The home volume holds /home/sandbox/.local, so an update persists across a container recreate.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, `RUN npm install -g cc-safety-net@1.0.6` | Add `ENV NPM_CONFIG_PREFIX` after the root global install. |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX` export | Add the `NPM_CONFIG_PREFIX` export for login shells. |
| `.devcontainer/entrypoint.sh` | `reconcile_shell_env_exports` | Existing home volumes keep old profile copies. See Open Questions. |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `SANDBOX_HARNESS_PREFIX`, `resolveInstallArgv` | Unchanged. The explicit `--prefix` stays the source of the install location. |
| `.agro/scripts/sandbox-boot-smoke.sh` | `verify_nothing_installed` neighbor | Add the booted-sandbox prefix check. |
| `docs/harnesses/overview.md` | Harness overview | Document the self-update path. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment | Add variable | `NPM_CONFIG_PREFIX=/home/sandbox/.local` for the `sandbox` user. |
| `npm install -g` in the sandbox | Behavior change | Bare global installs land in /home/sandbox/.local instead of /usr/local. |
| `claude update`, `codex update` | Behavior change | The commands succeed as the `sandbox` user without `sudo`. |
| `agro` lifecycle verbs | None | No verb changes. |

## Storage

The npm global prefix is /home/sandbox/.local on the home volume. The volume is `${AGRO_HOME_MOUNT:-workspace}` in `.devcontainer/docker-compose.yml`. No schema applies.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the one source of truth for the prefix. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` in both the Dockerfile and `.agro/install/path-env.sh`.
- Use the environment variable, not a user `.npmrc` file. The hooks `.agro/hooks/deny-secret-paths.sh` and `.agro/hooks/deny-env-dump.sh` treat `.npmrc` as a secret path. A file on the home volume also drifts from the image.
- Keep the explicit `--prefix` in the harness catalog. The catalog stays correct if an operator overrides `NPM_CONFIG_PREFIX`.
- Do not change /etc/sudoers.d/sandbox or `secure_path`. A root-owned update lands outside the home volume.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile sets `NPM_CONFIG_PREFIX` from `NPM_USER_PREFIX` after the root global install | US-001 image environment |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX` | US-001 login shells |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | Stub reports /usr/local, smoke exits 1 | US-002 regression gate |
| `.agro/evals/probes/harness-one-door.sh` | Existing probe stays PASS | No harness catalog regression |

Run `npm test` and `bash .agro/evals/probes/harness-one-door.sh` from the repository root inside the sandbox.

## Design Principles

- Keep one source of truth: every npm prefix value derives from `NPM_USER_PREFIX`.
- Keep agent work in the home volume. No install path depends on `sudo`.
- Make the smallest change: two environment lines, one smoke check, one doc paragraph.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to `sudo` configuration or `secure_path`.
- Changes to the harness catalog install or uninstall argv.
- Migration of harnesses that an operator installed into /usr/local by hand.
- Changes to mifunedev/agro-web. See Open Questions.

## Open Questions

1. Existing home volumes keep the old /home/sandbox/.profile and /home/sandbox/.zprofile copies. Must `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` also append the `NPM_CONFIG_PREFIX` export? The image `ENV` covers `docker exec` shells without the append.
2. Does the fake `docker` stub in `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` accept a new `bash -lc` command without a fixture change?
3. Does the root `npm test` run the `.agro/cli` test suite, or does `.agro/cli` need `<cli test command>`?
4. Does mifunedev/agro-web document harness updates and need a matching change?

## Acceptance Criteria

- [ ] Inside a rebuilt sandbox, `npm config get prefix` as the `sandbox` user prints /home/sandbox/.local.
- [ ] Inside a rebuilt sandbox, `claude update` as the `sandbox` user exits 0 without `sudo`.
- [ ] Inside a rebuilt sandbox, `codex update` as the `sandbox` user exits 0 without `sudo`.
- [ ] After a container recreate that keeps the home volume, `claude --version` as the `sandbox` user prints the updated version.
- [ ] `npm test` exits 0.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` reports PASS.

## Lessons

Filled by the advisor before undraft.
