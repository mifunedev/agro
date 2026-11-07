# PRD: Replace nvm with fnm

Status: DRAFT

## User Stories

### US-001: Install fnm and Node 24 from install.sh

**Description:** As an operator on a host with no suitable Node, I want `install.sh` to install fnm and Node 24 so that `agro` runs without nvm.

**Acceptance Criteria:**

- [ ] Before the change, a new test in `.agro/scripts/__tests__/install.test.ts` for the fnm install fails.
- [ ] On a host with no Node, `install.sh --yes` installs fnm into `$FNM_DIR` and runs `fnm install 24`, `fnm use 24`, and `fnm default 24`.
- [ ] The installer sets the default of `FNM_DIR` to `$HOME/.local/share/fnm`.
- [ ] The installer downloads the fnm installer from the tag in `AGRO_FNM_VERSION`. The default tag is `v1.39.0`.
- [ ] `install.sh` does not create `~/.nvm`.
- [ ] If `unzip` is missing, `apt-get` exists, and the user is root or `sudo -n true` exits 0, `install.sh --yes` installs `unzip` and continues.
- [ ] If `unzip` is missing and `install.sh` cannot install `unzip`, `install.sh` exits non-zero and prints a message that names `unzip`.
- [ ] `install.sh` adds one fnm setup block to each existing `~/.zshrc` and `~/.bashrc`. If neither file exists, `install.sh` adds the block to `~/.profile`. A second run adds no second block.
- [ ] When `command -v node` resolves through a symlink to a file under `$FNM_DIR`, the `~/.local/share/agro/node` link points at the resolved file, not at the per-shell path.
- [ ] `env -i HOME=<home> PATH=/usr/bin:/bin <home>/.local/bin/agro --version` exits 0 after a fnm install.
- [ ] When `node` resolves under `${NVM_DIR:-$HOME/.nvm}`, `install.sh` keeps the `agro` shebang pinned and does not install fnm.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/install.test.ts` exits 0.

### US-002: Replace the remaining nvm references

**Description:** As a maintainer, I want the smoke script, the remote-sandbox checks, and the documentation to name fnm so that no path depends on nvm.

**Acceptance Criteria:**

- [ ] `.agro/scripts/cli-first-install-smoke.sh` loads fnm in its new-login check, and `--bootstrap-without-node` help text names fnm.
- [ ] `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` uses a fnm directory for its pinned case, and `pnpm exec vitest run .agro/scripts/__tests__/cli-first-install-smoke.test.ts` exits 0.
- [ ] `agro-rows.sh`, `docker-egress.sh`, `hermes-home.sh`, and `openshell-journey.sh` under `.agro/skills/remote-sandbox/checks/` load fnm, and `bash -n` exits 0 for each file.
- [ ] `.agro/skills/remote-sandbox/SKILL.md` and `.agro/skills/remote-sandbox/references/rationale.md` name fnm for current behavior.
- [ ] `docs/installation.md` describes fnm, `AGRO_FNM_VERSION`, and the `unzip` behavior.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` that links #1569.
- [ ] A new or existing test in `.agro/cli/src/__tests__/self-upgrade.test.ts` proves that `agro self-upgrade` keeps a `~/.local/share/agro/node` shebang.
- [ ] `git grep -inE "\bnvm\b|NVM_" -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints only the compatibility path of US-001, its tests, its documentation sentence, and history rows that name a past fix.

### US-003: Capture the fresh-install evidence

**Description:** As the reviewer, I want a real install transcript so that I can confirm the change without a rerun.

**Acceptance Criteria:**

- [ ] `.agro/tasks/nvm-to-fnm/evidence/manual-review.md` holds a transcript from `docker run --rm debian:bookworm-slim` with `curl` and `ca-certificates` present and `node` and `unzip` absent at the start.
- [ ] The transcript runs `bash .agro/scripts/cli-first-install-smoke.sh --phase bootstrap --bootstrap-without-node --bundle <bundle> --keep` from a new temp work directory, and the command exits 0.
- [ ] The transcript shows a Node 24 version, `pinned_node=`, and the absence of `~/.nvm`.
- [ ] The transcript shows `unzip -v` exit 0 after the install.
- [ ] The story creates only the `--rm` container and the temp directory, and the story deletes the temp directory.

## Summary

`install.sh` installs nvm when a host has no suitable Node. The fnm installer stops when `unzip` is missing (#1569, mifunedev/agro-console#699). `debian:bookworm-slim`, which `.github/workflows/sandbox-boot-guard.yml` uses, has no `unzip`.

The selected approach replaces `install_node_via_nvm` with `install_node_via_fnm`, adds `ensure_unzip`, and extends `pin_nvm_node` into one pin function. The fnm installer runs with `--install-dir "$FNM_DIR" --skip-shell --force-no-brew --release "$AGRO_FNM_VERSION"`. `install.sh` writes the shell setup itself, because the fnm installer exits when it cannot infer the shell.

`fnm env` puts a per-shell symlink on `PATH`. The pin resolves that symlink with Node `fs.realpathSync`, which also runs on macOS. `withPinnedShebang` in `.agro/cli/src/commands/self-upgrade.ts` already keeps each absolute Node shebang, so the CLI needs no change.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/install.sh` | `install_node_via_nvm`, `ensure_node`, `pin_nvm_node`, `AGRO_NVM_VERSION` | Node install and shebang pin |
| `.agro/scripts/__tests__/install.test.ts` | `fakeNvm`, `INSTALLER_TOOLS`, static contract | Installer tests |
| `.agro/scripts/cli-first-install-smoke.sh` | bootstrap phase, `verify_installed_bundle` | Fresh-install smoke |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | bootstrap pinned cases | Smoke tests |
| `.github/workflows/sandbox-boot-guard.yml` | `--bootstrap-without-node` job | CI proof as root without `unzip`; no change expected |
| `.agro/skills/remote-sandbox/checks/*.sh` | `nvm.sh` load lines | VM checks |
| `.agro/cli/src/commands/self-upgrade.ts` | `withPinnedShebang` | Keeps the pinned shebang; no change expected |
| `docs/installation.md` | Prerequisites, variables, non-interactive shells | Public documentation |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `AGRO_NVM_VERSION` | Removed | `AGRO_FNM_VERSION` replaces this variable. |
| `AGRO_FNM_VERSION` | Added | The fnm release tag for the Node install. |
| `install.sh` prompt and help | Changed | The text names fnm and Node 24. |
| Shell startup files | Changed | `install.sh` writes a fnm setup block instead of the nvm installer block. |

