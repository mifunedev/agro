# PRD: Host Node provisioning without nvm

Status: BLOCKED

## User Stories

### US-001: Install a private Node runtime in install.sh

**Description:** As an operator on a host, I want `agro` to run on a Node at a fixed absolute path. A Node version switch or uninstall then never breaks `agro`.

**Acceptance Criteria:**

- [ ] `.agro/scripts/install.sh` contains no `nvm` string and no `fnm` string.
- [ ] When `node` is absent, older than 20, or resolves under `$HOME`, `install.sh` offers the private runtime.
- [ ] When the operator accepts, `install.sh` downloads `node-<version>-<os>-<arch>.tar.gz` from `${AGRO_NODE_DIST_URL:-https://nodejs.org/dist}/<AGRO_NODE_VERSION>/`.
- [ ] `install.sh` compares the tarball SHA-256 with the line in `SHASUMS256.txt`. On a mismatch, `install.sh` exits 1 and installs no file.
- [ ] `install.sh` extracts the runtime under `~/.local/share/agro/` and links `~/.local/share/agro/node` to the runtime `bin/node`.
- [ ] When `install.sh` installs the private runtime, the `agro` shebang is `#!<home>/.local/share/agro/node`.
- [ ] When `node` is version 20 or later and resolves outside `$HOME`, the `agro` shebang is `#!` plus the `readlink -f` path of that `node`.
- [ ] After `install.sh` exits 0, the installed `agro` file never starts with `#!/usr/bin/env node`.
- [ ] `install.sh` maps `uname -s` values `Linux` and `Darwin` and `uname -m` values `x86_64`, `aarch64`, and `arm64` to Node archive names. Another value exits 1 with a message that names the value.
- [ ] `AGRO_NODE_VERSION` replaces `AGRO_NVM_VERSION` in `print_help`, and the default is `latest-v22.x`.
- [ ] `install.sh` writes no Node line to `~/.bashrc`, `~/.zshrc`, or `~/.profile`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/install.test.ts` exits 0.

### US-002: Pin the sandbox agro to the image Node

**Description:** As an application agent in the sandbox, I want the image `agro` to run on the image Node. A per-project Node switch then never breaks `agro`.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` writes `#!/usr/local/bin/node` as line 1 of `/opt/agro/dist/agro.js`.
- [ ] `.agro/scripts/verify-sandbox-image.sh` fails when line 1 of `/usr/local/bin/agro` differs from `#!/usr/local/bin/node`.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh` exits 0 against the rebuilt image.

### US-003: Add fnm as a sandbox tool

**Description:** As an application agent, I want `agro tool install fnm` in the sandbox. Each project then selects its Node version from its own version file.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/tools/catalog.ts` holds an entry with `id: "fnm"`, a pinned version, and a SHA-256 for each of `amd64` and `arm64`.
- [ ] The `fnm` entry sets `hostCapable: false` and `installUser: "sandbox"`.
- [ ] The install adds `eval "$(fnm env --use-on-cd --version-file-strategy=recursive)"` to `~/.bashrc` once. A second install adds no second line.
- [ ] In an interactive shell, `cd` into a directory with `.nvmrc` set to `20` makes `node --version` print `v20.` followed by the minor and patch.
- [ ] After that `cd`, `agro --version` exits 0 in the same shell.
- [ ] Two shells in two worktrees with different `.nvmrc` values print different `node --version` values at the same time.
- [ ] A cron fire and `agro-bootstrap.service` resolve `node` to `/usr/local/bin/node`.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/tool-catalog.test.ts .agro/cli/src/__tests__/tool.test.ts` exits 0.

### US-004: Document the Node contract and align the checks

**Description:** As an operator, I want one documentation table that states the Node of each environment. I then know which Node runs `agro` and how to switch my own Node.

**Acceptance Criteria:**

- [ ] `docs/installation.md` holds a "Node runtime by environment" section that copies the environment table of this plan.
- [ ] `docs/installation.md` names `AGRO_NODE_VERSION` and `AGRO_NODE_DIST_URL` in the options table.
- [ ] `docs/installation.md` documents `agro tool install fnm` for the sandbox.
- [ ] `git grep -n -i nvm -- .agro/scripts .agro/skills/remote-sandbox/checks docs` prints only lines that name nvm as an operator-owned manager.
- [ ] `.agro/scripts/cli-first-install-smoke.sh --bootstrap-without-node` runs `agro --version` without a profile source and without `nvm.sh`.
- [ ] `.agro/skills/remote-sandbox/checks/agro-rows.sh` row `R02b-noninteractive-cli` runs `agro` without sourcing `nvm.sh`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/cli-first-install-smoke.test.ts` exits 0.

