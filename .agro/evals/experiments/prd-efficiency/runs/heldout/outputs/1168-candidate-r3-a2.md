# PRD: Node host tools

Status: DRAFT

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want root-level host installs through sudo so that a dedicated VM gets system packages.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains a `hostRoot` boolean field. Each existing entry keeps its current behavior.
- [ ] If the invoking user is not root, a root-level host install runs its script through `sudo -n`.
- [ ] If the invoking user is root, a root-level host install runs its script without `sudo`.
- [ ] If `sudo -n true` fails, the command exits 1 and changes nothing. The message names the tool and states that the tool needs passwordless `sudo`.
- [ ] `agro tool list` marks each root-level host tool.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`.

### US-002: Add the code-server tool

**Description:** As an operator, I want a code-server host tool so that agro owns the code-server version on each node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `hostCapable: true`, a non-null `uninstallArgv`, and no root-level marker.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If the architecture is not `amd64` or `arm64`, the script exits non-zero and prints the architecture name.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to the code-server binary in the bin directory of that tree.
- [ ] On a Linux host, after `agro tool install code-server --host`, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.

### US-003: Add the docker tool

**Description:** As an operator, I want a docker host tool so that each node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true` and the US-001 root-level marker.
- [ ] The script adds the Docker apt repository for Ubuntu with a checked repository key.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from that repository.
- [ ] The script adds the invoking user to the `docker` group and enables the `docker` service.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] After the install and a new login, `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0 and changes no package, group, or service state.

### US-004: Add the desktop tool

**Description:** As an operator, I want a desktop host tool so that a node serves an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true` and the US-001 root-level marker.
- [ ] If `tailscale` is not on the `PATH`, the command exits 1 and prints `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to the `.xsession` file in the home directory of the invoking user.
- [ ] The script adds the `xrdp` user to the `ssl-cert` group and enables the `xrdp` service.
- [ ] After the install, TCP port 3389 accepts connections on the Tailscale address and refuses connections on the public address.
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows steps 3 to 6 of the runbook at `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want a ref option on workspace create so that the node workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` clones `AGRO_REPO_URL` at `<ref>`.
- [ ] If `<ref>` does not exist, the command exits 1, prints the ref, and leaves no target directory.
- [ ] Without `--ref`, the command keeps its current behavior.
- [ ] `docs/lifecycle-commands.md` documents `--ref`.
- [ ] `.agro/cli/src/lib/__tests__/host-workspace.test.ts` and `.agro/cli/src/__tests__/workspace.test.ts` cover a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the new tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`.
- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` state which tools are root-level.
- [ ] `CHANGELOG.md` has entries for US-001 to US-005.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] The eval probes pass under /eval.
- [ ] The pull request body has a `## Host install evidence` section with the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host.
- [ ] Each check in that section that did not run shows `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

Verified current state:

- `ToolEntry` has `hostCapable`, `installUser`, `hostInstallArgv`, and `hostUninstallArgv`. No field marks a host install as root-level.
- Each installer is an inline `bash -lc` script in `TOOL_CATALOG`. The `tailscale` entry shows the pinned tarball and SHA-256 pattern.
- The host install path in `.agro/cli/src/commands/tool.ts` starts near line 385. That path refuses non-Linux hosts and entries without `hostCapable`.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone` of `AGRO_REPO_URL` with no ref.
- `package.json` and `.agro/cli/package.json` hold version `0.14.0`.

Approach: add one root-level marker to `ToolEntry`, and add a `sudo -n` preflight to the host install path. Add three catalog entries that follow the `tailscale` pattern. Pass an optional ref from `workspace create` to `ensureHostWorkspace`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `resolveToolInstallArgv` | Root-level field and the `code-server`, `docker`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | host install path near line 385, list output near line 293 | `sudo -n` preflight and wrap; root-level marker in `agro tool list`. |
| `.agro/cli/src/commands/workspace.ts` | `create` handler near line 98 | Parse `--ref` and pass the ref on. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `AGRO_REPO_URL` | Clone at the ref. Remove the target directory when the clone fails. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | Per-user install into `$HOME/.local`. |
| `agro tool install docker --host` | New tool | Root-level install through `sudo -n`. |
| `agro tool install desktop --host` | New tool | Root-level install through `sudo -n`. |
| `agro workspace create --ref <ref>` | New flag | Clone at a tag or branch. |
| `agro tool list` | Output | Marks each root-level tool. |

## Storage

N/A. The existing `hostTools` record in the host `agro.json` file records each host install, and this task adds no new state record.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools as root-level. The CLI does not refuse them.
- `sudo -n` is the only privilege path. The CLI never prompts for a password, so an unattended run cannot hang.
- A tool that needs an interactive credential stops before the credential step and prints that step.
- The desktop tool never exposes RDP on the public address.
- The ref passes to `git clone --branch`, so a tag and a branch both resolve.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries, root-level marker, pinned version and hashes, `uninstallArgv` for `code-server` | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user, passwordless `sudo`, no `sudo` refusal, list marker, `docker` refusal in the sandbox | US-001, US-003 |
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | clone with a ref, missing ref leaves no directory, clone without a ref | US-005 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` parse and pass-through, default without `--ref` | US-005 |

Manual host checks for US-002 to US-005 run on an Ubuntu 24.04 VM. The PR body records the results.

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Each install is idempotent.
- Each download has a pinned version and a checked hash or a checked key.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Hosts that are not Ubuntu.
- A password prompt for `sudo`.

## Open Questions

1. The `docker` refusal in the sandbox must name `access.dockerSocket`. The grounding did not locate the source of that key. Confirm the key name and the file that defines the key.
2. The desktop script must bind port 3389 to the Tailscale address. Choose one method: an `xrdp.ini` address setting, or a `ufw` rule. The issue forbids SSH rule changes only.
3. The US-006 release step runs through /release after merge. Confirm that the release is part of this task and not a follow-up.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] AGRO `0.15.0` is on the GitHub releases page.
- [ ] CI is green on the pull request from feat/1168-node-host-tools to development.

## Lessons

Filled by the advisor before undraft.
