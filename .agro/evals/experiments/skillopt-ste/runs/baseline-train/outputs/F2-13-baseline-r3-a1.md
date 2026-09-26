# @mifune/agro

The **AGRO CLI** (`agro`) creates an [AGRO](https://agro.mifune.dev) Docker
sandbox for coding agents. The CLI also controls the sandbox lifecycle from the
command line.

AGRO is a portable harness that runs coding agents in an isolated Docker
sandbox. Supported agents include Claude Code, Codex, Pi, and others. Git
keeps the versions of the agent identity, skills, and crons. This package is
the standalone `agro` CLI. The CLI creates sandboxes and manages the sandbox
lifecycle.

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

As an alternative, use the `curl | bash` bootstrap. When Node is missing, the
bootstrap also installs Node. `get-agro.sh` installs the prebuilt `agro` artifact
from the latest GitHub release. `get-agro.sh` never clones or builds on your
machine:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

### Requirements

- **Node.js ≥ 20** must be on your `PATH`. Node.js 22 is the recommended
  version. npm does not install Node for you. The `get-agro.sh` bootstrap does.
- **Docker** and **git** must be present for the sandbox lifecycle commands
  (`agro sandbox install`, `agro shell`).

## Quick start

Create a sandbox from any directory. You do not need a project checkout:

```bash
agro sandbox install docker   # wizard, then boot; writes ~/.agro/sandboxes/<name>/
agro sandbox list             # name, runtime, status, checkout
agro shell <name>             # open a zsh shell in the running container
```

To bind one of your own checkouts into the sandbox, do these steps:

1. Run `agro vendor` in the checkout to equip the checkout.
2. Pass the checkout path to `agro sandbox install` with `--checkout`.

```bash
cd your-project
agro vendor                                       # vendor .agro/ + crons/ — and nothing else (compatibility window)
agro sandbox install docker --checkout "$PWD" --name your-project
```

`--repo` stays a supported alias for `--checkout`.

You can add an agent harness or a tool at any time after the sandbox starts. An
addition needs no rebuild. The `agro` verb is the only door. The sandbox
installs nothing at boot:

```bash
agro harness list                 # what exists, and what is installed
agro harness install opencode     # install into the running sandbox
agro tool install herdr           # a fresh sandbox has no herdr
```

The sandbox also ships other tooling, for example a headless browser and the
GitHub CLI. Use `agro tool` for this tooling:

```bash
agro tool list                    # what is present, and what is installable
agro tool install agent-browser   # asks before the ~1 GB Chromium download
```

`agro harness` and `agro tool` also run **inside** the sandbox. Inside the
sandbox, the two verbs install into the current environment. The two verbs do
not drive the container over Docker Compose. The CLI detects the location
automatically from `/.dockerenv` plus `SANDBOX_NAME`. To override the
detection, set `AGRO_EXECUTION_TARGET=local` or
`AGRO_EXECUTION_TARGET=docker-compose`. `agro sandbox install` runs only on the
host. When you run `agro sandbox install` in the sandbox, the command reports
this limit.

## Commands

| Command | Behavior |
|---|---|
| `agro sandbox install <runtime>` | Creates a sandbox. The command runs the wizard and writes the registry entry under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. Next, the command materialises the compose files and the wrapper into the registry entry. Last, the command boots the container. Flags: `--name`, `--checkout <dir>` (alias `--repo <dir>`), `--home-mount <dir>`, `--yes`, `--image[=<ref>]`, `--no-build`, `--print-argv`. The CLI can provision `docker`. The CLI cannot provision `microsandbox` yet. For `microsandbox`, the command refuses and points at the runtime RFC. |
| `agro sandbox list [--json]` | Lists the registry entries with name, runtime, container status, and bound checkout. |
| `agro shell [name]` | Opens a `zsh` shell in the running sandbox container. |
| `agro stop [name]` | Stops the sandbox and keeps the volumes. |
| `agro restart [name]` | Restarts the sandbox service. |
| `agro logs [name]` | Tails the sandbox compose logs. |
| `agro ps [name]` | Shows the sandbox service status. |
| `agro destroy [name] [--yes]` | Removes the sandbox and deletes the named volumes of the sandbox (`docker compose down -v`). Then the command deletes the registry entry. First, the command names the volumes and asks you to type the sandbox name. Without a TTY, the command refuses unless you pass `--yes`. |
| `agro update [--dry-run]` | Upgrades the installed `agro` executable and nothing else. The command uses the mechanism that installed the executable. For an npm-managed install, the command runs `npm view` + `npm install -g --prefix <owning prefix> @mifune/agro@<version>`. For a standalone install, the command downloads `AGRO_JS_URL`. The fallback source is `<fallback variable>`. The default source is the latest `agro.js` release asset. The command verifies the shebang and `--version` of the download. Then the command renames the download over the file. The command keeps `<path>.prev` until the new file passes verification. The command refuses these cases and states the supported procedure: image-shipped, source-checkout, legacy-package, unresolvable, read-only, PATH-shadowed, and downgrade. The command never uses `sudo`. When the executable is current, the command does nothing. `agro vendor` vendors the project payload. See the compatibility note below. |
| `agro config show [--sandbox <name>]` | Prints the resolved `agro.json` with every non-secret setting. |
| `agro config set <field> <value> [--sandbox <name>]` | Sets one dotted `agro.json` field (`access.sshPort 2200`). The command validates the value against the schema. For a secret key, the command refuses and points at `agro secret set`. |
| `agro config repo` | Creates a repo on your GitHub account. The command keeps the cloned-from upstream as the `agro` remote, points `origin` at your repo, and pushes. The command asks first, and the default answer is no. Without an interactive yes, the command does not run. |
| `agro config <integration>` | Configures an integration through an interactive wizard. |
| `agro secret set <KEY> [--sandbox <name>]` | Prompts for the value with hidden input. The command writes the value to the gitignored `.env` (mode `0600`). The command never reads the value from the command line, because shell history keeps command-line values. |
| `agro secret list [--sandbox <name>]` | Lists the allow-listed keys that hold a value. The command redacts the values. |
| `agro compose config` | Prints the resolved compose configuration. |
| `agro harness <list\|install\|status>` | Installs and inspects agent CLI harnesses. `install` is the only door. `install` probes the running sandbox, installs into the persistent home volume, and reports the result. The command reads and writes no `agro.json` field. The command needs no rebuild. |
| `agro tool <list\|install\|status>` | Installs and inspects sandbox tooling other than agent CLIs. The `installable` tools are `herdr`, `cloudflared`, `agent-browser`, `microsandbox`, and `tailscale`. `gh` and the Docker CLI are `baked-in`. `agro tool install` cannot install `gh` or the Docker CLI. The sandbox installs nothing at boot. The command asks you to confirm a large download first. `--yes` accepts the download. |
| `agro gateway <args…>` | Manages a messaging client session (Slack bridge for `pi`/`hermes`). |
| `agro --version` | Prints the CLI version. |
| `agro --help` | Shows help. Every subcommand also accepts `--help`. |

`agro.json` and the `.env` file beside `agro.json` are the only two
configuration surfaces. `agro.json` holds every non-secret setting. `.env`
holds only the allow-listed secrets. Each of the two files has two locations.
The first location is the registry entry of a sandbox (`--sandbox <name>`). The
second location is the project root (no flag). For the field reference, see
[configuration](https://github.com/mifunedev/agro/blob/main/docs/configuration.md).

`agro` is the only lifecycle door, on the host and in the sandbox. Every verb
runs `.agro/scripts/docker-compose.sh`. See
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).
That page also states the confirmation policy for `agro destroy`.

`agro update` never changes a project. During the compatibility window,
`agro vendor` vendors `.agro/` + `crons/` into the current directory. `agro vendor`
equips an empty checkout and upgrades an equipped checkout. `agro vendor`
accepts these flags: `--from <dir>` / `--from-remote [--ref <ref>]`,
`--dry-run`, `--force`. `agro vendor` writes nothing else and never prompts.
`agro update` rejects those flags and points at `agro vendor`.

`agro vendor` prefers the payload in the CLI bundle. In two cases, `agro vendor`
does a shallow clone of the public AGRO repo into a temporary directory:

- you pass `--from-remote`;
- the CLI bundle holds no payload.

`--ref <ref>` pins the clone to `<ref>`. `agro vendor` removes the temporary
directory after the run. The root `docs/` directory stays project-owned and is
not part of that payload. For this reason, catalog and help output links to the
AGRO source documentation. The output does not link to a path inside the
equipped project.

The CLI writes no scaffold. The CLI creates no `AGENTS.md` and no provider
configuration. The CLI adds no `.gitignore` line, with one exception: inside a
git checkout, `agro secret set` adds the `.env` line.

## Documentation

- **Docs:** https://agro.mifune.dev
- **Installation guide:** https://agro.mifune.dev/docs/installation
- **Source & issues:** https://github.com/mifunedev/agro

## License

[Apache-2.0](./LICENSE)
