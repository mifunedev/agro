# PRD: Run the agro CLI in non-interactive shells after an nvm Node install

Status: DRAFT

## User Stories

### US-001: get-agro.sh pins the nvm Node in the installed CLI

**Description:** As an operator who installs AGRO on a host with no Node, I want `~/.local/bin/agro` to run in any shell. Cron jobs, systemd units, cloud-init, and plain `ssh` commands run the CLI with no nvm setup.

**Acceptance Criteria:**

- [ ] A new case in `.agro/scripts/__tests__/get-agro.test.ts` runs `get-agro.sh --yes` with a `PATH` that holds no `node` and with a fake `NVM_DIR` whose `nvm.sh` installs a fake Node 22. The case fails before the change.
- [ ] After the change, that case shows `~/.local/share/agro/node` as a symbolic link to the Node binary that `nvm which 22` prints.
- [ ] After the change, the first line of the installed `agro` file is `#!<HOME>/.local/share/agro/node`.
- [ ] After the change, `env -i HOME=<HOME> PATH=/usr/bin:/bin <HOME>/.local/bin/agro --version` exits 0 in that case.
- [ ] A new case runs `get-agro.sh --yes` a second time with the fake nvm `node` on `PATH`. After the second run, the first line of the installed `agro` file is `#!<HOME>/.local/share/agro/node`.
- [ ] A new case runs `get-agro.sh --yes` with `AGRO_BIN_DIR` outside `HOME` and the fake nvm `node`. The output holds one warning that names the install directory and `<HOME>/.local/share/agro/node`.
- [ ] When the `node` on `PATH` is outside `$NVM_DIR`, the installed `agro` file equals the release `agro.js` byte for byte. An existing end-to-end case covers this path and still passes.

### US-002: agro update keeps a pinned Node shebang

**Description:** As an operator with a pinned Node shebang, I want `agro update` to keep the pinned first line. An update then does not bring back the non-interactive failure.

**Acceptance Criteria:**

- [ ] A new case in `.agro/cli/src/__tests__/self-upgrade.test.ts` starts from a target whose first line is `#!/abs/path/node`. After the update, the first line of the target is `#!/abs/path/node`, and the rest of the target equals the downloaded artifact after its first line.
- [ ] A new case starts from a target whose first line is `#!/usr/bin/env node`. After the update, the target equals the downloaded artifact byte for byte.
- [ ] The existing cases in `self-upgrade.test.ts` pass.

### US-003: Document the non-interactive behavior

**Description:** As an operator, I want the install documentation to state which shells find `agro` so that I write cron jobs and units that work.

**Acceptance Criteria:**

- [ ] `docs/installation.md` states that `get-agro.sh` links the nvm Node to `~/.local/share/agro/node` and pins the `agro` shebang to that link.
- [ ] `docs/installation.md` states that a non-interactive shell runs `~/.local/bin/agro` by its absolute path, and that a login shell finds `agro` on `PATH`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/installation.md` exits 0.

### US-004: Manual review evidence on a fresh VM

**Description:** As the advisor, I want a transcript from a VM with no Node so that the review has evidence from a real host.

**Acceptance Criteria:**

- [ ] With operator approval, the advisor creates one exe.dev VM from the default `exeuntu` image through `.agro/tasks/microvm-validation/run.sh`.
- [ ] The advisor copies the candidate `get-agro.sh` to the VM and runs `bash get-agro.sh --yes` there.
- [ ] `ssh <vm> '~/.local/bin/agro --version'` prints the release version and exits 0.
- [ ] `ssh <vm> 'bash -lc "agro --version"'` prints the release version and exits 0.
- [ ] `.agro/tasks/agro-cli-noninteractive-node/evidence/manual-review.md` holds the commands, the outputs, and the VM removal output.

## Summary

Register entry `C9` in `.agro/tasks/microvm-validation/prd.md` records the defect. The evidence comes from the exe.dev `exeuntu` image and from two agro-console `n4` nodes with agro 0.15.0 and 0.16.0.

Verified current behavior:

1. `ensure_node` in `.agro/scripts/get-agro.sh` calls `install_node_via_nvm` when `node` 20 or later is absent.
2. `install_node_via_nvm` sources `$NVM_DIR/nvm.sh`, runs `nvm install 22`, and runs `nvm use 22`. The nvm installer appends the nvm source lines to `~/.bashrc`.
3. `get-agro.sh` installs the release `agro.js` unchanged at `$AGRO_BIN_DIR/agro`. The first line of `agro.js` is `#!/usr/bin/env node`.
4. `get-agro.sh` adds `$AGRO_BIN_DIR` to `PATH` in `~/.zprofile`, `~/.profile`, or `~/.bashrc`.
5. On the `n4` node, `bash -lc "agro --version"` found `agro` and failed with `/usr/bin/env: 'node': No such file or directory`. A plain `ssh` command failed with `agro: command not found`.
6. `agro update` in `.agro/cli/src/commands/self-upgrade.ts` writes the downloaded artifact over the target. The update checks that the artifact starts with `#!`.
7. agro-console cloud-init downloads `get-agro.sh` from the pinned AGRO release and runs it with `--yes`. A new AGRO release with this fix reaches console nodes when console pins that release.

Selected approach:

1. After `ensure_node`, `get-agro.sh` resolves `command -v node`.
2. If the resolved path is under `$NVM_DIR`, the script links that binary to `~/.local/share/agro/node`.
3. In that condition, the script replaces the first line of the installed `agro` file with `#!` and the absolute link path.
4. If `AGRO_BIN_DIR` is outside `$HOME`, the script prints one warning. The warning states that the CLI uses the Node of the installing user.
5. `agro update` keeps an existing absolute Node shebang.

