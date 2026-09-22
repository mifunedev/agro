# MEMORY — langfuse-config-wizard

> **Contract.** This file is *compacted current knowledge*, not a log.
> Rewrite entries in place; do not append. `progress.txt` answers "what happened";
> MEMORY.md answers "what must I know before I touch this task again".
> Read it first on every resume, after every compaction, and in every worker brief.
> Only the implementation owner edits it — same rule as `progress.txt`.
> Keep it under ~150 lines. If it grows past that, something here belongs in
> `prd.md` (a requirement) or `progress.txt` (an event) instead.

**Status:** PRD written and revised for the operator's scope decisions. Not yet planned. No code exists.
**Last updated:** 2026-09-21 (scope revised: Codex writer, plugin detection, cron unit fix)

---

## Invariants — verified, do not re-derive

These cost real investigation this session. Each is cited; trust the citation over recall.

1. **Compose is closed to `LANGFUSE_*`.**
   `.agro/evals/probes/compose-env-boundary.sh` is an armed probe, not a guideline. Its rule:
   a value belongs in compose `environment:` only if a process **outside** the sandbox — or
   the entrypoint **before** the control plane is readable — must act on it. Langfuse keys
   fail that test. `GH_TOKEN` is a named literal exception in that probe's `LITERALS` array,
   not a precedent to extend.

2. **Stored Langfuse secrets currently reach nothing.**
   `agro secret set LANGFUSE_SECRET_KEY` works (`lib/secrets.ts:16`) and writes `.env`, but
   `.devcontainer/docker-compose.yml:17-25` passes only `GH_TOKEN` into the container. The
   value is inert today. This is the actual bug behind the feature request.

3. **Pi cannot be configured by file alone.**
   `~/.pi/agent/langfuse.json` takes `environment` and `userId` only — **no `baseUrl`**
   (`docs/integrations/langfuse.md`). Pi gets its endpoint only from the process environment.
   This is why the environment is the primary transport and files are secondary. Any redesign
   that makes files primary is wrong for this reason alone.

4. **File mode cannot hide anything from the agent.**
   Agent and harness share the `sandbox` uid (`getent passwd sandbox` → `/bin/zsh`, uid 1000).
   The read boundary is `.claude/settings.json` `permissions.deny`. `0600` protects against
   other users, not against the agent. The operator's original "permissions so the agent
   can't read it" framing does not hold and was resolved this way.

5. **`.zshenv` is not a managed file.**
   `Dockerfile:97` copies only `.agro/install/.zshrc`. `.zshrc` is interactive-only;
   non-interactive `zsh -c` reads `.zshenv` alone. The `~/.zshenv` on a live box is
   operator-created. `seed_home` (`entrypoint.sh:91`) skips any file that already exists, so
   a newly tracked `.zshenv` will **not** overwrite an operator's own.

6. **The cron path works by accident today.**
   `openharness-cron.service` runs `/bin/bash -c` with only `Environment=HOME=/home/sandbox`.
   It recovers because no `default-command` is set in `.tmux.conf`, so `tmux new-session`
   spawns a login shell that sources the zsh files. But `cron-runtime.ts:614` branches on
   `liveEntry.tmux`, and the non-tmux path has no such luck.

