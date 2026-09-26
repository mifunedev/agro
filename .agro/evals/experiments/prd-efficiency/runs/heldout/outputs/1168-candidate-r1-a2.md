# PRD: Node host tools

Status: DRAFT

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want root-level host installs through `sudo` so that a VM gets system packages from `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains a field that marks a host install as root-level. Existing entries keep their behavior.
- [ ] If the invoking user is not root, `runToolInstall` in `.agro/cli/src/commands/tool.ts` runs the host script of a root-level tool through `sudo -n`.
- [ ] If the invoking user is root, the host script runs without `sudo`.
- [ ] If `sudo -n true` fails, the command exits 1, names the tool, and states that the tool needs passwordless `sudo`. The command writes no `hostTools` receipt and runs no script.
- [ ] `agro tool list` marks each root-level host tool.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`.

### US-002: Add the code-server tool

**Description:** As an operator, I want a `code-server` host tool so that `agro` owns the code-server version on each node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `hostCapable: true` and an `uninstallArgv`. The entry installs for the invoking user and is not root-level.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If the architecture is not `amd64` or `arm64`, the script exits non-zero and names the architecture.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to the `code-server` binary in the extracted directory.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.

### US-003: Add the docker tool

**Description:** As an operator, I want a `docker` host tool so that each node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry that is host-capable and root-level.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from the Docker apt repository for Ubuntu. The script checks the repository key.
- [ ] The script adds the invoking user to the `docker` group and enables the `docker` service.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 and `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` refuses with a message that names `access.dockerSocket`.
- [ ] A second install exits 0 and changes nothing.

### US-004: Add the desktop tool

**Description:** As an operator, I want a `desktop` host tool so that a node serves an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry that is host-capable and root-level.
- [ ] If `tailscale` is not installed, the command exits 1 and names `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`. The script writes `xfce4-session` to the `.xsession` file of the invoking user, adds `xrdp` to `ssl-cert`, and enables `xrdp`.
- [ ] After the install, TCP 3389 accepts connections on the Tailscale address and refuses connections on the public address.
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows steps 3 to 6 of the runbook that the issue names at ryaneggz/runbooks.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <ref>` so that a node workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` clones `https://github.com/mifunedev/agro.git` at `<ref>`.
- [ ] If `<ref>` does not exist, the command exits 1, names the ref, and leaves no target directory.
- [ ] Without `--ref`, the command keeps its current behavior.
- [ ] `docs/lifecycle-commands.md` documents `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and state which tools are root-level.
- [ ] `CHANGELOG.md` has entries for US-001 to US-005.
- [ ] `npm test`, `npm --prefix .agro/cli run typecheck`, and the eval probes pass.
- [ ] The pull request body has a `## Host install evidence` section with the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. The section lists each check that did not run as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

The `ToolEntry` interface has `hostCapable`, `hostInstallArgv`, `hostUninstallArgv`, and `installUser`. The `installUser` field selects the sandbox exec user and has no host meaning. The `cloudflared` entry checks a pinned SHA-256 per architecture in an inline `bash -lc` script. The `runToolInstall` function refuses each tool with `hostCapable: false`. The function records each host install in `hostTools` in the host config. The `docker-cli` entry is not host-capable, and no entry installs Docker Engine. The `runWorkspaceCreate` function calls `ensureHostWorkspace` and has no ref option. The root `package.json` and `.agro/cli/package.json` hold version `0.14.0`.

The plan adds one root-level marker, a `sudo -n` preflight, three catalog entries, and a `--ref` option.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `hostCapableToolIds` | Root-level field and the `code-server`, `docker`, `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `renderTable`, `renderDetail` | `sudo -n` preflight and the root-level marker in `agro tool list`. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | `--ref` option. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `AGRO_REPO_URL` | Clone at a ref. |
| `.agro/cli/src/cli.ts` | workspace argument parsing and help text | `--ref` flag. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |
| `package.json`, `.agro/cli/package.json` | `version` | Release `0.15.0`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | User-level host install. |
| `agro tool install docker --host`, `agro tool install desktop --host` | New tools | Root-level host installs through `sudo -n`. |
| `agro workspace create --ref <ref>` | New flag | Clone at a pinned ref. |
| `agro tool list` | Output | Marks root-level tools. |

## Storage

The existing `hostTools` record in the host config holds each host install receipt. The plan adds no new store.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools as root-level and does not refuse them.
- The root-level marker is a new field. The plan does not reuse `installUser`, because `installUser` selects the sandbox exec user.
- The `sudo -n` preflight runs before any script runs, so a refusal changes nothing.
- A tool that needs interactive credentials stops before the credential step and prints that step.
- The desktop tool never exposes RDP on the public address.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries, root-level marker, pinned hashes, architecture refusal | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user, passwordless `sudo`, `sudo` refusal, list marker, docker refusal in the sandbox, desktop refusal without `tailscale` | US-001, US-003, US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` tag, missing ref, no `--ref` | US-005 |

The tests go in the tracked files above. The commands test directory that the issue names does not exist.

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Each install is idempotent.
- Add no comments to tracked code.
- Follow the pinned-checksum pattern of the `cloudflared` entry.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Hosts that do not run Ubuntu.
- A host install of `docker-cli` or `gh`.

## Open Questions

1. Which test proves the host checks of US-002 to US-004? The plan uses manual evidence in the pull request body. CI runs no Ubuntu 24.04 host install.
2. Does the `docker` sandbox refusal replace the generic "not host-capable" path, or does the refusal add a sandbox check? The plan assumes a sandbox check with the `access.dockerSocket` message.
3. Does `--ref` apply to an existing workspace clone? The plan assumes that `--ref` applies only to a new clone.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host`, `agro tool install code-server --host`, and `agro workspace create --ref v0.15.0` each exit 0.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
