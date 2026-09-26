# @mifune/agro

The **AGRO CLI** (`agro`) creates an [AGRO](https://agro.mifune.dev) Docker
sandbox for coding agents. The CLI also controls the sandbox lifecycle from the
command line.

AGRO is a portable harness that runs coding agents (Claude Code, Codex, Pi, and
others) in an isolated Docker sandbox. Git keeps the versions of the agent's
identity, skills, and crons. This package is the standalone `agro` CLI. The CLI
creates sandboxes and manages the sandbox lifecycle.

## Install

```bash
npm install -g @mifune/agro
```

After the install, run the CLI as `agro`:

```bash
agro --help
```

To run the CLI one time without an install, use `npx`:

```bash
npx @mifune/agro sandbox install docker
```

The `get-agro.sh` bootstrap is an alternative to npm. The bootstrap runs through
`curl | bash`. When Node is missing, the bootstrap also installs Node.
`get-agro.sh` installs the prebuilt `agro` artifact from the latest GitHub
release. The bootstrap never clones or builds on your machine:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

### Requirements

- **Node.js ≥ 20** on your `PATH`. The recommended version is Node 22. npm does
  not install Node for you. The `get-agro.sh` bootstrap does install Node.
- **Docker** and **git**. The sandbox lifecycle commands (`agro sandbox install`,
  `agro shell`) need both.

## Quick start

Create a sandbox from any directory. You need no project checkout:

```bash
agro sandbox install docker   # wizard, then boot; writes ~/.agro/sandboxes/<name>/
agro sandbox list             # name, runtime, status, checkout
agro shell <name>             # open a zsh shell in the running container
```

To bind one of your own checkouts into the sandbox, first equip the checkout
with `agro vendor`. Then pass the checkout to `agro sandbox install` with
`--checkout`:

```bash
cd your-project
agro vendor                                       # vendor .agro/ + crons/ — and nothing else (compatibility window)
agro sandbox install docker --checkout "$PWD" --name your-project
```

`--repo` stays a supported alias for `--checkout`.

You can add an agent harness or a tool at any time. The addition needs no
rebuild. The `install` verb is the only door. The sandbox installs nothing at
boot:

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro tool install herdr           # a fresh sandbox has no herdr
```

Use `agro tool` for every other tool that the sandbox ships, for example a
headless browser and the GitHub CLI:

```bash
agro tool list                    # what is present, and what is installable
agro tool install agent-browser   # asks before the ~1 GB Chromium download
```

`agro harness` and `agro tool` also run **inside** the sandbox. Inside the
sandbox, the two commands install into the current environment. The two
commands do not drive the container over Docker Compose. The CLI detects the
execution target from `/.dockerenv` plus `SANDBOX_NAME`. To override the
detection, set `AGRO_EXECUTION_TARGET=local` or
`AGRO_EXECUTION_TARGET=docker-compose`. `agro sandbox install` runs only on the
host. Inside the sandbox, `agro sandbox install` reports the host-only rule.

## Commands

| Command | Effect |
|---|---|
| `agro sandbox install <runtime>` | Creates a sandbox. First, the command runs the wizard. Next, the command writes the registry entry under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. The command then materialises the compose files and the wrapper into the registry entry. Last, the command boots the container. Flags: `--name`, `--checkout <dir>` (alias `--repo <dir>`), `--home-mount <dir>`, `--yes`, `--image[=<ref>]`, `--no-build`, `--print-argv`. The command can provision `docker`. The project plans `microsandbox` support. For `microsandbox`, the command refuses and points at the runtime RFC. |
| `agro sandbox list [--json]` | Lists each registry entry with name, runtime, container status, and bound checkout. |
| `agro shell [name]` | Opens a `zsh` shell in the running sandbox container. |
| `agro stop [name]` | Stops the sandbox and keeps the volumes. |
| `agro restart [name]` | Restarts the sandbox service. |
| `agro logs [name]` | Tails the sandbox compose logs. |
| `agro ps [name]` | Shows the sandbox service status. |
| `agro destroy [name] [--yes]` | Runs three steps in order: removes the sandbox, deletes the named volumes of the sandbox (`docker compose down -v`), and deletes the registry entry. Before the removal, the command names the volumes. The command then requires you to type the sandbox name. Without a TTY, the command refuses unless you pass `--yes`. |
| `agro update [--dry-run]` | Upgrades the installed `agro` executable and nothing else. The command uses the mechanism that installed the executable. For an npm-managed install, the command runs `npm view` and `npm install -g --prefix <owning prefix> @mifune/agro@<version>`. For a standalone install, the command downloads from `AGRO_JS_URL`, falls back to `<fallback-variable>`, and defaults to the latest `agro.js` release asset. The command then verifies the shebang and the `--version` output of the download. Next, the command renames the download over the file. The command keeps `<path>.prev` until the new file passes verification. The command refuses these cases and names the supported procedure: image-shipped, source-checkout, legacy-package, unresolvable, read-only, PATH-shadowed, and downgrade. The command never uses `sudo`. When the installed version is current, the command changes nothing. To vendor the project payload, use `agro vendor`. Read the compatibility note below the table. |
| `agro config show [--sandbox <name>]` | Prints the resolved `agro.json` with every non-secret setting. |
| `agro config set <field> <value> [--sandbox <name>]` | Sets one dotted `agro.json` field (`access.sshPort 2200`). The command validates the value against the schema. For a secret key, the command refuses and points at `agro secret set`. |
| `agro config repo` | Creates a repo on your GitHub account and keeps the cloned-from upstream as the `agro` remote. The command then points `origin` at your repo and pushes. The command asks first, and the default answer is no. The command runs only after an interactive yes. |
| `agro config <integration>` | Configures an integration through an interactive wizard. |
| `agro secret set <KEY> [--sandbox <name>]` | Prompts for the value with hidden input. The command writes the value to the gitignored `.env` (mode `0600`). The command never reads the value from the command line, because shell history keeps command-line arguments. |
| `agro secret list [--sandbox <name>]` | Lists each allow-listed key that holds a value. The command redacts the values. |
| `agro compose config` | Prints the resolved compose configuration. |
| `agro harness <list\|install\|status>` | Installs and inspects agent CLI harnesses. `install` is the only door. `install` probes the running sandbox, installs into the persistent home volume, and reports the result. The command reads and writes no `agro.json` field. The command needs no rebuild. |
| `agro tool <list\|install\|status>` | Installs and inspects sandbox tooling other than agent CLIs. The status `installable` covers `herdr`, `cloudflared`, `agent-browser`, `microsandbox`, and `tailscale`. The status `baked-in` covers `gh` and the Docker CLI. `agro tool install` cannot install a `baked-in` tool. The sandbox installs nothing at boot. Before a large download, the command asks for confirmation. `--yes` accepts the download. |
| `agro gateway <args…>` | Manages a messaging client session (Slack bridge for `pi`/`hermes`). |
| `agro --version` | Prints the CLI version. |
| `agro --help` | Shows help. Every subcommand also accepts `--help`. |

`agro.json` and the `.env` file next to `agro.json` are the only two
configuration surfaces. `agro.json` holds every non-secret setting. `.env` holds
only the allow-listed secrets. Each file has two locations: the registry entry
of a sandbox (`--sandbox <name>`) and the project root (no flag). For the field
reference, see
[configuration](https://github.com/mifunedev/agro/blob/main/docs/configuration.md).

`agro` is the only lifecycle door, on the host and in the sandbox. Every verb
runs `.agro/scripts/docker-compose.sh`. For details, see
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).
That document also states the confirmation policy of `agro destroy`.

`agro update` never changes a project. During the compatibility window,
`agro vendor` vendors `.agro/` + `crons/` into the current directory. On an
empty checkout, `agro vendor` equips the checkout. On an equipped checkout,
`agro vendor` upgrades the checkout. `agro vendor` accepts `--from <dir>` /
`--from-remote [--ref <ref>]`, `--dry-run`, and `--force`. `agro vendor` writes
nothing else and never prompts. `agro update` rejects those flags and points at
`agro vendor`.

`agro vendor` prefers the payload inside the CLI itself. With `--from-remote`,
or when the CLI holds no payload, `agro vendor` makes a shallow clone of the
public AGRO repo in a temp directory. `--ref <ref>` pins the clone to one ref.
After the run, `agro vendor` removes the temp directory. The root `docs/`
directory stays project-owned and stays outside the payload. For this reason,
catalog and help output link to the AGRO source documentation, not to a path
inside the equipped project.

The CLI writes no scaffold. The CLI creates no `AGENTS.md` and no provider
configuration. The CLI adds only one `.gitignore` line: the `.env` line that
`agro secret set` adds inside a git checkout.

## Documentation

- **Docs:** https://agro.mifune.dev
- **Installation guide:** https://agro.mifune.dev/docs/installation
- **Source & issues:** https://github.com/mifunedev/agro

## License

[Apache-2.0](./LICENSE)
