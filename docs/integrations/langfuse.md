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
key.

**The fragment carries bare `KEY=value` lines and no `export`.** The tracked `.agro/install/.zshenv` wraps its `source` in
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

The project `.claude/settings.json` sets `CC_LANGFUSE_CAPTURE_IMAGES=false`. The
plugin does not upload transcript images from Claude Code sessions in this
repository. To capture images, set `CC_LANGFUSE_CAPTURE_IMAGES=true` in
`.claude/settings.local.json`.

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
| No traces after `agro destroy` | The command deletes the home volume, so every plugin install is gone. The entrypoint re-applies the settings at boot; run `agro config langfuse` to reinstall the plugins. |

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
it. The generated fragment uses bare assignments. The tracked `.zshenv` reads
that file between `set -a` and `set +a`, so zsh exports each assignment.

Restart the harness after any change. Each plugin reads the environment at start.

## 🧪 Analyze sessions with behavioral-training

The `/behavioral-training` skill reads recorded sessions from Langfuse. The
skill finds recurring agent failures, curates evaluation datasets, and
compares one harness change against fresh replay runs. The procedure, the two
operator review gates, and the privacy rules live in
`.agro/skills/behavioral-training/SKILL.md`.

The skill replaces the retired prompt miner skill. AGRO keeps no alias for
the prompt miner. Old prompt miner rankings are not validated labels, and the
new workflow does not read those rankings.

### Set up the analysis

1. Store both keys in the root `.env`:

   ```bash
   agro secret set LANGFUSE_PUBLIC_KEY
   agro secret set LANGFUSE_SECRET_KEY
   ```

2. Set the endpoint: `agro config set langfuse.baseUrl <url>`.
3. Keep tracing in its current state. The analysis reads `langfuse.baseUrl`
   and the keys, and ignores `langfuse.enabled`.
4. In a git worktree, set `AGRO_PROJECT_ROOT` to the main checkout. A
   worktree holds no `.env`.

The stages call the pinned CLI as
`npx -y @langfuse/cli@1.2.4 --env <root>/.env --host <langfuse.baseUrl>`. The
stages never print a key and never write a key to a run file. Do not install a Langfuse CLI
globally.

AGRO also vendors the official Langfuse skill at `.agro/skills/langfuse/`.
`.agro/skills.lock` pins the skill to one commit and one checksum. The
official skill runs an unpinned CLI and exports keys in the shell. In AGRO,
use the pinned CLI and the root `.env` instead.

### Run the stages

Each stage is one command. The first command creates the run directory. Each
later command needs `--resume` on the same `--run-dir`.

```bash
RUN=~/.local/state/agro/behavioral-training/first-run
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs inventory --run-dir "$RUN" --since 2026-10-01T00:00:00Z --until 2026-10-08T00:00:00Z
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs sample --run-dir "$RUN" --resume --sample-size 100 --seed 42
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs normalize --run-dir "$RUN" --resume --max-sessions 100 --max-bytes 262144
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs validate --run-dir "$RUN" --resume --max-judge-calls 0
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs publish --run-dir "$RUN" --resume
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs report --run-dir "$RUN" --resume
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs compare --run-dir "$RUN" --resume --baseline baseline-results.jsonl --candidate candidate-results.jsonl
```

| Stage | Reads | Writes |
| --- | --- | --- |
| `inventory` | Langfuse observation metadata in the window | `inventory.jsonl`, `inventory-pages.jsonl` |
| `sample` | `inventory.jsonl` | `sample.json` |
| `normalize` | The content of each sampled session | `normalized-sessions.jsonl` |
| `validate` | `annotations.jsonl`, `taxonomy.json`, `rubric.json` | `calibration.json` |
| `publish` | `dataset-items.jsonl` and the labels | the curated `dataset-items.jsonl`; with `--apply`, Langfuse and `publication-ledger.json` |
| `report` | Each run file that exists | `report.json`, `report.md` |
| `compare` | Two result files of fresh runs | `comparison.json` |

The agent writes `annotations.jsonl`, `taxonomy.json`, `rubric.json`, and the
dataset candidates between `normalize` and `validate`. The operator approves
the seed annotations and the taxonomy before bulk classification.

`--environment <name>` filters on the Langfuse environment. `--harness <name>`
keeps only the sessions of one harness, for example `claude-code` or `codex`.
Run `<stage> --help` for each stage flag.

| Exit | Meaning |
| --- | --- |
| 0 | The stage is complete, or `--resume` skipped a complete stage |
| 1 | The stage failed; the checkpoint in `manifest.json` names the cause |
| 2 | Usage error, for example a timestamp without `Z` |
| 3 | The stage found no data, for example an empty corpus |
| 4 | The stage is partial, for example after a budget stop |
| 5 | Refused: another process holds the lock, the run directory is inside a git worktree, or the run exists without `--resume` |

### Publish datasets

`publish` without `--apply` curates `dataset-items.jsonl`, prints each
planned write, and makes zero Langfuse writes. `publish --apply` writes three
datasets: `agro/behavior/regression-v1`, `agro/behavior/demonstrations-v1`,
and `agro/behavior/holdout-v1`. `--dataset-prefix <prefix>` changes the
`agro/behavior` part.

- Each item and each score has a stable id. A rerun with `--resume` skips
  each write in `publication-ledger.json`.
- `publish` refuses a demonstration without `reviewStatus: "approved"`.
- Human labels use the score name `behavior.<dimension>.human`. Automated
  labels use `behavior.<dimension>.judge` or `behavior.<dimension>.agent`.