The trigger is the location of `node`, not the nvm install in the current run. A second run from an interactive shell finds the nvm `node` on `PATH`. A trigger on the install step alone then writes `#!/usr/bin/env node` again and brings back the defect.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/get-agro.sh` | `install_node_via_nvm`, `ensure_node`, install block at `install -m 0755` | Creates the Node link and pins the shebang. |
| `.agro/cli/src/commands/self-upgrade.ts` | artifact write before `deps.writeFile(tmp, artifact, 0o755)` | Keeps an absolute Node shebang across updates. |
| `.agro/scripts/__tests__/get-agro.test.ts` | `describe("get-agro.sh end to end")` | Red test for US-001. |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | update cases | Red tests for US-002. |
| `docs/installation.md` | install section | Operator documentation for US-003. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `~/.local/share/agro/node` | New file | Symbolic link to the nvm Node binary. `get-agro.sh` creates or replaces the link when `node` resolves under `$NVM_DIR`. |
| First line of `~/.local/bin/agro` | Changed | `#!<HOME>/.local/share/agro/node` when `node` resolves under `$NVM_DIR`. No change otherwise. |
| First line of `~/.local/bin/agro` | Changed | `get-agro.sh` writes `#!<HOME>/.local/share/agro/node` when `node` resolves under `$NVM_DIR`. No change otherwise. |
| `agro update` | Changed behavior | Keeps an absolute Node shebang from the current target. |

## Storage

The link `~/.local/share/agro/node` is the only new state. A second run of `get-agro.sh` replaces the link.

## Architectural Decisions

- The link path stays the same when nvm installs a newer Node 22. A rerun of `get-agro.sh` points the link at the new binary, and the shebang does not change.
- A host whose `node` resolves outside `$NVM_DIR` keeps `#!/usr/bin/env node`. A system Node at `/usr/bin/node` is an example.
- The link lives in `~/.local/share/agro/`. `.agro/scripts/provision-python.sh` already keeps the runtime path `$HOME/.local/share/agro/kernel` there. The link stays out of `~/.agro`, which holds CLI state.
- The pin applies for every `AGRO_BIN_DIR`. For an install directory outside `$HOME`, other users cannot read the Node of the installing user. Those users cannot run the CLI before the change either.
- `get-agro.sh` writes no file outside the home directory and uses no `sudo`.
- Rejected alternative: a `node` link in `$AGRO_BIN_DIR`. `#!/usr/bin/env node` searches `PATH`, and cron and systemd do not put `~/.local/bin` on `PATH`.
- Rejected alternative: nvm lines in `~/.profile`. That change fixes login shells only.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/get-agro.test.ts` | nvm install with no `node` on `PATH` | Link, pinned shebang, and `--version` under `env -i`. |
| `.agro/scripts/__tests__/get-agro.test.ts` | second run with the nvm `node` on `PATH` | The pinned shebang stays. |
| `.agro/scripts/__tests__/get-agro.test.ts` | `AGRO_BIN_DIR` outside `HOME` | One warning names the install directory and the link. |
| `.agro/scripts/__tests__/get-agro.test.ts` | existing end-to-end cases | The release file stays unchanged when `node` is outside `$NVM_DIR`. |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | absolute shebang target | The update keeps the first line. |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | `env` shebang target | The update writes the artifact unchanged. |

## Design Principles

- Fix the defect where the defect starts: the installer that chose nvm.
- Keep one source of truth for the Node path: the link.
- Keep the release artifact unchanged.
- Add no explanatory comments to tracked code.

## Out of Scope

- A change to agro-console cloud-init. Console receives the fix through the pinned AGRO release.
- A change to `PATH` handling for plain `ssh host cmd`. A non-interactive shell runs `agro` by its absolute path.
- Node versions other than the Node 22 that `install_node_via_nvm` installs.

## Open Questions

1. Resolved: the link path is `~/.local/share/agro/node`.
2. Resolved: the pin applies for every `AGRO_BIN_DIR`, with one warning when `AGRO_BIN_DIR` is outside `$HOME`.

## Acceptance Criteria

- [ ] `pnpm test` exits 0 in the harness repository.
- [ ] On a host with no Node, `~/.local/bin/agro --version` exits 0 under `env -i HOME=<HOME> PATH=/usr/bin:/bin` after `get-agro.sh --yes`.
- [ ] On a host whose `node` resolves outside `$NVM_DIR`, the installed `agro` file equals the release `agro.js` byte for byte.

## Lessons

1. Claim: `get-agro.sh` installed Node through nvm and left the CLI usable only in interactive shells. Evidence: register entry `C9` and the US-004 transcript, where `agro --version` exits 0 under `env -i HOME=$HOME PATH=/usr/bin:/bin`. Outcome: fixed in this PR.
2. Claim: new `undici` advisories made `pnpm audit` fail on every branch. Evidence: CI run 36922420227 reported 10 `undici` advisories with the patch at `>=7.29.1`. Outcome: fixed in this PR with the override `undici: ^7.29.1`, on operator instruction.
3. Claim: one local `pnpm test:scripts` run failed one test. Evidence: the failing test was not captured. The US-001 repair worker found a race in a fresh worktree: `cli-first-install-smoke.test.ts` stops with `missing candidate bundle` while `get-agro.test.ts` builds `.agro/cli/dist/agro.js` in parallel. Outcome: issue #1264.
4. Claim: agro-console still defaults to agro 0.15.0. Evidence: `DEFAULT_AGRO_VERSION` in `packages/shared/src/index.ts` and `NODE_AGRO_VERSION` in `deploy/.example.env`. Console nodes receive this fix only after console pins a release that holds the fix. Outcome: issue mifunedev/agro-console#232.
