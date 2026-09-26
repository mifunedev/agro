# @mifune/agro

The **AGRO CLI** (`agro`) creates an [AGRO](https://agro.mifune.dev) Docker
sandbox for coding agents. The CLI also drives the sandbox lifecycle from the
command line.

AGRO is a portable harness for coding agents such as Claude Code, Codex, and Pi.
AGRO runs each agent in an isolated Docker sandbox. Git versions the identity,
skills, and crons of the agent. This package is the standalone `agro` CLI. The
CLI creates sandboxes and manages the sandbox lifecycle.

## Install

```bash
npm install -g @mifune/agro
```

After the install, run the CLI as `agro`:

```bash
agro --help
```

To run the CLI once without an install, use `npx`:

```bash
npx @mifune/agro sandbox install docker
```

As an alternative, use the `curl | bash` bootstrap. The `get-agro.sh` script
installs Node if Node is missing. The script then installs the prebuilt `agro`
artifact from the latest GitHub release. The script never clones or builds on
your machine:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

### Requirements

- **Node.js ≥ 20** on your `PATH`. Node 22 is the recommended version. The
  `get-agro.sh` bootstrap installs Node, but npm does not install Node.
- **Docker** and **git**. The sandbox lifecycle commands (`agro sandbox install`,
  `agro shell`) use both.

## Quick start

You can create a sandbox from any directory. You do not need a project checkout:

```bash
agro sandbox install docker   # wizard, then boot; writes ~/.agro/sandboxes/<name>/
agro sandbox list             # name, runtime, status, checkout
agro shell <name>             # open a zsh shell in the running container
```

To bind one of your own checkouts into the sandbox, do these steps:

1. Equip the checkout with `agro vendor`.
2. Pass the checkout path to `agro sandbox install` with `--checkout`.

```bash
cd your-project
agro vendor                                       # vendor .agro/ + crons/ — and nothing else (compatibility window)
agro sandbox install docker --checkout "$PWD" --name your-project
```

`--repo` remains a supported alias for `--checkout`.

You can add an agent harness or a tool at any time. The addition needs no
rebuild. The `install` verb is the only door. The sandbox installs nothing at
boot:

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro tool install herdr           # a fresh sandbox has no herdr
```

`agro tool` also covers other sandbox tools, such as a headless browser and the
GitHub CLI:

```bash
agro tool list                    # what is present, and what is installable
agro tool install agent-browser   # asks before the ~1 GB Chromium download
```

`agro harness` and `agro tool` also run **inside** the sandbox. Inside the
sandbox, the two commands install into the current environment. They do not
drive the container over Docker Compose. The CLI detects the execution target
from `/.dockerenv` and `SANDBOX_NAME`. To override the detection, set
`AGRO_EXECUTION_TARGET=local` or `AGRO_EXECUTION_TARGET=docker-compose`.
`agro sandbox install` runs only on the host. Inside the sandbox, the command
refuses and states this limit.

## Commands

| Command | Behavior |
|---|---|
| `agro sandbox install <runtime>` | Create a sandbox. The command runs the wizard and writes the registry entry under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. The command then writes the compose files and wrapper into that entry and boots the container. Flags: `--name`, `--checkout <dir>` (alias `--repo <dir>`), `--home-mount <dir>`, `--yes`, `--image[=<ref>]`, `--no-build`, `--print-argv`. The CLI can provision the `docker` runtime. The `microsandbox` runtime is a future runtime. For `microsandbox`, the command refuses and points at the runtime RFC. |
| `agro sandbox list [--json]` | List the registry entries with name, runtime, container status, and bound checkout. |
| `agro shell [name]` | Open a `zsh` shell in the running sandbox container. |
| `agro stop [name]` | Stop the sandbox. The command keeps the volumes. |
| `agro restart [name]` | Restart the sandbox service. |
| `agro logs [name]` | Tail the sandbox compose logs. |
| `agro ps [name]` | Show sandbox service status. |
| `agro destroy [name] [--yes]` | Remove the sandbox and delete its named volumes (`docker compose down -v`). Then delete the registry entry. Before the removal, the command lists the volumes. You must then type the sandbox name to confirm. If the session has no TTY and you do not pass `--yes`, the command refuses. |
| `agro update [--dry-run]` | Upgrade the installed `agro` executable and nothing else. The command uses the mechanism that installed the executable. For an npm-managed install, the command runs `npm view` and `npm install -g --prefix <owning prefix> @mifune/agro@<version>`. For a standalone install, the command downloads from `AGRO_JS_URL`. The command falls back to `<fallback variable>`, and defaults to the latest `agro.js` release asset. The command verifies the shebang and `--version` of the download. The command then renames the download over the file. The command keeps `<path>.prev` until the new file verifies. The command refuses these cases and prints the supported procedure: image-shipped, source-checkout, legacy-package, unresolvable, read-only, PATH-shadowed, and downgrade. The command never uses `sudo`. If the executable is current, the command does nothing. `agro vendor` vendors the project payload. Read the compatibility note below. |
| `agro config show [--sandbox <name>]` | Print the resolved `agro.json` with every non-secret setting. |
| `agro config set <field> <value> [--sandbox <name>]` | Set one dotted `agro.json` field (`access.sshPort 2200`). The command validates the value against the schema. For a secret key, the command refuses and points at `agro secret set`. |
| `agro config repo` | Create a repo on your GitHub account. The command keeps the cloned-from upstream as the `agro` remote, points `origin` at your repo, and pushes. The command asks first, and the default answer is no. The command never runs without an interactive yes. |
| `agro config <integration>` | Configure an integration through an interactive wizard. |
| `agro secret set <KEY> [--sandbox <name>]` | Prompt for the value with hidden input. The command writes the value to the gitignored `.env` (mode `0600`). The command never reads the value from the command line, because shell history keeps command-line arguments. |
| `agro secret list [--sandbox <name>]` | List the allow-listed keys that hold a value. The command redacts the values. |
| `agro compose config` | Print the resolved compose configuration. |
| `agro harness <list\|install\|status>` | Install and inspect agent CLI harnesses. `install` is the only door. The `install` verb probes the running sandbox, installs into the persistent home volume, and reports the result. The command reads and writes no `agro.json` field. The command needs no rebuild. |
| `agro tool <list\|install\|status>` | Install and inspect sandbox tools other than agent CLIs. The `installable` tools are `herdr`, `cloudflared`, `agent-browser`, `microsandbox`, and `tailscale`. The `baked-in` tools are `gh` and the Docker CLI, and `agro tool install` refuses both. The sandbox installs nothing at boot. Before a large download, the command asks for confirmation. The `--yes` flag accepts the download. |
| `agro gateway <args…>` | Manage a messaging client session (Slack bridge for `pi`/`hermes`). |
| `agro --version` | Print the CLI version. |
| `agro --help` | Show help. Every subcommand also accepts `--help`. |

`agro.json` and the `.env` file beside `agro.json` are the only two
configuration surfaces. `agro.json` holds every non-secret setting. `.env` holds
only the allow-listed secrets. Both files have two locations. The first location
is the registry entry of a sandbox (`--sandbox <name>`). The second location is
the project root (no flag). For the field reference, see
[configuration](https://github.com/mifunedev/agro/blob/main/docs/configuration.md).

`agro` is the only lifecycle door, on the host and in the sandbox. Every verb
runs `.agro/scripts/docker-compose.sh`. For details, see
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).
That page also states the confirmation policy of `agro destroy`.

`agro update` never changes a project. During the compatibility window,
`agro vendor` vendors `.agro/` + `crons/` into the current directory. The
command equips an empty checkout and upgrades an equipped checkout. The flags
are `--from <dir>`, `--from-remote [--ref <ref>]`, `--dry-run`, and `--force`.
`agro vendor` writes nothing else and never prompts. `agro update` rejects those
flags and points at `agro vendor`.

`agro vendor` uses the payload bundled into the CLI by default. The command
shallow-clones the public AGRO repo into a temp dir in two cases:

- you pass `--from-remote`;
- the CLI holds no bundled payload.

`--ref <ref>` pins the clone. The command removes the temp dir after the run.
Root `docs/` remains project-owned and is not part of the payload. For this
reason, catalog and help output links to the AGRO source documentation. The
output does not link to a path inside the equipped project.

The CLI writes no scaffold. The CLI creates no `AGENTS.md` and no provider
configuration. The only `.gitignore` change is the `.env` line. `agro secret set`
adds that line inside a git checkout.

## Documentation

- **Docs:** https://agro.mifune.dev
- **Installation guide:** https://agro.mifune.dev/docs/installation
- **Source & issues:** https://github.com/mifunedev/agro

## License

[Apache-2.0](./LICENSE)
