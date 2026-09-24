# PRD: Host tools for AGRO nodes

Status: DRAFT

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` gains a field that marks a host install as root-level. Existing entries keep their behavior.
- [ ] If the invoking user is not root, a root-level host install runs its script through `sudo -n`.
- [ ] If `sudo -n true` fails, the command exits 1 and prints a message that names the tool and states that it needs passwordless `sudo`. The command changes nothing.
- [ ] `agro tool list` marks each root-level host tool.
- [ ] Unit tests cover the root user, a user with passwordless `sudo`, and a user without it.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry that installs for the invoking user, with `hostCapable: true` and an `uninstallArgv`.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If the architecture is not `amd64` or `arm64`, the script exits non-zero and names the architecture.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to its `bin/code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry that is host-capable and root-level (US-001).
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from Docker's apt repository for Ubuntu, with the repository key checked.
- [ ] The script adds the invoking user to the `docker` group and enables the `docker` service.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 and `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` refuses with a message that names `access.dockerSocket`.
- [ ] A second install exits 0 and changes nothing.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry that is host-capable and root-level (US-001).
- [ ] If `tailscale` is not installed, the command exits 1 and names `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`, writes `xfce4-session` to the invoking user's `~/.xsession`, adds `xrdp` to `ssl-cert`, and enables `xrdp`.
- [ ] After the install, TCP 3389 accepts connections on the Tailscale address and refuses connections on the public address.
- [ ] The script does not change any SSH firewall rule and does not set a password.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The steps follow `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`, steps 3 to 6.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` clones `https://github.com/mifunedev/agro.git` at `<ref>`.
- [ ] If `<ref>` does not exist, the command exits 1, names the ref, and leaves no target directory.
- [ ] Without `--ref`, the command keeps its current behavior.
- [ ] `docs/lifecycle-commands.md` documents `--ref`.
- [ ] Unit tests cover a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and state which tools are root-level.
- [ ] `CHANGELOG.md` has entries for US-001 to US-005.
- [ ] `npm test`, `npm --prefix .agro/cli run typecheck`, and the eval probes pass.
- [ ] The pull request body has a `## Host install evidence` section with the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. A check that did not run is listed as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

Verified current state:

- `agro tool install <id> --host` installs into `~/.local` for the invoking user. `agent-browser` has no host install because its installer adds system packages (`docs/lifecycle-commands.md`).
- `docker-cli` is baked into the sandbox image and has no host install. No tool installs Docker Engine.
- `tailscale` is host-capable.
- `agro workspace create` clones the default branch of `mifunedev/agro` and has no ref option.
- `mifunedev/agro-console` will build each node on this CLI; see its plan `agro-node-base`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG` | Root-level field; `code-server`, `docker`, `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | host install path | `sudo -n` for root-level tools. |
| `.agro/cli/src/commands/workspace.ts` | `create` | `--ref`. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server\|docker\|desktop` | New tools | Host installs. |
| `agro workspace create --ref` | New flag | Pinned clone. |
| `agro tool list` | Output | Marks root-level tools. |

## Storage

N/A. The existing `hostTools` record in the host `agro.json` records each host install.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools as root-level instead of refusing them.
- Tools that need interactive credentials stop before the credential step and print it.
- The desktop tool never exposes RDP on the public address.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries, root-level marker, pinned hashes | US-001 to US-004 |
| `.agro/cli/src/commands/__tests__/` tool install tests | `sudo -n` path and refusal | US-001 |
| workspace command tests | `--ref` tag, missing ref, default | US-005 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.

## Open Questions

None.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host`, `agro tool install code-server --host`, and `agro workspace create --ref v0.15.0` each exit 0.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

- **The eval probes allowed only user-level host installs.** Evidence: after US-003 and US-004, `tool-catalog-boundary`, `harness-one-door`, and `agent-browser-host-boundary` failed, and the id `docker` collided with the runtime catalog. Outcome: fixed in this PR. The tool is `docker-engine`, and the probes check root-level tools with their own rule.
- **The `tailscale` tool installs a user binary with no `tailscaled` service.** Evidence: its catalog script copies `tailscale` and `tailscaled` to `~/.local/bin` and starts nothing, so `sudo tailscale up` and `tailscale0` do not exist on a VM. Outcome: fixed in this PR. The `desktop` tool installs system Tailscale from Tailscale's apt repository.
- **A host tool install needs an existing workspace.** Evidence: `resolveExistingWorkspace` refuses `agro tool install <id> --host` outside a workspace. Outcome: fixed in this PR. The docs state the rule, and the agro-console bootstrap runs `agro workspace create` first.
- **A root-level host tool gets a user-level receipt, and uninstall refuses it.** Evidence: the `hostTools` receipt records the `~/.local` prefix for `docker-engine` and `desktop`, and both have `uninstallArgv: null`. Outcome: proposed issue, pending operator approval.
- **The public docs do not name the new tools.** Evidence: `mifunedev/agro-web` does not document `code-server`, `docker-engine`, `desktop`, or `workspace create --ref`. Outcome: proposed issue in `mifunedev/agro-web`, pending operator approval.
- **The host installs have not run on a real VM.** Evidence: the sandbox has no systemd and no root. Outcome: dropped from this PR. The agro-console node validation (mifunedev/agro-console#168, US-007) runs them on Ubuntu 24.04.
