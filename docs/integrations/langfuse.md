---
title: Langfuse
---

# 🔭 Langfuse

**[Langfuse](https://langfuse.com) gives your agent sessions a trace.** It records
prompts, model outputs, tool calls, token usage, and cost for every turn, so you
can compare harnesses and models in one place.

Langfuse is optional and external. AGRO does not bundle or operate it. Deploy it
yourself, or use Langfuse Cloud, then point each harness at it.

Langfuse publishes an official plugin for each default AGRO harness. Use those
plugins. Native OpenTelemetry export emits runtime spans, not prompts or cost.

| Harness | Plugin | Trace tag |
| --- | --- | --- |
| [Claude Code](#1-claude-code) | `langfuse-observability` | `claude-code` (automatic) |
| [Pi](#2-pi) | `@langfuse/pi-observability-plugin` | `pi` (automatic) |
| [Codex](#3-codex) | `tracing@codex-observability-plugin` | none — the wizard sets it |

Every plugin sends conversation content to your Langfuse deployment. Treat each
trace as data that leaves the sandbox.

## ⚡ Configure Langfuse in one command

Run the wizard in the sandbox:

```bash
agro config langfuse
```

The wizard collects the configuration once, stores it in the two existing
sources of truth, and renders it into the file each harness reads.

| Step | Question | Behaviour |
| --- | --- | --- |
| 1 | Enable | With tracing off the wizard asks *Enable Langfuse tracing?*. Decline and the wizard writes nothing. With tracing on the wizard asks *Keep it enabled?*. Decline and the wizard runs the disable path. |
| 2 | Base URL | A menu of the three locations in the table below, plus a custom URL. |
| 3 | API keys | Hidden input for `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. Press Enter to keep the key already in `.env`. |
| 4 | Segmentation | The trace environment and an optional user id. |
| 5 | Verify and write | The wizard requests `GET <base URL>/api/public/health`. On a failure the wizard warns and asks whether to save anyway. The wizard then saves the settings, offers to install each missing plugin, and runs `agro langfuse apply`. |

The wizard needs an interactive terminal. Without one the wizard asks nothing
and runs `agro langfuse apply` instead.

### Pick the base URL

Pick the base URL from where the *harness* runs, not from where you browse. The
menu in step 2 mirrors the first three rows.

| Harness location | Langfuse location | `LANGFUSE_BASE_URL` |
| --- | --- | --- |
| Sandbox | Cloud or remote | its HTTPS URL |
| Sandbox | Docker host | `http://host.docker.internal:3000` |
| Sandbox | Compose service on a shared Docker network | `http://langfuse-web:3000` |
| Host shell | Same host | `http://localhost:3000` |

Inside the sandbox, `localhost` is the sandbox itself. The `langfuse-web` name
resolves only after you attach both containers to one Docker network.

### Decide how traces segment

Two dimensions separate sessions inside one Langfuse project:

- **Environment** — *where* the session ran. Step 4 writes
  `langfuse.environment`, and the fragment carries it as
  `LANGFUSE_TRACING_ENVIRONMENT`. Use one value per location, such as
  `agro-sbx-local` or `agro-vm`. Langfuse stores the value at write time, so
  choose the name before you collect traces.
- **Tags** — *which* harness ran. Claude Code and Pi tag themselves. Codex tags
  nothing, so the wizard writes the `codex` tag into `~/.codex/langfuse.json`.

Model is an observation field, not a trace field. Filter by model under
**Tracing → Observations**, not on the Traces tab.

## 🗄 Where the settings live

| Setting | Home | Written by |
| --- | --- | --- |
| `langfuse.enabled`, `langfuse.baseUrl`, `langfuse.environment`, `langfuse.userId` | the `langfuse` section of `agro.json`, tracked by git | the wizard, or `agro config set` |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | the gitignored root `.env`, mode `0600` | the wizard, or `agro secret set` |

See the [field reference](../configuration.md#langfuse-tracing) for the four
`agro.json` fields.

## 📄 What `agro langfuse apply` writes

`apply` never prompts and never installs a plugin. It reads `langfuse.*` from
`agro.json` and the two keys from `.env`, and it writes nothing while
`langfuse.enabled` is not `true`.

| Path | Mode | Holds |
| --- | --- | --- |
| `~/.config/agro/langfuse.env` | `0600` | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `LANGFUSE_TRACING_ENVIRONMENT` |
| `~/.claude/settings.json` | `0644` | a merged `env` block that carries the base URL and the environment |
| `~/.pi/agent/langfuse.json` | `0644` | `environment` and `userId` |
| `~/.codex/langfuse.json` | `0600` | `enabled`, `tags`, and `environment` |

The fragment holds the only credential at rest. The three harness files carry no
key. The Codex file keeps mode `0600`, which matches the
[manual procedure](#-manual-configuration) and costs nothing.

**The fragment carries bare `KEY=value` lines and no `export`.** systemd rejects
an `EnvironmentFile` that uses `export`, and
`.devcontainer/agro-cron.service` loads this same file with
`EnvironmentFile=-`. The tracked `.agro/install/.zshenv` wraps its `source` in
`set -a` and `set +a`, so an interactive shell exports every key anyway. In your
own shell profile, keep `export` — see [manual
configuration](#-manual-configuration).

`.devcontainer/entrypoint.sh` runs `agro langfuse apply` at every start, so the
configuration survives `agro destroy` and a recreate. A failed apply prints a
warning and the boot continues.

`~/.claude`, `~/.pi`, and `~/.codex` exist only in the sandbox. On the host the
wizard and `agro langfuse disable` save the settings, then refuse the file work
and name the sandbox command. `agro langfuse status` prints the settings and
says that the files live in the sandbox.

## 🩺 Check the state

```bash
agro langfuse status
```

`status` prints the resolved settings, the state of each generated file, and the
plugin state of each harness. It exits non-zero when a file is missing or
differs from a fresh render, so a check script can call it.

`status` also exits `1` when `langfuse.enabled` is `false` and the credential
fragment survives. The fragment is the off switch, and a stale fragment is the
unsafe state. Run `agro langfuse disable` to delete the fragment.

`status` warns when `~/.zshenv` exists and does not source the fragment. A
non-interactive shell then carries no Langfuse credential. Add the source block
from `.agro/install/.zshenv`.

## 🤖 Harnesses

The wizard offers to install each missing plugin. Install one by hand with the
commands below.

### 1. Claude Code

```bash
# Install the marketplace and plugin, then restart Claude Code
claude plugin marketplace add langfuse/Claude-Observability-Plugin
claude plugin install langfuse-observability@langfuse-observability
```

The plugin registers `Stop` and `SessionEnd` hooks. It uses `uv`, already present
in the sandbox, and installs its own Python dependencies.

`agro langfuse apply` writes the base URL and the environment into the `env`
block of `~/.claude/settings.json`, and leaves every other key in that file
alone. The keys reach the plugin from the fragment. Git tracks a project
`.claude/settings.json`, so the user file is the right home for these values.

Optional: `LANGFUSE_USER_ID`, `CC_LANGFUSE_TRACE_TAGS`, `CC_LANGFUSE_MAX_CHARS`
(default `20000`), `CC_LANGFUSE_SKILL_TAGS` (default `true`),
`CC_LANGFUSE_CAPTURE_SKILL_CONTENT` (default `false`), `CC_LANGFUSE_DEBUG`.
Environment variables win over `/plugin configure` values.

### 2. Pi

```bash
# Install in user scope
pi install npm:@langfuse/pi-observability-plugin
```

Do not pass `-l`. A project-local install writes `.pi/settings.json`, which git
tracks.

`~/.pi/agent/langfuse.json` accepts `environment` and `userId` and holds no
`baseUrl` field, so Pi reads its endpoint from the environment. The fragment is
therefore the primary transport, and the harness files are a second, non-secret
layer.

Environment variables win over the file. Pi traces carry `git_branch`, `cwd`,
`model`, and `provider` in metadata, and mark subagent turns with `pi_subagent`.

### 3. Codex

```bash
# Install the marketplace and plugin
codex plugin marketplace add langfuse/codex-observability-plugin
codex plugin add tracing@codex-observability-plugin
```

Enable plugin hooks in `~/.codex/config.toml`:

```toml
[features]
plugin_hooks = true

[plugins."tracing@codex-observability-plugin"]
enabled = true
```

`codex plugin add` writes the `[plugins]` table already. Do not add it twice —
duplicate tables are invalid TOML. `agro langfuse apply` never edits
`config.toml`.

**Approve the hook once.** Start `codex` interactively and approve the
**Uploading Codex trace to Langfuse** hook. Codex prompts for hook trust only in
interactive mode, and an untrusted hook never runs. This step stays manual.

```bash
# Confirm the approval; a trusted_hash entry must appear
grep -A2 'tracing@codex-observability-plugin.*stop' ~/.codex/config.toml
```

Optional variables use a `LANGFUSE_CODEX_` prefix and override the file:
`LANGFUSE_CODEX_TAGS`, `LANGFUSE_CODEX_METADATA`, `LANGFUSE_CODEX_USER_ID`,
`LANGFUSE_CODEX_MAX_CHARS` (default `20000`), `LANGFUSE_CODEX_DEBUG`,
`LANGFUSE_CODEX_FAIL_ON_ERROR` (default `false`).

## ✅ Verify

Send one non-sensitive prompt from each harness, then open the Langfuse project
and filter by that harness's tag.

```bash
# Confirm the settings and the generated files first
agro langfuse status

# Confirm the deployment answers before blaming a plugin
curl -fsS "$LANGFUSE_BASE_URL/api/public/health"

# Turn on plugin debug output
CC_LANGFUSE_DEBUG=true claude      # Claude Code
LANGFUSE_DEBUG=true pi             # Pi
LANGFUSE_CODEX_DEBUG=true codex    # Codex
```

## 🔧 Troubleshoot

| Symptom | Cause and fix |
| --- | --- |
| No traces from any harness | Run `agro langfuse status`. A missing fragment or a missing plugin shows there. Restart the harness after any change. |
| `status` reports `drifted` or `missing` | `agro.json` changed after the last render. Run `agro langfuse apply`. |
| `status` exits 1 on a disabled sandbox | Tracing is off and the credential fragment survives. Run `agro langfuse disable`. |
| Traces continue after `agro langfuse disable` | The running harness keeps the values it loaded. Restart every harness session. |
| One harness lags after a key rotation | A second copy of the keys outranks `.env`. Delete the copy and run `agro config langfuse` again. |
| Codex shows no hook | Codex does not trust the `Stop` hook. Start `codex` interactively and approve the hook. |
| Claude Code reports a missing hook script | The `uv` environment is incomplete. Remove `~/.cache/uv/environments-v2/langfuse-hook-*`, run `uv cache prune`, then rerun the hook once. |
| Traces reach the wrong project | The key pair belongs to another project. Query `/api/public/projects` to resolve it. |
| `/api/public/traces` returns 404 | The deployment runs Langfuse v4 in `events_only` mode. Ingestion still works; read traces in the interface. |
| Your own API call returns 403 | A content delivery network blocks non-browser clients. This affects your calls, not the plugins. |
| No traces after `agro destroy` | The command removes the named volumes, so every plugin install is gone. The entrypoint re-applies the settings at boot; run `agro config langfuse` to reinstall the plugins. |

## 🔒 Before a sensitive session

No plugin offers a metadata-only mode. Disable tracing instead.

```bash
agro langfuse disable
```

`disable` sets `langfuse.enabled=false`, deletes the credential fragment, and
rewrites each harness file with tracing off. It keeps the other `langfuse.*`
settings and both `.env` keys, so re-enabling needs no re-prompt.

`disable` then warns about running sessions. A harness that already started
keeps the credentials it loaded. Restart every running harness session.

## 🛠 Manual configuration

Use this procedure for a harness that AGRO has no tracing writer for. The
writers live in `.agro/cli/src/lib/tracing/harness-writers.ts`.

All three plugins read the same variables. Keep **one** source of truth — keys in
two places means a rotation leaves one harness on the old pair.

```bash
# Add to the shell profile that starts your harnesses
export LANGFUSE_PUBLIC_KEY='pk-lf-...'
export LANGFUSE_SECRET_KEY='sk-lf-...'
export LANGFUSE_BASE_URL='https://langfuse.example.com'
export LANGFUSE_TRACING_ENVIRONMENT='agro-sbx-local'

# Restrict the file that holds the secret key
chmod 600 ~/.zshenv
```

Use `export` in your own profile. A bare assignment creates a shell parameter,
not an environment variable, and a hook runs in a child process that never sees
it. The generated fragment is the one exception, because systemd reads that file
too.

Restart the harness after any change. Each plugin reads the environment at start.

To scope settings to one harness, write the file that `agro langfuse apply`
generates:

```json
// ~/.claude/settings.json — Claude Code
{
  "env": {
    "LANGFUSE_BASE_URL": "https://langfuse.example.com",
    "LANGFUSE_TRACING_ENVIRONMENT": "agro-sbx-local"
  }
}
```

```json
// ~/.pi/agent/langfuse.json — Pi
{
  "environment": "agro-sbx-local",
  "userId": "operator"
}
```

```bash
# ~/.codex/langfuse.json — Codex
cat > ~/.codex/langfuse.json <<'JSON'
{
  "enabled": true,
  "tags": ["codex"],
  "environment": "agro-sbx-local"
}
JSON

chmod 600 ~/.codex/langfuse.json
```

## 📚 Sources

- [Langfuse: Claude Code](https://langfuse.com/integrations/developer-tools/claude-code)
- [Langfuse: Pi agent](https://langfuse.com/integrations/developer-tools/pi-agent)
- [Langfuse: Codex](https://langfuse.com/integrations/developer-tools/codex)
- [Langfuse self-hosting](https://langfuse.com/self-hosting)
