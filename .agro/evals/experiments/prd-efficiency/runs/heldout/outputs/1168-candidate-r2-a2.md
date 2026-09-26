# PRD: Node host tools

Status: DRAFT

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want root-level host installs through sudo so that a VM gets system packages from `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` has a new field that marks a host install as root-level. Existing entries keep their behavior.
- [ ] If the invoking user is not root, a root-level host install runs its script through `sudo -n`.
- [ ] If the invoking user is root, a root-level host install runs its script without `sudo`.
- [ ] If `sudo -n true` fails, the command exits 1 and changes nothing. The message names the tool and states that the tool needs passwordless `sudo`.
- [ ] `agro tool list` marks each root-level host tool.
- [ ] Unit tests in `.agro/cli/src/__tests__/tool.test.ts` cover the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`.

### US-002: Add the code-server tool

**Description:** As an operator, I want a code-server host tool so that `agro` owns the code-server version on each node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry that installs for the invoking user, with `hostCapable: true` and an `uninstallArgv`.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball.
- [ ] The `amd64` hash is `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`.
- [ ] The `arm64` hash is `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If the architecture is not `amd64` or `arm64`, the script exits non-zero and names the architecture.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to the code-server binary in the extracted directory.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.

### US-003: Add the docker tool

**Description:** As an operator, I want a docker host tool so that each node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry that is host-capable and root-level.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from the Docker apt repository for Ubuntu.
- [ ] The script checks the key of the Docker apt repository before the package install.
- [ ] The script adds the invoking user to the `docker` group and enables the `docker` service.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] After the install and a new login, `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` refuses with a message that names `access.dockerSocket`.
- [ ] A second install exits 0 and changes nothing.

### US-004: Add the desktop tool

**Description:** As an operator, I want a desktop host tool so that a node serves an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry that is host-capable and root-level.
- [ ] If `tailscale` is not installed, the command exits 1 and names `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to the `~/.xsession` file of the invoking user.
- [ ] The script adds `xrdp` to the `ssl-cert` group and enables the `xrdp` service.
- [ ] After the install, TCP port 3389 accepts connections on the Tailscale address and refuses connections on the public address.
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows steps 3 to 6 of the ubuntu-24-xfce-xrdp-tailscale runbook in the ryaneggz/runbooks repository.

### US-005: Pin the workspace ref

**Description:** As an operator, I want a workspace ref option so that the node workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` clones `AGRO_REPO_URL` at `<ref>`.
- [ ] If `<ref>` does not exist, the command exits 1, names the ref, and leaves no target directory.
- [ ] Without `--ref`, the command keeps its current behavior.
- [ ] `docs/lifecycle-commands.md` documents `--ref`.
- [ ] Unit tests in `.agro/cli/src/__tests__/workspace.test.ts` cover a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the new tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`.
- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` name each root-level tool.
- [ ] `CHANGELOG.md` has entries for US-001 to US-005.
- [ ] `npm test`, `npm run typecheck`, and the eval probes exit 0.
- [ ] The pull request body has a `## Host install evidence` section with the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host.
- [ ] The evidence section lists each check that did not run as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

Verified state:

- `TOOL_CATALOG` in `.agro/cli/src/lib/tools/catalog.ts` holds each tool. Host installs use `hostInstallArgv` and install into the prefix of the invoking user.
- `ToolEntry.installUser` exists as `"root" | "sandbox"`. The field selects the user for a sandbox install.
- `docker-cli` is baked into the sandbox image. No tool installs Docker Engine.
- `tailscale` is host-capable.
- `cloneInto` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone` of `AGRO_REPO_URL` with no ref.

Approach: add one root-level marker to `ToolEntry`. The host install path in `.agro/cli/src/commands/tool.ts` wraps a root-level script in `sudo -n`. Add three catalog entries. Pass an optional ref from `runWorkspaceCreate` to the clone.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG` | Root-level field. New `code-server`, `docker`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | host install path, `runToolList`, `renderTable` | `sudo -n` wrap, sudo preflight, and the root-level marker in the list. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Accepts `--ref`. |
| `.agro/cli/src/lib/host-workspace.ts` | `cloneInto`, `ensureHostWorkspace`, `AGRO_REPO_URL` | Clones at the ref. Removes the staging directory on failure. |
| `.agro/cli/src/cli.ts` | workspace help text | Documents `--ref`. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | Host install for the invoking user. |
| `agro tool install docker --host` | New tool | Root-level host install. |
| `agro tool install desktop --host` | New tool | Root-level host install. |
| `agro workspace create --ref` | New flag | Clones at a pinned ref. |
| `agro tool list` | Output | Marks each root-level tool. |

## Storage

N/A. The existing host tool record in the host configuration records each host install. The task adds no new state.

## Architectural Decisions

- `agro` is the single owner of tool versions and install steps on a node.
- A dedicated VM can install system packages. The catalog marks such a tool as root-level. The CLI does not refuse the tool.
- A tool that needs an interactive credential stops before the credential step. The tool prints the remaining step.
- The desktop tool never exposes RDP on the public address.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries, root-level marker, pinned hashes | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user, `sudo -n` path, sudo refusal, list marker, sandbox refusal for `docker` | US-001, US-003 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` tag, missing ref, no `--ref` | US-005 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent.
- Pin each download by version and SHA-256.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond TCP port 3389.
- Hosts other than Ubuntu.

## Open Questions

1. Does the root-level marker reuse `installUser`, or is it a new field? The plan assumes a new field, because `installUser` controls the sandbox install.
2. How does the desktop script bind port 3389 to the Tailscale address only? Options are an xrdp listen address or a firewall rule. The issue excludes a wider firewall policy.
3. Which files hold the eval probes that US-006 names? The plan runs the /eval suite.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
