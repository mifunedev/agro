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
| [Codex](#3-codex) | `tracing@codex-observability-plugin` | none — you set it |

Every plugin sends conversation content to your Langfuse deployment. Treat each
trace as data that leaves the sandbox.

## 📦 Setup

### 1. Deploy Langfuse and create keys

Follow the [Langfuse self-hosting guide](https://langfuse.com/self-hosting), or
create a [Langfuse Cloud](https://cloud.langfuse.com) account. Then open
**Settings → API Keys** and create a key pair.

Pick the base URL from where the *harness* runs, not from where you browse:

| Harness location | Langfuse location | `LANGFUSE_BASE_URL` |
| --- | --- | --- |
| Sandbox | Cloud or remote | its HTTPS URL |
| Sandbox | Docker host | `http://host.docker.internal:3000` |
| Sandbox | Compose service on a shared Docker network | `http://langfuse-web:3000` |
| Host shell | Same host | `http://localhost:3000` |

Inside the sandbox, `localhost` is the sandbox itself. The `langfuse-web` name
resolves only after you attach both containers to one Docker network.

### 2. Set credentials once

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

Use `export`. A bare assignment creates a shell parameter, not an environment
variable, and a hook runs in a child process that never sees it.

Restart the harness after any change. Each plugin reads the environment at start.

### 3. Decide how traces segment

Two dimensions separate sessions inside one Langfuse project:

- **Environment** — *where* the session ran. Set `LANGFUSE_TRACING_ENVIRONMENT` to
  one value per location, such as `agro-sbx-local` or `agro-vm`. Langfuse stores
  it at write time, so choose the name before you collect traces.
- **Tags** — *which* harness ran. Claude Code and Pi tag themselves. Codex does
  not, so you set its tag.

Model is an observation field, not a trace field. Filter by model under
**Tracing → Observations**, not on the Traces tab.

## 🤖 Harnesses

### 1. Claude Code

```bash
# Install the marketplace and plugin, then restart Claude Code
claude plugin marketplace add langfuse/Claude-Observability-Plugin
claude plugin install langfuse-observability@langfuse-observability
```

The plugin registers `Stop` and `SessionEnd` hooks. It uses `uv`, already present
in the sandbox, and installs its own Python dependencies.

Credentials come from the environment. To scope them to Claude Code instead, add
an `env` block to `~/.claude/settings.json`:

```json
{
  "env": {
    "LANGFUSE_PUBLIC_KEY": "pk-lf-...",
    "LANGFUSE_SECRET_KEY": "sk-lf-...",
    "LANGFUSE_BASE_URL": "https://langfuse.example.com",
    "LANGFUSE_TRACING_ENVIRONMENT": "agro-sbx-local"
  }
}
```

Use `~/.claude/settings.json`. Git tracks a project `.claude/settings.json`.

Optional: `LANGFUSE_USER_ID`, `CC_LANGFUSE_TRACE_TAGS`, `CC_LANGFUSE_MAX_CHARS`
(default `20000`), `CC_LANGFUSE_SKILL_TAGS` (default `true`),
`CC_LANGFUSE_CAPTURE_SKILL_CONTENT` (default `false`), `CC_LANGFUSE_DEBUG`.
Environment variables win over `/plugin configure` values.

### 2. Pi

```bash
# Install in user scope
pi install npm:@langfuse/pi-observability-plugin
```

Do not pass `-l`. A project-local install writes `.pi/settings.json`, which is
tracked in git.

Pi reads the shared environment variables. To scope settings to Pi, write
`~/.pi/agent/langfuse.json`:

```json
{
  "environment": "agro-sbx-local",
  "userId": "operator"
}
```

Environment variables win over this file. Pi traces carry `git_branch`, `cwd`,
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
duplicate tables are invalid TOML.

The Codex plugin sets no tag and stays off until you enable tracing:

```bash
# Write the Codex-scoped config
cat > ~/.codex/langfuse.json <<'JSON'
{
  "enabled": true,
  "tags": ["codex"],
  "environment": "agro-sbx-local"
}
JSON

chmod 600 ~/.codex/langfuse.json
```

Start `codex` once interactively and approve the **Uploading Codex trace to
Langfuse** hook. Codex prompts for hook trust only in interactive mode, and an
untrusted hook never runs.

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
| No traces from any harness | The variables are not exported, or the harness started before you set them. Add `export` and restart. |
| One harness lags after a key rotation | The keys live in two places. Keep one source and delete the copy. |
| Codex shows no hook | Codex does not trust the `Stop` hook. Start `codex` interactively and approve the hook. |
| Claude Code reports a missing hook script | The `uv` environment is incomplete. Remove `~/.cache/uv/environments-v2/langfuse-hook-*`, run `uv cache prune`, then rerun the hook once. |
| Traces reach the wrong project | The key pair belongs to another project. Query `/api/public/projects` to resolve it. |
| `/api/public/traces` returns 404 | The deployment runs Langfuse v4 in `events_only` mode. Ingestion still works; read traces in the interface. |
| Your own API call returns 403 | A content delivery network blocks non-browser clients. This affects your calls, not the plugins. |
| Traces stop after `agro destroy` | The command removes named volumes. Install and configure the plugins again. |

## 🔒 Before a sensitive session

No plugin offers a metadata-only mode. Disable tracing instead.

```bash
# Claude Code
claude plugin disable langfuse-observability@langfuse-observability --scope user

# Pi — remove the credential from the environment
unset LANGFUSE_PUBLIC_KEY

# Codex — set "enabled": false in ~/.codex/langfuse.json
```

## 📚 Sources

- [Langfuse: Claude Code](https://langfuse.com/integrations/developer-tools/claude-code)
- [Langfuse: Pi agent](https://langfuse.com/integrations/developer-tools/pi-agent)
- [Langfuse: Codex](https://langfuse.com/integrations/developer-tools/codex)
- [Langfuse self-hosting](https://langfuse.com/self-hosting)
