# PRD: Node host tools and a pinned workspace ref

Status: BLOCKED

Issue: [#1168](https://github.com/mifunedev/agro/issues/1168)

Branch: `feat/1168-node-host-tools`. Pull request: `FROM feat/1168-node-host-tools TO development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo -n` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` has a new optional field that marks a host install as root-level. Each existing entry omits the field, and the existing tests in `tool-catalog.test.ts` and `tool.test.ts` pass without edits to their existing expectations.
- [ ] If the invoking user is root, `agro tool install <root-level id> --host` runs the host script without `sudo`.
- [ ] If the invoking user is not root and `sudo -n true` exits 0, the command runs the host script as `sudo -n -- <argv>`.
- [ ] If the invoking user is not root and `sudo -n true` exits non-zero, the command exits 1. The command prints a message that names the tool and states that the tool needs passwordless `sudo`. The command runs no installer and writes no `hostTools` record.
- [ ] `runToolInstall` admits a tool that has a host installer and no sandbox installer on the host path. The sandbox path still refuses that tool and prints its refusal reason.
- [ ] `agro tool list` marks each root-level tool in the table output, and each `--json` row carries a boolean field for the marker.
- [ ] `.agro/evals/probes/agent-browser-host-boundary.sh` and the "keeps every host installer clear of the operating system package manager" case in `tool-catalog.test.ts` still reject `apt`, `dpkg -i`, and `sudo` in each host installer that is not root-level.
- [ ] Unit tests in `.agro/cli/src/__tests__/tool.test.ts` cover three users: root, a user with passwordless `sudo`, and a user without passwordless `sudo`.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, no root-level marker, and a non-null `uninstallArgv`.
- [ ] The install script pins code-server `4.129.0` and runs `sha256sum -c -` against the release tarball. The pinned SHA-256 for `amd64` is `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`. The pinned SHA-256 for `arm64` is `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` returns a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script extracts the tarball to `$NPM_USER_PREFIX/lib/code-server-4.129.0` and links `$NPM_USER_PREFIX/bin/code-server` to `bin/code-server` in that directory. On the host, `$NPM_USER_PREFIX` is `$HOME/.local`.
- [ ] The "lands every downloaded binary in NPM_USER_PREFIX behind a sha256 check" case in `tool-catalog.test.ts` lists `code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a first line that starts with `4.129.0`.
- [ ] After `agro tool uninstall code-server --host`, neither `$HOME/.local/bin/code-server` nor `$HOME/.local/lib/code-server-4.129.0` exists.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, the root-level marker (US-001), and a host installer.
- [ ] The host script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from `https://download.docker.com/linux/ubuntu`. The script checks the repository key fingerprint against a pinned value before the script writes the apt source.
- [ ] The script adds the invoking user to the `docker` group and runs `systemctl enable --now docker`. The script takes the invoking user from `SUDO_USER`. If `SUDO_USER` is empty, the script takes the output of `id -un`.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] After the install and a new login, `docker compose version` exits 0 for the invoking user.
- [ ] If the sandbox is reachable, `agro tool install docker` exits 1 and prints a message that names `access.dockerSocket`.
- [ ] If Docker Engine, the Compose plugin, and the `docker` group membership are present, a second `agro tool install docker --host` exits 0, prints `docker: already installed`, and runs no installer.
- [ ] `docs/lifecycle-commands.md` states the difference between the `docker` tool (host Docker Engine) and the `docker-cli` tool (the CLI in the sandbox image).

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, the root-level marker (US-001), and a host installer.
- [ ] If `tailscale` is not installed, `agro tool install desktop --host` exits 1, prints `agro tool install tailscale --host`, and runs no installer. The detection method depends on Open Question 1.
- [ ] The host script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The host script writes `xfce4-session` to `~/.xsession` in the home directory of the invoking user. The file is owned by the invoking user.
- [ ] The host script adds the `xrdp` user to the `ssl-cert` group and runs `systemctl enable --now xrdp`.
- [ ] After the install, a TCP connection to port 3389 on the Tailscale address succeeds. A TCP connection to port 3389 on the public address fails. The mechanism depends on Open Question 2.
- [ ] The host script adds, removes, and changes no firewall rule for port 22. The host script sets no password.
- [ ] On success, the command prints two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`, with `<user>` replaced by the invoking user.
- [ ] The host script follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <ref>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `--ref <ref>` and `--ref=<ref>` for `create`. The parser rejects `--ref` for `list` and rejects an empty `--ref` value.
- [ ] `agro workspace create [<name>] --ref <ref>` clones `https://github.com/mifunedev/agro.git` and checks out `<ref>` in the target directory.
- [ ] If `<ref>` does not exist in the remote, the command exits 1, prints the ref, and leaves no target directory. If the target directory existed empty before the command, the directory stays empty.
- [ ] Without `--ref`, the command runs `git clone https://github.com/mifunedev/agro.git <target>` with no other arguments, as before.
- [ ] The command handles an existing checkout with `--ref` as Open Question 3 decides.
- [ ] `agro workspace --help` and `docs/lifecycle-commands.md` document `--ref`.
- [ ] Unit tests in `.agro/cli/src/__tests__/workspace.test.ts` cover a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and state which tools are root-level.
- [ ] `agro tool --help` in `.agro/cli/src/cli.ts` states that a root-level tool needs root or passwordless `sudo`.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for each of US-001 to US-005, each linked to `#1168`.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the command and exit code of each host check in US-002 to US-005 on an Ubuntu 24.04 host. The section lists each check that did not run as `NOT RUN` with the reason.
- [ ] After the operator merges the work to `main` with root `package.json` and `.agro/cli/package.json` at `0.15.0`, the release workflow publishes AGRO `0.15.0`.

