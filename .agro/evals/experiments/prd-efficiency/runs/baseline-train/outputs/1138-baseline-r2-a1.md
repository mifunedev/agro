# PRD: Harness self-update uses the home-volume npm prefix

Status: DRAFT

## User Stories

### US-001: Set the npm global prefix for the sandbox user

**Description:** As an operator, I want npm's global prefix in the sandbox to equal `NPM_USER_PREFIX` so that `claude update` and `codex update` install into the home volume without `sudo`.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`.
- [ ] The `ENV NPM_CONFIG_PREFIX` line comes after the `RUN npm install -g cc-safety-net@1.0.6` step, so `cc-safety-net` stays in `/usr/local` in the image.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the `NPM_USER_PREFIX` export.
- [ ] In a rebuilt sandbox, `docker exec -u sandbox <cid> npm config get prefix` prints `/home/sandbox/.local`.
- [ ] In a rebuilt sandbox, `docker exec -u sandbox <cid> bash -lc 'npm config get prefix'` prints `/home/sandbox/.local`.
- [ ] In a rebuilt sandbox, `docker exec -u sandbox <cid> sh -c 'command -v cc-safety-net'` prints `/usr/local/bin/cc-safety-net`.

### US-002: Guard the prefix with a test and the boot smoke

**Description:** As a maintainer, I want the unit tests and the boot smoke to catch prefix drift so that the self-update failure cannot return unnoticed.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/__tests__/harness-catalog.test.ts` has a case that fails when `.devcontainer/Dockerfile` lacks `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`.
- [ ] The same file has a case that fails when the `ENV NPM_CONFIG_PREFIX` line comes before the `npm install -g cc-safety-net` line.
- [ ] The same file has a case that fails when `.agro/install/path-env.sh` does not export `NPM_CONFIG_PREFIX`.
- [ ] `.agro/scripts/sandbox-boot-smoke.sh` fails when `docker exec -u sandbox <cid> bash -lc 'npm config get prefix'` does not print the value of `NPM_USER_PREFIX`.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-003: Document harness self-update and record the change

**Description:** As an operator, I want the harness documentation to state how a harness updates itself so that I do not try `sudo claude update`.

**Acceptance Criteria:**

- [ ] `docs/harnesses/overview.md` states that the sandbox user runs the harness update command, for example `claude update`, without `sudo`.
- [ ] `docs/harnesses/overview.md` states that the update lands in `/home/sandbox/.local` and survives a container recreate.
- [ ] `CHANGELOG.md` has one `### Fixed` entry under `## [Unreleased]` that links issue [#1138](https://github.com/mifunedev/agro/issues/1138).
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/overview.md` reports no finding on the lines this story adds.

## Summary

Verified current state:

- `.devcontainer/Dockerfile` sets `ENV NPM_USER_PREFIX="/home/sandbox/.local"` and puts `$NPM_USER_PREFIX/bin` on `PATH`. The Dockerfile sets no npm prefix, so npm's global prefix stays at the Node image default `/usr/local`.
- `.devcontainer/Dockerfile` runs `npm install -g cc-safety-net@1.0.6` as root at build time. This step depends on the `/usr/local` default.
- `HARNESS_CATALOG` in `.agro/cli/src/lib/harnesses/catalog.ts` installs `claude-code`, `codex`, `pi` and `opencode` with `npm --prefix {{prefix}} install -g`. `SANDBOX_HARNESS_PREFIX` equals `/home/sandbox/.local`.
- A harness self-update runs a bare `npm install -g`. That command writes to `/usr/local` and exits with `EACCES` for the `sandbox` user.
- `/home/sandbox` is the `workspace` named volume in `.devcontainer/docker-compose.yml`. Files under `/home/sandbox/.local` survive a container recreate.
- `.devcontainer/agro-env-generator.sh` copies the environment of PID 1 into systemd units. A Docker `ENV` value therefore reaches `docker exec` shells, systemd units, and the tmux sessions those units start.
- `.agro/install/path-env.sh` is appended to `/home/sandbox/.profile` and `/home/sandbox/.zprofile` at image build. Login shells, such as SSH sessions and `su - sandbox`, get their npm environment from this file.
- `sudo` applies `env_reset` and `secure_path`. A root `npm install -g` under `sudo` keeps the `/usr/local` prefix.

Selected approach: set `NPM_CONFIG_PREFIX` to `$NPM_USER_PREFIX` through the two surfaces that already carry `NPM_USER_PREFIX`: the Dockerfile `ENV` and `path-env.sh`. Place the Dockerfile `ENV` after the last root build-time `npm install -g`. Do not write `~/.npmrc`, because that file holds registry credentials and the secret-path hooks deny it.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, `RUN npm install -g cc-safety-net@1.0.6` | Declares the npm global prefix for every non-login process. |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX` export | Declares the npm global prefix for login shells. |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `SANDBOX_HARNESS_PREFIX`, `HARNESS_PREFIX_TOKEN` | Install prefix that the new npm prefix must equal. No change. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `DOCKERFILE`, `NPM_USER_PREFIX` | Unit guard for the Dockerfile and `path-env.sh` declarations. |
| `.agro/scripts/sandbox-boot-smoke.sh` | new check beside `verify_nothing_installed` | Live guard in the booted sandbox. |
| `.devcontainer/entrypoint.sh` | `reconcile_shell_env_exports` | Repairs hardcoded exports in an existing home volume. See open question 1. |
| `docs/harnesses/overview.md` | harness update section | Operator documentation. |
| `CHANGELOG.md` | `## [Unreleased]` / `### Fixed` | Release record. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment variable `NPM_CONFIG_PREFIX` | Added | npm global installs by the `sandbox` user land in `/home/sandbox/.local`. |
| `claude update`, `codex update` in the sandbox | Behavior fix | Each command exits 0 without `sudo`. |
| `agro harness install` | None | The explicit `--prefix` stays. The argv does not change. |
| Public docs in `mifunedev/agro-web` | Possible update | See open question 2. |