## Storage

`install.sh` stores fnm and Node under `$FNM_DIR`. The `~/.local/share/agro/node` link stays at the same path. The task adds no other persistent state.

## Architectural Decisions

- The operator decided that fnm replaces nvm wherever AGRO uses nvm.
- The installer adds `unzip` when the user has root or passwordless `sudo` with `apt-get`. The installer stops with a message that names `unzip` in every other case.
- A host with an existing nvm Node keeps that Node. `install.sh` does not uninstall nvm.
- Host and sandbox: all commands run on the host or in a disposable container. The sandbox image gets Node from its base image and needs no change.
- Lifecycle door: `agro` verbs do not change. Root and scaffold: the installer serves both. Interactive and headless processes: the task adds no process. Parallel operation: `$FNM_DIR` is per user and adds no shared state.
- Canonical and provider surfaces: each changed skill file is under `.agro/skills/`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/install.test.ts` | fnm install, per-shell path resolve, second run, `unzip` install and refusal, nvm compatibility, setup block | US-001 |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Pinned and unpinned bootstrap | US-002 |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | Pinned shebang kept | US-002 |
| `.github/workflows/sandbox-boot-guard.yml` | Bootstrap without Node on `debian:bookworm-slim` | CI path |

## Design Principles

Apply the root `AGENTS.md`: use the smallest truthful change and add no explanatory comments to tracked code. Keep one version manager for new installs. Do not parse or edit a host's existing nvm setup.

## Out of Scope

- Node provisioning in mifunedev/agro-console, which #699 tracks.
- Removal of nvm from an existing host.
- Package managers other than `apt-get` for the `unzip` install.
- Changes to released `CHANGELOG.md` sections, to completed `.agro/tasks/` records, and to `.nvmrc`, which fnm reads.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each Done When item of #1569 passes.
- [ ] `pnpm run typecheck`, `pnpm test`, and `pnpm run build` exit 0.
- [ ] The `sandbox-boot-guard` workflow passes on the task branch.

## Lessons

- Claim: `self-upgrade.test.ts` fails under `umask 0077`. Evidence: 4 cases report `expected 448 to be 493`, and two of the cases are not in this change. Outcome: dropped, because the failure is a local test setup problem and the cases pass under `umask 022`.
- Claim: `herdr-default.test.ts` needs `zsh`, which this host lacks. Evidence: 7 cases report `spawnSync zsh ENOENT`, and this task does not change that test. Outcome: dropped, because the test states the requirement in its error message.
- Claim: `gh pr edit` exits with a Projects (classic) error and leaves the PR body unchanged on this version of `gh`. Evidence: the US-001 tick did not reach PR #1570. Outcome: dropped, because `gh api` with `PATCH` updates the body, and the problem is tooling friction.
