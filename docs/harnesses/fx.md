---
title: "fx"
---

# fx

fx is a native coding agent CLI from Vercel Labs. The fx project uses Zig and the Apache-2.0 license. The fx project status is experimental. AGRO installs the `fx` binary with the official installer from `https://fx.sh/setup.sh`. AGRO bakes no fx binary into the sandbox image.

## Install

Run the install command on the host or in the sandbox:

```bash
agro harness install fx
```

The command runs the upstream installer as the `sandbox` user. The installer writes the binary to `~/.local/bin` in the persistent home volume. AGRO pins fx to version `v0.0.13`:

```bash
curl -fsSL https://fx.sh/setup.sh | FX_INSTALL_DIR="$HOME/.local/bin" bash -s v0.0.13
```

Verify the install:

```bash
fx --version
agro harness status fx
```

The `fx --version` command prints `0.0.13`. See [Harnesses Overview](./overview.md#installing-a-harness) for the behavior of the verb when the sandbox is not running.

## Uninstall

```bash
agro harness uninstall fx
```

The command deletes `~/.local/bin/fx`. fx keeps its credentials and settings in `~/.fx/`. The command does not delete `~/.fx/`. See [Harnesses Overview → Removing a harness](./overview.md#removing-a-harness).

## Authentication

Sign in from a Herdr pane inside the sandbox. Use one of these commands:

| Command | Access |
|---|---|
| `fx login` | Vercel AI Gateway |
| `fx login codex` | ChatGPT subscription (OpenAI Codex OAuth) |
| `fx login grok` | Grok subscription (xAI OAuth) |
| `fx setup` | Vercel AI Gateway API key |

fx also reads the `AI_GATEWAY_API_KEY` environment variable. AGRO stores no fx credential.

These commands work without credentials:

```bash
fx status --json
fx doctor --json
```

When no credential exists, both commands report `"auth":"missing"`.

## Common usage

```bash
fx                                                # start an interactive session
fx ask "explain the changes in this repository"   # run a one-shot prompt
```

In an interactive session, type `/help` to list the interactive commands.

Run interactive sessions in Herdr, so that a session survives a disconnect. Run `agro tool install herdr`, then run `herdr`, then start `fx` in a pane.

## AGRO integration

### Project instructions

fx loads the root `AGENTS.md` from the start directory. When fx works on a file, fx also loads each nested `AGENTS.md` that applies to the target file. The closest file wins a conflict. This rule matches the AGRO rule for target-path specificity. AGRO adds no fx instruction file and no `.fx.json`.

### Skills

fx discovers AGRO skills through `.agents/skills` and `.claude/skills`. Both links resolve to `.agro/skills`:

```text
.agents/skills -> ../.agro/skills
.claude/skills -> ../.agro/skills
```

fx checks `.claude/skills` before `.agents/skills`. fx resolves each skill directory to its real path and keeps the first copy of each directory. Each AGRO skill appears once, with `.claude/skills` as its source. fx merges only copies of the same directory. Two separate directories with the same skill name both appear. Source: `src/builtins/skills.zig` and `src/core/skills/skill_runtime.zig` in vercel-labs/fx.

`.agro/scripts/link-providers.sh` creates and repairs both links. AGRO adds no `.fx/skills` link.

### MCP servers

fx reads the project MCP configuration. Run `fx status --json` to list the MCP servers that fx found.

fx does not start a project MCP server until the operator approves it. `fx ask` skips an unapproved project server and prints `skipped unapproved project MCP servers: <name>`. Approve a server with `fx mcp trust approve <name>`.

### Hooks and guards

AGRO hooks in `.agro/hooks/` do not run under fx. The `cc-safety-net` command hook also does not run under fx. fx has no user-configured command hook. These AGRO guards are absent under fx:

- `deny-env-dump.sh`
- `deny-secret-paths.sh`
- `warn-devtcp.sh`
- `notify_slack.sh`
- `cc-safety-net`

:::warning Absent guards
Under fx, no AGRO guard examines a command or a file path before fx runs the command or reads the file. The Docker sandbox is the security boundary. fx permission rules live only in `~/.fx/settings.json`. A project file cannot set fx permission rules.
:::

### Herdr

fx reports its state to Herdr through its built-in Herdr provider. AGRO adds no Herdr configuration for fx.

## References

- [fx repository](https://github.com/vercel-labs/fx)
- [Project instructions](https://fx.sh/docs/configure-fx/project-instructions)
- [Skills](https://fx.sh/docs/capabilities/skills)
- [Permissions](https://fx.sh/docs/configure-fx/permissions)