### US-005: Remove the nvm step from the agro-console bootstrap

**Description:** As a console maintainer, I want the node bootstrap script to stop sourcing `nvm.sh`. The bootstrap then works with the AGRO release that ships US-001.

**Acceptance Criteria:**

- [ ] The change lands in `mifunedev/agro-console` in the same pull request that moves `agroVersion` to the first AGRO release with US-001.
- [ ] `packages/shared/src/workspace-bootstrap-assets.ts` emits no `NVM_DIR` line and no `load_node` function or call.
- [ ] `infra/cloud-init/cloud-config.yaml` matches the regenerated output of `workspace-bootstrap-assets.ts`.
- [ ] `packages/shared/src/__tests__/cloud-init.test.ts` creates no `.nvm` fixture and asserts that the script contains no `nvm.sh` string.
- [ ] `pnpm test` exits 0 in `projects/mifunedev/agro-console`.

### US-006: Record manual review evidence

**Description:** As the advisor, I want one command transcript for each environment row. The PR `## Manual review` section then shows the real behavior.

**Acceptance Criteria:**

- [ ] With operator approval, the advisor runs `bash .agro/scripts/cli-first-install-smoke.sh --bootstrap-without-node` and records exit 0.
- [ ] The advisor records a host transcript: install with a fake nvm `node`, run `nvm use` to another version, then run `agro --version` with exit 0.
- [ ] The advisor records a sandbox transcript of the US-003 `.nvmrc` switch and `agro --version` with exit 0.
- [ ] With operator approval, the advisor runs `scripts/agro-bootstrap-probe.sh <agro version>` in agro-console and records `status ok`.
- [ ] The advisor writes all transcripts to `.agro/tasks/host-node-provisioning/evidence/manual-review.md`.
- [ ] The advisor deletes each container that the runs create, and `docker ps -a` lists none of them.

## Summary

The operator asked for a decision on nvm and fnm in two repositories. The operator also asked for an explicit Node contract for each supported environment.

Verified current state in `mifunedev/agro`:

- Only the host installer uses nvm. `install_node_via_nvm` in `.agro/scripts/install.sh` runs the nvm installer, then `nvm install 22`.
- `pin_nvm_node` pins the `agro` shebang to `~/.local/share/agro/node` only for an nvm Node. mifunedev/agro#1263 added this fix.
- Every other host install keeps `#!/usr/bin/env node`. A PATH change then changes the Node of `agro`.
- The sandbox image starts `FROM node:22-trixie-slim`. Node is `/usr/local/bin/node`.
- The image links `/usr/local/bin/agro` to `/opt/agro/dist/agro.js`, and line 1 is `#!/usr/bin/env node`.
- The tool catalog in `.agro/cli/src/lib/tools/catalog.ts` installs pinned binaries with a SHA-256 check. The `herdr` entry is the pattern.
- CI uses `actions/setup-node@v7`. The root `.nvmrc` holds `22`.

Verified current state in `mifunedev/agro-console`:

- The node bootstrap sets `NVM_DIR` and calls `load_node`, which sources `$NVM_DIR/nvm.sh` after `install_agro`.
- The bootstrap downloads `install.sh` from a versioned release, for example `v0.17.0`. An AGRO change reaches the console only through an `agroVersion` change.

Decision options:

| Option | Gain | Cost |
|---|---|---|
| A. Keep nvm | No change. | The installer edits shell profiles. `nvm uninstall 22` breaks `agro`. |
| B. Replace nvm with fnm on the host | One binary. | The fnm installer needs `unzip`. AGRO then owns the version manager of the operator. |
| C. Private runtime on the host, fnm as a sandbox tool | `agro` never shares a switchable Node. Each operator keeps a free choice of manager. | `install.sh` owns about 30 lines of download logic. |

Recommendation: choose option C. The rule is simple: AGRO owns the Node of `agro`, and the user owns every other Node.

### Node runtime by environment

