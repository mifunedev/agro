# PRD: Node host tools

Status: BLOCKED

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains the optional field `hostPrivilege?: "user" | "root"`. An entry without the field keeps the `"user"` behavior.
- [ ] `ToolOptions` gains an injectable `getuid` so that tests control the invoking user.
- [ ] If the invoking user has uid 0, `installOnHost` runs a root-level script without `sudo`.
- [ ] If the invoking user has a non-zero uid, `installOnHost` first runs `sudo -n true`, then runs the root-level script as `sudo -n --preserve-env=NPM_USER_PREFIX bash -lc <script>`.
- [ ] If `sudo -n true` exits non-zero, the command exits 1. The message names the tool and states that the tool needs passwordless `sudo`. The runner records no install call and `hostTools` gains no receipt.
- [ ] `runToolInstall` routes a tool with `hostInstallArgv` and no `installArgv` to `installOnHost`. The `cannot be installed by this command` refusal applies only to a tool with neither argv.
- [ ] `agro tool list` prints `root` in the table for each root-level host tool, and the detail view prints `  root-level: yes`.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers uid 0, a user with passwordless `sudo`, and a user without passwordless `sudo`. Each case fails before the change and passes after the change.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `hostCapable: true`, no `hostPrivilege: "root"`, a `hostInstallArgv`, and an `uninstallArgv`.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` returns a value other than `amd64` or `arm64`, the script exits non-zero and prints the architecture.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to `$HOME/.local/lib/code-server-4.129.0/bin/code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes `$HOME/.local/bin/code-server` and `$HOME/.local/lib/code-server-4.129.0`.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` asserts the version, both hashes, the architecture refusal, and the uninstall paths.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostPrivilege: "root"`, a `hostInstallArgv`, and no `installArgv`.
- [ ] The `docker-cli` entry stays `kind: "baked-in"` and `hostCapable: false`.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from `https://download.docker.com/linux/ubuntu`, and apt verifies the packages against the Docker repository key.
- [ ] The script adds `$SUDO_USER` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 and `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0 and runs no install script.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostPrivilege: "root"`, a `hostInstallArgv`, and no `installArgv`.
- [ ] If `command -v tailscale` fails for the invoking user, the command exits 1 and prints `agro tool install tailscale --host`. The runner records no `sudo` call.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `~$SUDO_USER/.xsession`, adds `xrdp` to the `ssl-cert` group, and enables `xrdp`.
- [ ] After the install, TCP 3389 accepts connections on the Tailscale address and refuses connections on the public address.
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On success, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that the workspace of a node matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` accepts `--ref <v>` and `--ref=<v>`, and rejects a missing value.
- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist, the command exits 1, prints the ref, and leaves no target directory.
- [ ] Without `--ref`, the runner receives the same `git clone` argv as today.
- [ ] `docs/lifecycle-commands.md` and `printWorkspaceHelp` document `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and name `docker` and `desktop` as root-level.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for each of US-001 to US-005.
- [ ] `npm test`, `npm run typecheck`, and the `/eval` probe suite exit 0.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the command and exit code of each host check in US-002 to US-005 on an Ubuntu 24.04 host. Each check that did not run shows `NOT RUN` and the reason.
- [ ] The `/release` procedure publishes AGRO `0.15.0`, and `package.json` and `.agro/cli/package.json` read `0.15.0`.

## Summary

Source: `work/issue-1168.md`. The console plan `agro-node-base` in `mifunedev/agro-console` builds each node on this CLI.

Verified current state:

- `ToolEntry` has `installUser?: "root" | "sandbox"` for the sandbox exec. No field marks a host install as root-level.
- `installOnHost` in `.agro/cli/src/commands/tool.ts` runs `resolveToolInstallArgv(entry, true)` as the invoking user with `NPM_USER_PREFIX=~/.local`. It records a `HostHarnessReceipt` under `hostTools`.
- `runToolInstall` refuses each entry without `installArgv` before it checks the sandbox. A host-only tool needs a change to that gate.
- `runToolInstall` calls `installOnHost` only when the sandbox is unreachable.
- `docker-cli` is `baked-in` and `hostCapable: false`. No entry installs Docker Engine.
- `tailscale` installs `tailscale` and `tailscaled` into `~/.local/bin` with no system service.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone AGRO_REPO_URL <target>` and has no ref argument. `cloneThroughStaging` removes its staging directory on failure.
- `package.json` and `.agro/cli/package.json` read `0.14.0`.

Selected approach: add one privilege field to the catalog and one `sudo -n` branch to `installOnHost`. Add three catalog entries and one `--ref` flag that `ensureHostWorkspace` passes to `git clone --branch`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `resolveToolInstallArgv` | `hostPrivilege` field; `code-server`, `docker`, `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `installOnHost`, `runToolInstall`, `renderTable`, `renderDetail`, `ToolOptions` | `sudo -n` preflight and wrap; host-only routing; root-level marker. |
| `.agro/cli/src/commands/workspace.ts` | `parseWorkspaceArgs`, `runWorkspaceCreate`, `WorkspaceOptions` | `--ref` parse and pass-through. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | `git clone --branch <ref>`. |
| `.agro/cli/src/cli.ts` | `workspace` dispatch, `printWorkspaceHelp`, tool help | Pass `ref`; document `--ref` and the new tools. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | Pinned user-level install into `~/.local`. |
| `agro tool install docker --host` | New tool | Root-level install through `sudo -n`. |
| `agro tool install desktop --host` | New tool | Root-level install through `sudo -n`. |
| `agro tool list` | Output | Marks root-level tools. |
| `agro workspace create --ref <ref>` | New flag | Clones at a tag or a branch. |
| `mifunedev/agro-web` | Docs | Mirror the new tools and `--ref` if the public site lists tools or verbs. |

## Storage

N/A. The existing `hostTools` record in the host `agro.json` stores each host install receipt. The change adds no schema field.

## Architectural Decisions

- The catalog owns privilege. `installOnHost` reads `hostPrivilege` and never infers privilege from a script.
- The CLI runs `sudo -n` and never prompts for a password. A missing passwordless `sudo` fails before any change.
- A root-level script reads the invoking user from `SUDO_USER`.
- A tool that needs an interactive credential stops before the credential step and prints the step.
- The desktop tool never exposes RDP on the public address.
- Host commands run on the host. Tests inject the runner, `getuid`, and platform, and run no real `sudo`, `apt`, or `git`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries, `hostPrivilege` values, pinned version and hashes, `docker-cli` unchanged | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | uid 0, passwordless `sudo`, no `sudo`, host-only routing, list marker | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | `docker` refusal inside the sandbox names `access.dockerSocket`; second install runs no script | US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | `desktop` refusal without `tailscale` records no `sudo` call; success prints both operator steps | US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` parse, tag clone argv, missing ref leaves no directory, default argv unchanged | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts` | docs list the new tools and `--ref` | US-006 |
| Ubuntu 24.04 host, manual | commands and exit codes from US-002 to US-005 | PR evidence |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent.
- Fail before any change when a prerequisite is missing.
- Add no comments to tracked code.
- Keep one source of truth: the catalog entry holds the script, the version, and the hashes.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.
- A root-level uninstall for `docker` and `desktop`.
- A `--ref` value that names a commit SHA.

## Open Questions

1. The `tailscale` host tool installs userspace binaries into `~/.local/bin` with no system service. The desktop step `sudo tailscale up` needs a system `tailscaled` and a `tailscale0` interface. Which option does `desktop` require?
   A. `desktop` requires a system Tailscale install and checks for `tailscaled.service`.
   B. `tailscale --host` gains a root-level system install.
   C. Other: <specify>
2. Which mechanism restricts TCP 3389 to the Tailscale address before `sudo tailscale up` runs?
   A. A `ufw` rule that allows 3389 on `tailscale0` and denies 3389 elsewhere.
   B. The `xrdp.ini` bind address.
   C. Other: <specify>
3. The plan cites the runbook steps 3 to 6 but has not read the runbook. The implementation owner must read the runbook and confirm the package list and the firewall step.
4. If the target of `agro workspace create --ref <ref>` already holds a checkout, does the command refuse, reuse the checkout, or check out `<ref>`?
4. The target of `agro workspace create --ref <ref>` can already hold a checkout. For that case, does the command refuse, reuse the checkout, or check out `<ref>`?

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] AGRO `0.15.0` has a GitHub release.
- [ ] CI is green on the pull request from `feat/1168-node-host-tools` to `development`.

## Lessons

Filled by the advisor before undraft.