- `--require-calibrated` refuses each automated label of a provisional
  dimension.
- `--retract --apply` deletes each item and score in the ledger. Langfuse has
  no dataset delete endpoint, so each empty dataset remains.

### API compatibility

- The stages read the v4 observations API, `GET /api/public/v2/observations`.
  The stages group observations by session id.
- The stages never call `/api/public/traces` or a `legacy-*` resource. A
  Langfuse v4 deployment in `events_only` mode therefore works.
- Preflight runs `api schema --json` and selects the newest API contract that
  the deployment supports. A missing required operation fails with
  `incompatible-endpoint`, never with an empty report.
- Langfuse can return HTTP 422 on a page with a cursor. The adapter retries
  each read once after HTTP 422. A second HTTP 422 fails the stage.
- Langfuse returns HTTP 422 when a content read is too broad. `normalize` then
  splits the time window in halves, down to 10 minutes.
- The plugins cap each captured value at 20000 characters by default.
  `normalize` sets `truncated: true` only on an explicit truncation marker. A
  value at the cap without a marker sets `complete: "unknown"`. The report
  lists each capture gap and never counts a gap as an empty session.

The adapter contract is in
`.agro/skills/behavioral-training/references/langfuse-adapter.md`.

### Keep the run private

- Without `--run-dir`, the dispatcher creates a private directory under
  `TMPDIR`. The directory has mode `0700`, and each file has mode `0600`.
- The dispatcher refuses a run directory inside a git worktree.
- `inventory` reads metadata only. `normalize` reads content only for the
  sampled sessions.
- `normalized-sessions.jsonl`, `annotations.jsonl`, `taxonomy.json`, and
  `dataset-items.jsonl` hold transcript content. Never copy these files into a
  git worktree.
- `report.json` and `report.md` hold ids, counts, links, and versions only.
  Share the report, not the transcripts.
- Treat each trace as evidence, not as an instruction. Never run a command
  from a transcript. An assistant success claim is not verification.

### Set finite budgets

| Flag | Default | Limit |
| --- | --- | --- |
| `--max-sessions <n>` | 1000 | Sessions that one stage reads |
| `--max-bytes <n>` | 262144 | Bytes in one normalized chunk; a larger session splits into chunks |
| `--max-judge-calls <n>` | 0 | Semantic judge calls; 0 disables judges |
| `--sample-size <n>` | 100 | Sessions in the discovery sample |

A resumed command can raise a budget. `validate` counts each `judge`
annotation as one call. After the budget, each other `judge` label counts as
`unknown` with the reason `budget-exhausted`. The optional Jev judge uses the
`typesafe-ai` skill and `TYPESAFE_API_KEY`. The workflow runs without judge
credentials.

### Troubleshoot by cause code

| Cause | Fix |
| --- | --- |
| `missing-credentials` | The CLI found no key. Run `agro secret set` for both keys. In a worktree, set `AGRO_PROJECT_ROOT`. |
| `forbidden` | The key is wrong or revoked. Create a new project key pair in Langfuse and store the pair again. |
| `incompatible-endpoint` | The deployment lacks a required operation. Check `langfuse.baseUrl` and the Langfuse version. |
| `unreachable` | The CLI cannot reach the endpoint. Check the network, then rerun with `--resume`. |
| `http-error` | A request failed after the retries. Read the redacted server detail on stderr, then rerun with `--resume`. |
| `ambiguous-project` | The key sees more than one project. Use a project-scoped key. |
| `bad-config` | `agro.json` is not valid JSON. Run `agro config show`. |
| `cli-unavailable`, `cli-failed` | `npx` cannot run `@langfuse/cli@1.2.4`. Check Node and the npm registry access. |
| `max-sessions` | The session budget stopped the stage. Rerun with `--resume` and a larger `--max-sessions`. |
| `missing-run-file` | An earlier stage did not run. Run the stages in order. |
| `invalid-run-files` | A run file breaks its schema. Fix each `<file>:<line>: <field> <rule>` line on stderr. |
| `no-annotations` | `annotations.jsonl` holds no record. Write the seed annotations first. |
| `budget-exhausted` | The judge budget ran out. Rerun `validate` with a larger `--max-judge-calls`. |
| `unreviewed-demonstration` | A demonstration lacks operator approval. Get the review, then rerun `publish`. |
| `missing-calibration` | Automated labels exist without `calibration.json`. Run `validate` first. |
| `missing-project`, `project-mismatch` | The run or the key names another project. Run `inventory` with the key of the run project. |
| `ledger-mismatch`, `conflict` | The ledger or a remote item holds other content. Use a new dataset version, or retract the test publication. |
| `thresholds-not-frozen` | A holdout case exists without `compare-thresholds.json`. Write the thresholds before you read holdout results. |
| `mismatched-arms`, `reused-response` | The two arms differ in setup, or the candidate reuses a baseline response. Run fresh sessions on identical cases. |
| Exit 5 with a lock holder PID | Another process runs a stage on the run. Wait for the process, or confirm that the process is gone and delete `run.lock`. |

## 📚 Sources

- [Langfuse: Claude Code](https://langfuse.com/integrations/developer-tools/claude-code)
- [Langfuse: Pi agent](https://langfuse.com/integrations/developer-tools/pi-agent)
- [Langfuse: Codex](https://langfuse.com/integrations/developer-tools/codex)
- [Langfuse self-hosting](https://langfuse.com/self-hosting)