| Environment | Node that runs `agro` | How the user switches Node | Switch effect on `agro` |
|---|---|---|---|
| Linux or WSL2 host, no Node or a Node under `$HOME` | Private runtime at `~/.local/share/agro/node` | Any manager that the operator installs | None |
| Linux or WSL2 host, system Node 20 or later | The resolved `node` path of the distribution package | The distribution package manager | A distribution upgrade changes the Node of `agro` |
| macOS host | Same rules as the Linux rows | Same as the Linux rows | Same as the Linux rows |
| Host with `npm install -g @mifune/agro` | The Node of the npm prefix through `#!/usr/bin/env node` | The manager of the operator | The operator owns the effect. A per-version prefix hides `agro` after a switch. |
| Remote VM: exe.dev, Vercel Sandbox, console node | Private runtime through `install.sh --yes` | Same as the Linux rows | None |
| Sandbox container | `/usr/local/bin/node` from the image | `agro tool install fnm`, then `.nvmrc` or `.node-version` per project | None |
| Sandbox cron, systemd, and tmux services | `/usr/local/bin/node` | No switch | None |
| CI | `actions/setup-node@v7` with `.nvmrc` | The workflow file | Not applicable |

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/install.sh` | `install_node_via_nvm`, `ensure_node`, `pin_nvm_node`, `print_help`, `AGRO_NVM_VERSION` | Host Node install and shebang pin |
| `.agro/scripts/__tests__/install.test.ts` | `fakeNvm`, `nvmWhich`, `describe("install.sh nvm Node pin")` | Installer unit tests |
| `.devcontainer/Dockerfile` | the `ln -sf /opt/agro/dist/agro.js /usr/local/bin/agro` step | Sandbox `agro` install |
| `.agro/scripts/verify-sandbox-image.sh` | `EXPECTED_NODE_MAJOR` check | Sandbox image check |
| `.agro/cli/src/lib/tools/catalog.ts` | `herdr` entry, `TOOLS_DOC` | Tool catalog pattern |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | catalog cases | Catalog tests |
| `.agro/scripts/cli-first-install-smoke.sh` | `--bootstrap-without-node`, the `NVM_DIR` source block | Fresh-host smoke test |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | `nodeUnderNvm` cases | Smoke test unit tests |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | row `R02b-noninteractive-cli` | Provider VM check |
| `docs/installation.md` | options table, "Non-interactive shells" | Public install and tool documentation |
| `projects/mifunedev/agro-console/packages/shared/src/workspace-bootstrap-assets.ts` | `load_node`, `NVM_DIR` | Console node bootstrap source |
| `projects/mifunedev/agro-console/infra/cloud-init/cloud-config.yaml` | `load_node` | Generated cloud-init file |
| `projects/mifunedev/agro-console/packages/shared/src/__tests__/cloud-init.test.ts` | `.nvm` fixture, `nvm.sh` assertion | Console bootstrap tests |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `install.sh` environment | Breaking rename | `AGRO_NODE_VERSION` replaces `AGRO_NVM_VERSION`. |
| `install.sh` environment | Addition | `AGRO_NODE_DIST_URL` sets the Node download base. The tests use a `file://` URL. |
| `install.sh` prompt | Text change | The prompt offers a private Node 22 for `agro`, not nvm. |
| Installed `agro` shebang | Behavior change | An `install.sh` install always pins an absolute Node path. |
| Operator PATH | Behavior change | A fresh install puts no `node` command on the operator PATH. |
| `agro tool install fnm` | Addition | A sandbox-only catalog tool. |
| Console bootstrap script | Removal | The script drops `NVM_DIR` and `load_node`. |

## Storage

The private runtime lives under `~/.local/share/agro/`. The link `~/.local/share/agro/node` keeps its current path. fnm keeps its versions in the sandbox home, which persists with the sandbox. No database or schema change applies.

## Architectural Decisions

- AGRO owns the Node of `agro`. The user owns every other Node. No AGRO component sources a version manager.
- An `agro` file from `install.sh` or from the image never resolves `node` through PATH.
- `install.sh` never pins `agro` to a Node under `$HOME`, because a version manager can delete that Node.
- An npm install keeps `#!/usr/bin/env node`. The operator chose npm, so the operator owns that Node.
- fnm is a sandbox tool, not a host prerequisite. The fnm shell hook runs only in interactive shells.
- `agro self-upgrade` keeps the pinned shebang and needs no change.
- The console follows the AGRO release through `agroVersion`.

