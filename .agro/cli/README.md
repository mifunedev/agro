# @mifune/agro

The **AGRO CLI** (`agro`) — create an [Open Harness](https://agro.mifune.dev)
Docker sandbox for coding agents and drive its lifecycle from the command line.

Open Harness is a portable harness for running coding agents (Claude Code, Codex, Pi,
and others) in an isolated Docker sandbox, with the agent's identity, skills, and crons
versioned in git. This package is the standalone `agro` CLI that creates sandboxes and
manages their lifecycle.

## Install

```bash
npm install -g @mifune/agro
```

Then run it as `agro`:

```bash
agro --help
```

Or run it once without installing:

```bash
npx @mifune/agro sandbox install docker
```

Prefer a `curl | bash` bootstrap (also installs Node when missing)? `get-agro.sh`
installs the prebuilt `agro` artifact from the latest GitHub release — it never
clones or builds on your machine:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

### Requirements

- **Node.js ≥ 20** (22 recommended) on your `PATH`. Unlike the `get-agro.sh` bootstrap,
  npm will not install Node for you.
- **Docker** and **git** for the sandbox lifecycle commands (`agro sandbox install`, `agro shell`).

## Compatibility: `oh`

`oh` is the compatibility entry point for `agro`. It ships as the npm package
[`@mifune/openharness`](https://www.npmjs.com/package/@mifune/openharness), which
contains no CLI code of its own: its only file imports the `agro` bundle from an
exact-pinned `@mifune/agro` dependency. The two packages expose disjoint executables
(`agro` and `oh`), can be installed together, and removing either never removes the
other's executable. `oh --help` ends with a line that names `agro` as the canonical
CLI; everything else about `oh` — the `.agro/` control plane, `agro.json`, `OH_*`
variables, `~/.oh/sandboxes` — is unchanged, and `agro` reads and writes exactly the
same files.

## Quick start

Create a sandbox from any directory — no project checkout needed:

```bash
agro sandbox install docker   # wizard, then boot; writes ~/.oh/sandboxes/<name>/
agro sandbox list             # name, runtime, status, repo
agro shell <name>             # open a zsh shell in the running container
```

To bind one of your own checkouts into the sandbox, equip it and pass `--repo`:

```bash
cd your-project
oh update                                       # vendor .agro/ + crons/ — and nothing else (compatibility window)
agro sandbox install docker --repo "$PWD" --name your-project
```

Add an agent harness or a tool at any point — this needs no rebuild. The verb is
the only door; nothing installs at boot:

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro tool install herdr           # a fresh sandbox has no herdr
```

Everything else the sandbox ships — a headless browser, the GitHub CLI:

```bash
agro tool list                    # what is present, and what is installable
agro tool install agent-browser   # asks before the ~1 GB Chromium download
```

`agro harness` and `agro tool` also run **inside** the sandbox, where they install
into the current environment instead of driving the container over Docker
Compose. Detection is automatic (`/.dockerenv` plus `SANDBOX_NAME`); override it
with `OH_EXECUTION_TARGET=local` or `OH_EXECUTION_TARGET=docker-compose`.
`agro sandbox install` remains host-only and says so.

## Commands

| Command | What it does |
|---|---|
| `agro sandbox install <runtime>` | Create a sandbox: run the wizard, write the registry entry under `${OH_HOME:-~/.oh}/sandboxes/<name>/`, materialise the compose files and wrapper into it, and boot the container. Flags: `--name`, `--repo <dir>`, `--yes`, `--image[=<ref>]`, `--no-build`, `--print-argv`. `docker` is provisionable; `microsandbox` is planned and refuses with a pointer at the runtime RFC. |
| `agro sandbox list [--json]` | List the registry entries with name, runtime, container status, and bound repo. |
| `agro shell [name]` | Open a `zsh` shell in the running sandbox container. |
| `agro stop [name]` | Stop the sandbox, preserving volumes. |
| `agro restart [name]` | Restart the sandbox service. |
| `agro logs [name]` | Tail the sandbox compose logs. |
| `agro ps [name]` | Show sandbox service status. |
| `agro destroy [name] [--yes]` | Remove the sandbox, wipe its named volumes (`docker compose down -v`), then delete the registry entry. Names the volumes, then requires you to type the sandbox name; refuses without a TTY unless `--yes` is passed. |
| `agro update [--dry-run]` | Upgrade the installed `agro` executable and nothing else, through the mechanism that installed it: npm-managed (`npm view` + `npm install -g --prefix <owning prefix> @mifune/agro@<version>`) or standalone (download `AGRO_JS_URL`, falling back to `OH_JS_URL` and defaulting to the latest `agro.js` release asset; verify its shebang and `--version`; rename it over the file; keep `<path>.prev` until the new file verifies). Refuses image-shipped, source-checkout, legacy-package, unresolvable, read-only, PATH-shadowed, and downgrade cases with the supported procedure; never uses `sudo`; a no-op when current. Project payload vendoring is `oh update` — see the compatibility note below. |
| `agro config show [--sandbox <name>]` | Print the resolved `agro.json` — every non-secret setting. |
| `agro config set <field> <value> [--sandbox <name>]` | Set one dotted `agro.json` field (`access.sshPort 2200`), validated against the schema. A secret key is refused with a pointer at `agro secret set`. |
| `agro config repo` | Create a repo on your GitHub account, keep the cloned-from upstream as the `openharness` remote, point `origin` at yours, and push. Asks first and defaults to no; never runs without an interactive yes. |
| `agro config <integration>` | Configure an integration via an interactive wizard. |
| `agro secret set <KEY> [--sandbox <name>]` | Prompt for the value with the input hidden and write it to the gitignored `.env` (mode `0600`). The value is never taken from the command line, where shell history would keep it. |
| `agro secret list [--sandbox <name>]` | List the allow-listed keys that hold a value, with the values redacted. |
| `agro compose config` | Print the resolved compose configuration. |
| `agro harness <list\|install\|status>` | Install and inspect agent CLI harnesses. `install` is the only door: it probes the running sandbox, installs into the persistent home volume, and reports. It reads and writes no `agro.json` field, and needs no rebuild. |
| `agro tool <list\|install\|status>` | Install and inspect sandbox tooling that is not an agent CLI. `herdr`, `cloudflared`, `agent-browser`, `microsandbox`, and `tailscale` are `installable`; `gh` and the Docker CLI are `baked-in` and cannot be installed. Nothing installs at boot. A large download is confirmed first, and `--yes` accepts it. |
| `agro gateway <args…>` | Manage a messaging client session (Slack bridge for `pi`/`hermes`). |
| `agro cloud <args…>` | Configure credentials and manage OpenHarness Cloud SSH keys and nodes. |
| `agro --version` | Print the CLI version. |
| `agro --help` | Show help; every subcommand also accepts `--help`. |

`agro.json` and the `.env` beside it are the only two configuration surfaces: `agro.json`
holds every non-secret setting, `.env` holds only the allow-listed secrets. Each has
two homes — a sandbox's registry entry (`--sandbox <name>`) and the project root
(no flag). See
[configuration](https://github.com/mifunedev/agro/blob/main/docs/configuration.md)
for the field reference.

`agro` (or `oh`) is the only lifecycle door, on the host and in the sandbox, and every verb
runs `.agro/scripts/docker-compose.sh` — see
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md), which also
states the confirmation policy `agro destroy` carries.

`agro update` never touches a project. During the compatibility window `oh update` vendors
`.agro/` + `crons/` into the current directory, equipping an empty checkout and upgrading an
equipped one (`--from <dir>` / `--from-remote [--ref <ref>]`, `--dry-run`, `--force`); it
writes nothing else and never prompts. `agro update` rejects those flags and points at
`oh update`. `oh update` prefers the payload bundled into the CLI itself; with `--from-remote`
(or no payload at all) it shallow-clones the public OpenHarness repo into a temp dir and
removes it after the run (`--ref <ref>` pins it). Root `docs/` remains project-owned and is
not part of that payload. Catalog and help output therefore links to the Open Harness source
documentation instead of a path inside the equipped project.

The CLI writes no scaffold. It creates no `AGENTS.md`, no provider configuration, and no
`.gitignore` line beyond the `.env` line `agro secret set` adds inside a git checkout.

## OpenHarness Cloud

`agro cloud` is an Apache-2.0 licensed client that talks to a proprietary hosted service.
Configure the Cloud API once, then use `agro cloud` instead of hand-writing authenticated HTTP
requests:

```bash
agro cloud config  # securely prompts for the current provisioner key
agro cloud ssh-keys create --name laptop --public-key-file ~/.ssh/openharness_node.pub
agro cloud nodes create --name demo --ssh-key-id <ssh-key-id>
agro cloud nodes watch <node-id>
```

Both settings are repository-local. `agro cloud config` writes the API base URL to `cloud.apiUrl`
in the tracked `agro.json` and, until OpenHarness Cloud issues user API tokens, stores the
user-provided provisioner key as `OH_CLOUD_PROVISION_KEY` in the gitignored root `.env`
(mode `0600`). The key is never printed; `agro cloud config show` redacts it. Nothing is written
under `$HOME`.

`OH_CLOUD_API_URL` and `OH_CLOUD_PROVISION_KEY` (`OH_PROVISION_KEY` and `PROVISION_KEY` are
still accepted) provide non-persistent overrides for automation. Because the settings live in
the repository, `agro cloud` runs inside an OpenHarness-equipped repo; outside one, pass
`--api-url` and `--provision-key`. On the first `agro cloud` run in a repo, a legacy
`~/.config/openharness/cloud.json` is migrated into these two homes and then reported as no
longer read — it is left on disk for you to delete. Run `agro cloud --help` for the complete
SSH-key and node lifecycle command set.

## Documentation

- **Docs:** https://agro.mifune.dev
- **Installation guide:** https://agro.mifune.dev/docs/installation
- **Source & issues:** https://github.com/mifunedev/agro

## License

[Apache-2.0](./LICENSE)
