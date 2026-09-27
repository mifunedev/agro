# PRD: Node host tools

Status: BLOCKED

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` has the optional field `hostInstallUser?: "root"`. The 7 existing entries do not set the field, and their tests pass unchanged.
- [ ] If the invoking uid is 0, `installOnHost` runs the root-level installer argv without `sudo`.
- [ ] If the invoking uid is not 0, `installOnHost` runs `sudo -n true` first. If that probe exits 0, `installOnHost` runs the installer as `sudo -n -- <argv>`.
- [ ] If `sudo -n true` exits non-zero, `agro tool install <id> --host` exits 1. The message names `<id>` and states that `<id>` needs passwordless `sudo`.
- [ ] After that refusal, the runner records no installer call, and the host `agro.json` has no new `hostTools` entry.
- [ ] `agro tool list` shows a `HOST` column with the value `root`, `user`, or `no` for each tool. `agro tool list --json` gives each row a boolean `hostRoot`.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers uid 0, a user whose `sudo -n true` exits 0, and a user whose `sudo -n true` exits 1.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, no `hostInstallUser`, and a non-null `uninstallArgv`.
- [ ] The install script pins code-server `4.129.0` and runs `sha256sum -c -` on the release tarball. The pinned hashes are `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0` and `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script extracts the tarball to `${NPM_USER_PREFIX:-$HOME/.local}/lib/code-server-4.129.0`. The script links `${NPM_USER_PREFIX:-$HOME/.local}/bin/code-server` to `bin/code-server` inside that directory.
- [ ] On a Linux host, after `agro tool install code-server --host`, `$HOME/.local/bin/code-server --version` prints a first line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` asserts the pinned version, both hashes, the architecture refusal, and the link path.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, and no sandbox `installArgv`.
- [ ] The script adds Docker's apt repository for Ubuntu with the key at `/etc/apt/keyrings/docker.asc`. The script checks the key fingerprint `<docker apt key fingerprint>` before it writes the source list.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin`.
- [ ] The script adds `${SUDO_USER:-$(id -un)}` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] On an Ubuntu 24.04 host, after the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] On the same host, `docker compose version` exits 0 for the invoking user.
- [ ] If a sandbox is reachable, `agro tool install docker` exits 1, and the message names `access.dockerSocket`.
- [ ] If `verifyArgv` finds `docker` and `docker compose version` exits 0, a second install prints `docker: already installed (docker)`, exits 0, and runs no installer.
- [ ] The test "keeps docker-cli distinct from the docker RUNTIME" asserts that `findTool("docker")` is host-only, instead of undefined.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, and no sandbox `installArgv`.
- [ ] If `command -v tailscale` exits non-zero on the host `PATH`, the command exits 1 before the `sudo` probe. The message names `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `~/.xsession` of `${SUDO_USER:-$(id -un)}`, runs `adduser xrdp ssl-cert`, and runs `systemctl enable --now xrdp`.
- [ ] After the install and `sudo tailscale up`, TCP 3389 accepts connections on the Tailscale address. TCP 3389 refuses connections on the public address.
- [ ] The script contains no `ufw allow` rule for port 22, no `ufw` rule that names `ssh`, and no `passwd` or `chpasswd` call.
- [ ] On success, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`, with `<user>` replaced by the invoking user.
- [ ] The script follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`. The pull request body names each step and the script lines that implement it.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `--ref <v>` and `--ref=<v>`. A missing value exits 1.
- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist, the command exits 1, the message names `<ref>`, and the target directory does not exist afterwards.
- [ ] Without `--ref`, the command runs `git clone https://github.com/mifunedev/agro.git <target>` exactly as it does now.
- [ ] `docs/lifecycle-commands.md` documents `--ref` in the verb table and in the section "Host workspaces".
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and name `docker` and `desktop` as root-level tools.
- [ ] The two documents state that `agent-browser` has a host install, to match `TOOL_CATALOG`.
- [ ] The `## [Unreleased]` section of `CHANGELOG.md` has one entry for each of US-001 to US-005.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `/eval` reports no `REGRESSION` in `.agro/evals/RESULTS.md`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the commands and exit codes for US-002 to US-005 on an Ubuntu 24.04 host. Each check that did not run shows `NOT RUN` and the reason.
- [ ] After merge, the `/release` procedure publishes AGRO `0.15.0`, and the GitHub Release `v0.15.0` exists.

## Summary

The operator's issue `work/issue-1168.md` supplies the stories. `mifunedev/agro-console` builds each node on this CLI; its plan is `agro-node-base`.

Verified current state:

- `agro tool install <id>` sends the install to the host through `installOnHost` when no sandbox is reachable. `installOnHost` installs into `~/.local` and writes a `hostTools` receipt.
- `runToolInstall` refuses any entry without `installArgv` before it checks the sandbox. A host-only tool needs a change to that order.
- `LocalExecutionTarget.argvFor` uses `sudo --` for `stdio: "inherit"` and `sudo -n --` for captured execs. The host install uses `stdio: "inherit"`, so `tool.ts` must build the `sudo -n` argv itself.
- `tool-catalog.test.ts` forbids `apt`, `dpkg -i`, and `sudo` in every `hostInstallArgv`. The test also requires `findTool("docker")` to be undefined.
- `agent-browser` has a `hostInstallArgv` in the catalog. `docs/lifecycle-commands.md` says the opposite. The issue summary repeats the stale claim.
- `docker-cli` is `kind: "baked-in"` with `hostCapable: false`. No tool installs Docker Engine.
- `tailscale` is host-capable. The host install puts `tailscale` and `tailscaled` in `~/.local/bin`, for userspace networking.
- `ensureHostWorkspace` clones `AGRO_REPO_URL` through `cloneInto` or `cloneThroughStaging`. No ref option exists.
- `package.json` has version `0.14.0`.