Surface review:

- Host and sandbox: applied. US-001 changes the host. US-002 and US-003 change the sandbox.
- Lifecycle door: applied. `agro tool install fnm` adds one catalog entry. `agro self-upgrade` keeps the shebang.
- Canonical and provider surfaces: not applicable. No skill mirror changes.
- Root and scaffold: applied to the root installer and the image. Initialized projects get the image change.
- Interactive and headless processes: applied. Interactive shells switch Node. Cron, systemd, and tmux services keep the image Node.
- Local and remote operation: applied. Row `R02b-noninteractive-cli` proves the remote case.
- Parallel operation: applied. fnm keeps one Node selection per shell, so two worktrees select two versions.
- Public documentation: applied in US-004.
- Verification: applied in the Test Plan.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/install.test.ts` | Without `node`, a `file://` dist fixture installs the runtime and pins the shebang | US-001 private runtime |
| `.agro/scripts/__tests__/install.test.ts` | A tarball with a wrong SHA-256 exits 1 and leaves `AGRO_BIN_DIR` empty | US-001 checksum |
| `.agro/scripts/__tests__/install.test.ts` | A `node` under a fake nvm directory leads to the private runtime pin | US-001 manager Node |
| `.agro/scripts/__tests__/install.test.ts` | A `node` symlink outside `$HOME` pins to the link target | US-001 system Node |
| `.agro/scripts/__tests__/install.test.ts` | An unknown `uname -m` value exits 1 and names the value | US-001 architecture map |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Bootstrap without `node` runs `agro --version` without `nvm.sh` | US-004 |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | The `fnm` entry pins a version and two SHA-256 values and sets `hostCapable: false` | US-003 |
| `.agro/scripts/verify-sandbox-image.sh` | Line 1 of `/usr/local/bin/agro` is `#!/usr/local/bin/node` | US-002 |
| `projects/mifunedev/agro-console/packages/shared/src/__tests__/cloud-init.test.ts` | The script contains no `nvm.sh` string and the bootstrap reaches `status ok` | US-005 |

Write each case red first. Then change the code.

## Design Principles

- Keep the smallest truthful model: one fixed Node for `agro` in each environment.
- Give the user a free choice of Node manager outside `agro`.
- Delete the nvm path. Keep no dormant fallback.
- Keep the installer free of shell-profile edits for Node.
- Never write a comment into tracked code.

## Out of Scope

- A change to CI `actions/setup-node@v7` steps or to the root `.nvmrc`.
- Node patch updates through `agro self-upgrade`.
- Removal of nvm from hosts where an operator installed nvm.
- An fnm install on the host through `agro tool install`.
- Windows hosts outside WSL2.

## Open Questions

1. Which option does the operator choose?
   A. Option C, private runtime on the host and fnm in the sandbox (recommended).
   B. Option C without US-003. The sandbox then offers no version switch.
   C. Option B, fnm on the host.
   D. Option A, keep nvm. The task closes with no code change.
2. Does `AGRO_NODE_VERSION` default to `latest-v22.x` or to an exact version such as `<v22.x.y>`?
3. Does `install.sh` keep `AGRO_NVM_VERSION` as an alias for one release, or does the rename break at once?
4. Does a console bootstrap step after `install_agro` run `node` or `npm` from PATH? US-005 assumes that no step does. `agro tool install docker-engine` is the step to check.
5. Does AGRO support macOS hosts for `install.sh` now? The macOS row assumes support.
6. Does a host with a distribution Node 20 or later also get the private runtime? That choice removes the distribution-upgrade row from the table.

## Acceptance Criteria
- [ ] The operator records a choice for Open Question 1 before any story starts.
- [ ] Each story in this plan has every acceptance criterion checked.
- [ ] `git grep -n -i 'install_node_via_nvm\|AGRO_NVM_VERSION'` prints no line in `mifunedev/agro`.
- [ ] `git grep -n 'nvm.sh' -- packages infra` prints no line in `mifunedev/agro-console`.
- [ ] Row `R02b-noninteractive-cli` passes on a fresh VM with the release that ships US-001.
- [ ] Each row of the environment table has one transcript in `evidence/manual-review.md`, or the row names a reason.

## Lessons

Filled by the advisor before undraft.