7. **Extra task-folder files are allowed; `evidence.md` is not.**
   `spec-task-artifact-contract.sh:70,91` requires `prd.md`, `prd.json`, `progress.txt`,
   `eval-result.json`, `simplicity-review.json` on *completed* folders and forbids only
   `evidence.md` (retired by #1088). **This file trips nothing.**

8. **Task folder contents are gitignored except `AGENTS.md`.**
   This file is local unless force-added. Do not assume a reviewer can see it.

---

## Decisions — settled, with the reason

| # | Decision | Why, and what was rejected |
|---|---|---|
| D1 | Environment is the **primary** transport; harness files are a secondary non-secret layer | Forced by invariant 3. Inverts the operator's original user story, where files were the point. |
| D2 | One `0600` credential file: `~/.config/agro/langfuse.env` | One secret at rest → the read boundary is one deny rule. Rejected: inlining keys into `~/.claude/settings.json`, which agents legitimately read. |
| D3 | Singular `agro langfuse` surface; provider-shaped seam under `lib/tracing/providers/` | Rejected `agro otel config <provider>` — `otel` names the mechanism the repo explicitly rejects (`docs/harnesses/claude-code.md:51`, `docs/integrations/langfuse.md:15`) and collides with the real native-OTel path. Rejected `agro tracing config <provider>` for now: one verified member is the speculative generality #1129 just removed. |
| D4 | Reinstate the `agro.json` `langfuse` section, reversing part of #1129 | Legitimate **only** under the derived-artifact contract: `agro.json` + `.env` are the sole sources, harness files are regenerated. Without that, #1129's two-sources-of-truth objection returns intact. Needs an ADR. |
| D5 | Disable = delete the credential fragment | Fail-safe. Pi's JSON has no documented `enabled` field, so a flag alone would not stop Pi. Keys stay in `.env` so re-enabling needs no re-prompt. |
| D6 | Ship a tracked `.agro/install/.zshenv` **and** add `EnvironmentFile=-` to `openharness-cron.service` | Operator chose full coverage. Closes the cron non-tmux gap by construction rather than relying on invariant 6's accident. Rejected: a one-line addition to `.zshrc` (interactive-only), and `.zshenv` alone (leaves the non-tmux cron path on the accident). |
| D7 | Ship **all three** writers: Claude Code, Pi, Codex | Operator reversed the earlier Claude+Pi scoping. The third writer proves the seam generalizes instead of asserting it, and the docs already specify `~/.codex/langfuse.json`. The hook-trust approval stays a documented manual step — it is interactive-only by Codex's design. |
| D9 | `setup` detects missing plugins and offers to install; `apply` never does | A configured harness with no plugin and an unconfigured harness both produce nothing — this is the likeliest first-run failure, so it needs a named cause. Install requires explicit confirmation. Rejected: configure-only (leaves the failure silent) and unconditional install (mutates harness state unasked, breaks when a marketplace is unreachable). |
| D10 | Fragment is bare `KEY=value`; `.zshenv` wraps the source in `set -a` / `set +a` | One file must serve two consumers with incompatible formats: systemd `EnvironmentFile` rejects `export`, and a bare assignment sourced by a shell creates a shell parameter, not an environment variable — the exact failure `docs/integrations/langfuse.md` warns about. `set -a` reconciles them. Rejected: rendering two files. |
| D8 | Keep `LANGFUSE_PRIVACY_PRESET` retired permanently | Fork-only concept, no official-plugin equivalent. Only `baseUrl` returns, and only as a harness-file/env field. |

---

## Assumptions — NOT verified, verify before relying on them

- **The Claude Code plugin's `Stop` hook inherits the parent env through its `uv` invocation.**
  The entire Claude Code path depends on this. If false, D2 needs rework for Claude Code.
- **Herdr does not set tmux `default-command` outside `~/.tmux.conf`.**
  Checked `~/.tmux.conf` and `.agro/install/.tmux.conf` — neither sets it. Herdr's own config
  was not located (`~/.herdr` has no JSON). If Herdr sets it, panes may not spawn a login
  shell and the `.zshenv` coverage in D6 becomes load-bearing rather than belt-and-braces.
- **Whether the Pi plugin honors any disable flag in its JSON.** Undocumented. D5 does not
  depend on it, but confirming would allow defence in depth.

---

## Reusable surfaces — do not rebuild

| Need | Existing surface |
|---|---|
| Wizard loop | `runWizard`, `.agro/cli/src/commands/sandbox.ts:169` |
| Interactivity gate | `sandbox.ts:265` — `opts.yes !== true && (process.stdin.isTTY === true \|\| io.ask !== undefined)` |
| Masked input | `prompt.askSecret`, `lib/prompt.ts:63` |
| Step headers | `prompt.step`, `lib/prompt.ts:33` — **zero callers today**; this task is its first |
| Redaction | `prompt.redact`, `lib/prompt.ts:47` |
| Secret read/write | `readSecret` / `setSecret`, `lib/secrets.ts` |
| Injected IO for tests | `SecretIO`, `commands/secret.ts:15` |
| Config validation | `validateOhConfig`, `OH_CONFIG_FIELDS`, `lib/oh-config.ts` |

`askDefaulted` and `askYesNo` are private to `sandbox.ts` — promote to `lib/prompt.ts`
rather than copying, or two prompt dialects drift apart.

---

## Residue this task should clean up

- `agro.json:23` — dangling `"langfuse": {}` stub left by #1129.
- `.example.env:85-96` — still describes the retired `pi-langfuse` fork and deleted privacy presets.
- `docs/configuration.md` — needs `langfuse.*` rows or `config-schema-parity.sh` fails.

---

## Open questions

1. Wire `agro langfuse status` into `agro doctor` or the login banner? Deferred.
2. Run the base-URL health check from inside the sandbox when `setup` is invoked on the host?
   Current answer: warn and save.
3. On promoting to `agro tracing config <provider>`, is `agro langfuse` a permanent alias or
   deprecated on a window?