## Storage

The change persists no new state. Harness packages already live in `/home/sandbox/.local/lib/node_modules` on the `workspace` volume. A self-update writes to the same directory.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of truth for the sandbox install prefix. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` on both surfaces and never repeats the literal path.
- Root build-time global installs keep the `/usr/local` prefix. The order of the Dockerfile lines enforces this rule.
- `sudo` stays out of the harness update path. The fix does not change `secure_path`.
- The execution context is the sandbox image. The host needs no change.

Surface review:

- Host and sandbox: applied. All changes are image, sandbox script, test, and documentation changes. The application agent builds and tests inside the sandbox.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: applied. `.agro/install/path-env.sh` is canonical. No provider mirror changes.
- Root and scaffold: applied. Initialized projects use the same image, so both get the fix after a rebuild.
- Interactive and headless processes: applied. The Docker `ENV` reaches Herdr panes, tmux sessions, and systemd units.
- Local and remote operation: applied. The prefix is image state and does not depend on a terminal.
- Parallel operation: not applicable. The prefix is shared read-only configuration.
- Public documentation: see open question 2.
- Verification: applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` | US-001 Dockerfile declaration |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `ENV NPM_CONFIG_PREFIX` index is greater than the `npm install -g cc-safety-net` index | Root build-time install keeps `/usr/local` |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `path-env.sh` exports `NPM_CONFIG_PREFIX` | US-001 login-shell declaration |
| `.agro/scripts/sandbox-boot-smoke.sh` | login-shell `npm config get prefix` equals `NPM_USER_PREFIX` | Live prefix in the booted image, run by `.github/workflows/sandbox-boot-guard.yml` |
| Manual, in a rebuilt sandbox | `agro harness install claude-code`, then `claude update` exits 0; recreate the container; `claude --version` reports the updated version | Issue expected result |

Write each unit case first and confirm that the case fails before the Dockerfile change.

## Design Principles

- One source of truth: derive the npm prefix from `NPM_USER_PREFIX`.
- Smallest change: two declarations, one unit guard, one live guard.
- The sandbox boundary holds: harness state stays in the home volume. The image layer stays free of harness packages.
- Code is the source of truth: add no explanatory comment to the Dockerfile or to `path-env.sh`.

## Out of Scope

- A `sudo claude update` path or a change to `secure_path`.
- A change to the `HARNESS_CATALOG` install or uninstall argv.
- A harness that installs with its own installer, such as `grok-build`, `hermes`, `muse-code`, or `antigravity-cli`.
- A host-side `agro harness install --host` prefix.
- An `agro harness update` verb.

## Open Questions

1. An existing home volume keeps the `.profile` and `.zprofile` from its first boot. Those files lack the new `NPM_CONFIG_PREFIX` export. Docker `ENV` still covers `docker exec`, Herdr, and systemd. Should `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` also append the export to an existing profile, so SSH login shells get the fix?
   - A. Yes. Extend `reconcile_shell_env_exports` in this task.
   - B. No. Docker `ENV` coverage is sufficient. Record the gap in the changelog entry.
2. Does `mifunedev/agro-web` document harness updates? If a page needs a matching change, name the page as `<agro-web page path>`.

## Acceptance Criteria

- [ ] Each US-001, US-002 and US-003 acceptance criterion passes.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `claude update`, and the command exits 0 without `sudo`.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `codex update`, and the command exits 0 without `sudo`.
- [ ] The operator recreates the container with the same `workspace` volume. Then `claude --version` reports the version that `claude update` installed.
- [ ] `/usr/local/lib/node_modules` in the rebuilt image contains no harness package.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` exits 0.
- [ ] `bash .agro/evals/probes/cc-safety-net-wiring.sh` exits 0.

## Lessons

Filled by the advisor before undraft.