## Summary

Verified current state, from the repository at commit `de2c33c`:

- `TOOL_CATALOG` in `.agro/cli/src/lib/tools/catalog.ts` holds `agent-browser`, `herdr`, `cloudflared`, `microsandbox`, `docker-cli`, `gh`, and `tailscale`. Each installable entry installs as `installUser: "sandbox"` into `NPM_USER_PREFIX`.
- `runToolInstall` in `.agro/cli/src/commands/tool.ts` refuses every entry without `installArgv` before the command reaches the host path. A host-only tool cannot install today.
- `--host` does not force a host install. If the sandbox is reachable, `runToolInstall` installs into the sandbox. If the sandbox is not reachable, `installOnHost` runs.
- `installOnHost` runs the host argv as the invoking user with no `user` field. `LocalExecutionTarget` in `.agro/cli/src/lib/execution/local-target.ts` maps `user: "root"` to `sudo --` for `stdio: "inherit"` and to `sudo -n --` for `stdio: "capture"`. An inherited root install therefore prompts for a password.
- Three guards forbid `sudo` and the OS package manager in every `hostInstallArgv`: the probe `.agro/evals/probes/agent-browser-host-boundary.sh` (lesson #1078), and two cases in `.agro/cli/src/__tests__/tool-catalog.test.ts`. The test "installs every installable tool as the sandbox user" (#906) requires `installUser: "sandbox"` for each installable entry.
- The `tailscale` tool installs `tailscale` and `tailscaled` into `~/.local/bin` in userspace-networking mode. The tool starts no daemon and installs no systemd unit (`docs/installation.md`).
- The runbook steps 3 to 6 install XFCE and XRDP and enable `xrdp`. XRDP then listens on TCP 3389 on each address. The runbook restricts public access in step 9 with UFW, and installs a system Tailscale service in step 7.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone <AGRO_REPO_URL> <target>`. For an existing empty directory, the function clones through a staging directory. For an existing checkout, the function returns `reused` and clones nothing.
- Root `package.json` and `.agro/cli/package.json` hold version `0.14.0`. `.github/workflows/release.yml` reads the release version from root `package.json` on a push to `main`.
- The `agro-node-base` plan in `mifunedev/agro-console` consumes this CLI. This plan does not read that plan.

Selected approach:

1. Add one root-level marker to `ToolEntry`. `installOnHost` builds `["sudo", "-n", "--", ...argv]` for a root-level tool when the invoking user is not root. A capture-mode `sudo -n true` preflight runs first.
2. Let a tool with a host installer and no sandbox installer reach the host path. Keep its sandbox refusal.
3. Scope the #1078 and #906 guards to entries without the root-level marker. The guards stay unchanged for every existing entry.
4. Add `code-server` as a user-level tool in the shape of `herdr`. Add `docker` and `desktop` as root-level host-only tools.
5. Pass `--branch <ref>` to `git clone` when `--ref` is present.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `hostCapableToolIds` | Root-level field; `code-server`, `docker`, `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable` | Host-only admission, `sudo -n` preflight and argv, list marker, desktop post-install steps. |
| `.agro/cli/src/lib/execution/local-target.ts` | `LocalExecutionTarget` | Read only. The plan does not change its `user: "root"` mapping. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | `ref` option. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | `--branch <ref>` on clone; cleanup after a failed clone. |
| `.agro/cli/src/cli.ts` | `parseWorkspaceArgs`, workspace help, tool help | `--ref` parse and help text. |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | `host_block` | Exclude root-level entries from the package-manager check. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |
| `package.json`, `.agro/cli/package.json` | `version` | `0.15.0` at the release cut. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server` | New tool | User-level install, sandbox and host. |
| `agro tool install docker --host` | New tool | Root-level host install. The sandbox path refuses and names `access.dockerSocket`. |
| `agro tool install desktop --host` | New tool | Root-level host install. The command prints two operator steps on success. |
| `agro tool list`, `agro tool status` | Output | Table marks root-level tools. JSON rows gain a boolean field. |
| `agro tool uninstall code-server --host` | New tool | Removes the link and the extracted directory. |
| `agro tool uninstall docker\|desktop` | New tool | Behavior depends on Open Question 4. |
| `agro workspace create --ref <ref>` | New flag | Clone at a tag, branch, or other ref that `git clone --branch` accepts. |

## Storage

N/A. The plan adds no storage. The existing `hostTools` record in the host `agro.json` records each host install. For a root-level tool, the record keeps the current `HostHarnessReceipt` shape.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools as root-level instead of refusing them. This decision narrows the #1078 boundary: the boundary still holds for every tool without the marker.
- `tool.ts` owns the `sudo -n` argv for a root-level host install. The plan leaves the `user: "root"` mapping in `LocalExecutionTarget` unchanged, so the #906 sandbox behavior stays the same.
- A root-level tool never installs into the sandbox. The sandbox has no passwordless `sudo` (`/etc/sudoers.d/sandbox`).
- The host script resolves the invoking user from `SUDO_USER`, then `id -un`. The script resolves that user's home directory with `getent passwd`, because `sudo` can reset `HOME`.
- Each tool that needs an interactive credential stops before the credential step and prints the step.
- The desktop tool never exposes RDP on the public address.
- `--ref` passes the ref to `git clone --branch`. Git, not `agro`, decides which refs are valid.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | `code-server`, `docker`, `desktop` entries; root-level marker only on `docker` and `desktop`; pinned version and both hashes for `code-server`; package-manager guard scoped to non-root-level entries | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user runs argv without `sudo`; passwordless `sudo` runs `sudo -n -- <argv>`; failed `sudo -n true` exits 1 and runs nothing | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | host-only entry reaches the host path; sandbox path refuses `docker`; `list` marks root-level rows | US-001, US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | `desktop` refuses without `tailscale`; `desktop` prints both operator steps | US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.15.0` clones with `--branch v0.15.0`; missing ref exits 1 and leaves no directory; no `--ref` keeps the current argv; parser cases for `--ref` | US-005 |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | `PASS` with the new entries; `REGRESSION` if a non-root-level host installer gains `apt` or `sudo` | US-001 |
| Ubuntu 24.04 host, manual | commands and exit codes from US-002 to US-005 | US-006 evidence |

## Design Principles

- Agent work stays inside the sandbox. `docker` and `desktop` are host-only, root-level tools.
- One owner: `agro` owns tool versions and install steps. The catalog is the only place for each version and each hash.
- Keep each install idempotent. A second install exits 0 and runs no installer.
- Refuse before a change. A failed preflight changes nothing.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.
- A change to the userspace `tailscale` entry. Open Question 1 can add this change.
- Execution of the release workflow. The operator runs the release after merge through `/release`.

## Open Questions

1. The `desktop` success message prints `sudo tailscale up`. That step needs a system `tailscaled` service and a `tailscale` binary on the `sudo` path. The `tailscale` catalog entry installs a userspace binary in `~/.local/bin` and no service. Which Tailscale does `desktop` require?
   A. A system Tailscale service. `desktop` checks `systemctl is-enabled tailscaled` and names the Tailscale system install, not `agro tool install tailscale --host`.
   B. Extend `agro tool install tailscale --host` to a root-level install with a systemd `tailscaled` unit. This change touches the #858 boundary probe `tailscale-tool-boundary.sh`.
   C. Keep the userspace tool. `desktop` prints the userspace start command instead of `sudo tailscale up`.
   D. Other: <specify>
2. Runbook steps 3 to 6 leave XRDP on each address. The runbook blocks the public address in step 9 with UFW. How does `desktop` refuse TCP 3389 on the public address without a change to an SSH rule?
   A. Add UFW rules for port 3389 only: allow on `tailscale0`, deny elsewhere. The rules take effect only when UFW is active; the script does not enable UFW.
   B. Bind XRDP to the Tailscale address in `/etc/xrdp/xrdp.ini`. The install then requires a connected Tailscale node, so `sudo tailscale up` moves ahead of the install.
   C. Add a persistent `nftables` rule that drops TCP 3389 on each interface except `tailscale0`.
   D. Other: <specify>
3. `agro workspace create --ref <ref>` targets an existing checkout. What does the command do?
   A. Reuse the checkout if `HEAD` resolves to the commit of `<ref>`. Otherwise exit 1 and name both refs. (Recommended.)
   B. Run `git fetch` and `git checkout <ref>` in the existing checkout.
   C. Ignore `--ref` and reuse the checkout, as the command does today.
4. What does `agro tool uninstall` do for `docker` and `desktop`?
   A. Refuse with `uninstallArgv: null` and print the `apt` command that removes the packages. (Recommended.)
   B. Remove the packages with `apt-get purge` through `sudo -n`.
5. The pinned Docker repository key fingerprint is not in the issue. Supply `<docker apt key fingerprint>`, or approve the fingerprint that Docker publishes at `https://docs.docker.com/engine/install/ubuntu/`.
6. The version bump to `0.15.0` and the push to `main` happen outside this pull request, which targets `development`. The `[Unreleased]` section also holds the #1143 pre-release entries, which then ship in `0.15.0`. Confirm that `0.15.0` ships both sets of changes.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] `npm test`, `npm --prefix .agro/cli run typecheck`, and `bash .agro/skills/eval/run.sh` pass with no `REGRESSION`.
- [ ] CI is green on the pull request.
- [ ] AGRO `0.15.0` is released.

## Lessons

Filled by the advisor before undraft.