Selected approach: add one catalog field for root-level host installs, and add one `sudo -n` gate in `installOnHost`. Add three catalog entries. Pass an optional ref through `ensureHostWorkspace` to `git clone --branch`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `resolveToolInstallArgv`, `installableToolIds` | Adds `hostInstallUser`, plus the `code-server`, `docker`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `renderTable`, `renderDetail`, `rowOf` | Adds the host-only gate, the `sudo -n` probe and wrap, the `desktop` prerequisite, and the `HOST` column. |
| `.agro/cli/src/lib/execution/local-target.ts` | `argvFor` | Read only. The interactive path selects `sudo --`, so `tool.ts` builds the argv. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | Adds the `ref` option. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | Adds `--branch <ref>` to `git clone`. |
| `.agro/cli/src/cli.ts` | `parseWorkspaceArgs`, workspace help text | Parses and documents `--ref`. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool list, host install text, verb table | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | User-level host install into `~/.local`. |
| `agro tool install docker --host` | New tool | Root-level host install through `sudo -n`. |
| `agro tool install desktop --host` | New tool | Root-level host install through `sudo -n`. The `desktop` install requires `tailscale`. |
| `agro tool list` and `agro tool list --json` | Output | Adds the `HOST` column and the `hostRoot` field. |
| `agro workspace create --ref <ref>` | New flag | Clones the named tag or branch. |

## Storage

The existing `hostTools` record in the host `agro.json` records each host install. The `hostTools` receipt keeps its current fields.

## Architectural Decisions

- A dedicated VM can install system packages. `hostInstallUser: "root"` marks those tools. The CLI does not refuse them.
- `tool.ts` owns the `sudo -n` decision for host installs. `local-target.ts` stays unchanged, because the sandbox path depends on its current behavior.
- The scripts find the invoking user through `${SUDO_USER:-$(id -un)}`, because `sudo` removes custom environment variables.
- A host-only tool has no `installArgv`. `runToolInstall` checks `installArgv` only on the sandbox path. The host path checks `resolveToolInstallArgv(entry, true)`.
- The `docker` entry keeps the id `docker` in `TOOL_CATALOG`. The runtime `docker` in `RUNTIME_CATALOG` belongs to `agro sandbox install`, a different verb.
- `docker` and `desktop` get `uninstallArgv: null`. `agro tool uninstall` refuses them. Open question 3 covers this decision.
- A tool that needs an interactive credential stops before that step and prints the step.
- The `desktop` tool never exposes RDP on the public address.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new ids; `hostInstallUser` only on `docker` and `desktop`; apt and `sudo` ban limited to user-level host installers; code-server pin, hashes, arch refusal, link path; `findTool("docker")` host-only | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | uid 0 runs without `sudo`; `sudo -n true` exit 0 wraps the argv; exit 1 refuses with no installer call and no receipt; `HOST` column and `hostRoot` | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | `docker` with a reachable sandbox refuses and names `access.dockerSocket`; second `docker` install exits 0 with no installer call | US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | `desktop` without `tailscale` exits 1 before `sudo`; success output names `sudo tailscale up` and `sudo passwd <user>` | US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.15.0` clone argv; missing ref exits 1 with no target directory; no `--ref` keeps the current argv; parser cases | US-005 |
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | `ensureHostWorkspace` passes `--branch <ref>` on both clone paths | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts` | docs name the new tools and `--ref` | US-006 |
| Ubuntu 24.04 host, manual | commands and exit codes in `## Host install evidence` | US-002 to US-005 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Each install is idempotent. `verifyArgv` gates a second run.
- A refusal changes nothing on the host.
- The CLI never sets a password and never runs `tailscale up`.
- Tracked code gets no comments.

## Out of Scope

- A Tailscale auth-key flow.
- A firewall policy beyond port 3389.
- Hosts other than Ubuntu.
- An uninstall path for `docker` and `desktop`.
- Changes to `local-target.ts` or to the sandbox install path.

## Open Questions

1. The host `tailscale` tool runs `tailscaled` in userspace mode from `~/.local/bin`. That mode creates no `tailscale0` interface, and `sudo tailscale up` expects a system daemon. How does `desktop` reach xrdp over Tailscale?
   A. `desktop` requires the Ubuntu `tailscale` package and a running `tailscaled.service`, and the prerequisite check tests both. (Recommended.)
   B. `desktop` installs the Ubuntu `tailscale` package itself.
   C. Other: <specify>
2. How does the script restrict TCP 3389 to the Tailscale address? Enabling `ufw` with a default deny policy blocks SSH, and US-004 forbids SSH rule changes.
   A. Add `iptables` INPUT rules that accept 3389 on `tailscale0` and drop 3389 on other interfaces, and persist the rules. (Recommended.)
   B. Bind xrdp to the Tailscale address. That address exists only after `tailscale up`, so the install order changes.
   C. Other: <specify>
3. Does `agro tool uninstall docker --host` or `agro tool uninstall desktop --host` remove packages?
   A. No. `uninstallArgv` is `null`, and the command refuses. (Recommended.)
   B. Yes. The command purges the packages it installed.
4. What is the Docker apt key fingerprint that the script checks? The issue does not give it. The plan uses `<docker apt key fingerprint>`.
5. If the target already holds a checkout, what does `agro workspace create --ref <ref>` do?
   A. Exit 1 when `HEAD` differs from `<ref>`, and name both values. (Recommended.)
   B. Reuse the checkout and print a warning.
   C. Reuse the checkout silently, as the command does now.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request `FROM feat/1168-node-host-tools TO development`.

## Lessons

Filled by the advisor before undraft.
