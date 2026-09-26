# PRD: Escalate Slack decisions

Status: DRAFT

Source: `work/issue-1181.md`. Branch: `feat/<issue#>-escalate-slack-decisions`. Target: `development`.

## User Stories

### US-001: Resolve the Slack bot token from the bridge config

**Description:** As a host operator, I want `escalate.sh` to read the bridge bot token so that I skip a manual export.

**Acceptance Criteria:**

- [ ] A new sourced file `.agro/skills/escalate/scripts/slack.sh` owns token resolution and the `slack_api` helper. `escalate.sh` sources the file and keeps no copy of either function.
- [ ] Token resolution uses this order: `PI_SLACK_BOT_TOKEN` in the environment, then `PI_SLACK_BOT_TOKEN=` in `.devcontainer/.env`, then `.slack.botToken` in the bridge config (`ESCALATE_BRIDGE_CONFIG`, default `~/.pi/msg-bridge.json`).
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/.env` token, and a bridge config that holds `.slack.botToken`, `escalate.sh` sends the `Authorization: Bearer <token>` header with that token to the stub `curl`.
- [ ] The no-token reason string names all three sources.
- [ ] The token never appears in stdout, in stderr, in `escalations.jsonl`, or in the `curl` argv that the stub records.
- [ ] `escalate.sh --dry-run` JSON carries a `ts` key. The value is `""` because a dry run posts nothing.
- [ ] The delivered-result JSON and the log line keep the existing `ts` field.
- [ ] `bash .agro/evals/probes/escalate-slack-token-source.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.

### US-002: Read the operator decision for one Slack message

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/scripts/escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none` on stdout and exits 0.
- [ ] The reader sources `slack.sh` for the token and for every Slack call.
- [ ] The reader resolves the operator member ID from `ESCALATE_OPERATOR_SLACK_ID`. If that variable is unset, the reader uses the first `slack:` entry of `.auth.trustedUsers` in the bridge config, with the `slack:` prefix removed.
- [ ] If no operator member ID resolves, the reader prints nothing on stdout, prints the reason on stderr, and exits 2.
- [ ] The reader calls `reactions.get` with `channel` and `timestamp`. A `white_check_mark` reaction from the operator counts as `approve`. An `x` reaction from the operator counts as `reject`.
- [ ] The reader calls `conversations.replies` with `channel` and `ts`. A reply from the operator whose trimmed, lowercased text starts with `approve` counts as `approve`. A reply that starts with `reject` counts as `reject`. The parent message does not count.
- [ ] A reaction or a reply from any other user, the bot user included, prints `none`.
- [ ] If the operator signals both `approve` and `reject`, the reader prints `reject`.
- [ ] If Slack returns `"ok": false`, the reader exits 2 and prints the `error` field and the `needed` field on stderr. Example: `missing_scope` and `reactions:read`.
- [ ] If `curl` exits non-zero, or no token resolves, the reader exits 2 and prints the reason on stderr.
- [ ] If `--channel` or `--ts` is missing, the reader exits 64.
- [ ] `bash .agro/evals/probes/escalate-decision-reader.sh` exits 0. The probe covers each case with a stub `curl` on `PATH`: approve by ✅, approve by thread reply, reject by ❌, reject by thread reply, a decision from another user, and API `ok: false` with `missing_scope`.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.

### US-003: Document a working Slack app setup

**Description:** As an operator of a Slack gateway, I want a documented app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` adds `commands` to `oauth_config.scopes.bot`. The 7 slash commands, `reactions:read`, the `channels:history`, `groups:history`, and `im:history` scopes, and the 3 `message.*` events stay in place.
- [ ] The YAML fence in `docs/integrations/slack.md` section 2 is byte-identical to `.pi/install/slack-manifest.yaml`.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app. The text names the failure: two bridges on one app split events, and each bridge saves `/enable` in its own `~/.pi/msg-bridge.json`.
- [ ] `docs/integrations/slack.md` states that a new app rejects a slash command with "not a valid command" when the manifest lacks the command or the `commands` scope.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` expects the `commands` scope and pins a short fragment of the one-app-per-host rule.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

### US-004: Document the decision procedure in the escalate skill

**Description:** As an operator, I want only my Slack user to count as a decision so that no agent can approve its own escalation.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`: arguments, output values, exit codes `0`, `2`, and `64`, and operator ID resolution.
- [ ] `SKILL.md` states that the operator's Slack member ID is the only decision identity, and that a GitHub comment is not a decision.
- [ ] `SKILL.md` rule 5 and the "Receiving replies" entry in "Not this skill" no longer say that the skill receives no answer. Both point to `escalate-decision.sh`.
- [ ] `SKILL.md` states that the caller keeps its own state and reads one message per call.
- [ ] The token resolution entry in "Resolution" lists the three sources in order.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` reports no new finding against the base branch.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

## Summary

Verified current state:

- `.agro/skills/escalate/scripts/escalate.sh` posts with `chat.postMessage`. The script prints `channel` and `ts` on success. The `--dry-run` JSON holds `dryRun`, `channel`, `supervisor`, and `text`, with no `ts`.
- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script never reads `.slack.botToken` from the bridge config.
- `escalate.sh` passes the token to `curl` through a process-substitution header file. `.agro/evals/probes/escalate-contract.sh` guards that pattern.
- `SKILL.md` rule 5 says the skill is one-way and waits for no answer.
- `.pi/install/slack-manifest.yaml` declares the 7 bridge slash commands, `reactions:read`, the history scopes, and the `message.channels`, `message.groups`, and `message.im` events. The manifest lacks the `commands` bot scope.
- `docs/integrations/slack.md` embeds the manifest. `slack-admin-command-surface.sh` requires a byte-identical copy and pins the exact scope list.
- `docs/integrations/slack.md` has no one-app-per-host rule.
- CI runs `shellcheck` on `.agro/skills/escalate/scripts/*.sh` and runs every probe through `bash .agro/skills/eval/run.sh`.

Selected approach: extract token resolution and `slack_api` into one sourced `slack.sh`. Add the stateless reader `escalate-decision.sh`. Test both with probes that put a stub `curl` on `PATH`. Add the `commands` scope and the one-app-per-host rule to the Slack documentation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/slack.sh` | token resolution, `slack_api` | New. One path to Slack for both scripts |
| `.agro/skills/escalate/scripts/escalate.sh` | token block, `slack_api`, `--dry-run` output | Sources `slack.sh`. Adds `ts` to the dry-run JSON |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new script | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | Rules, Resolution, Not this skill | Documents the reader and the token order |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Adds `commands` |
| `docs/integrations/slack.md` | sections 2, 6, and 8 | Manifest copy, one-app-per-host rule, "not a valid command" fix |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list | Adds `commands` and the one-app-per-host pin |
| `.agro/scripts/gateway.sh` | `start_pi` | Read only. The bridge token source stays unchanged |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Falls back to `.slack.botToken` in the bridge config. Dry-run JSON carries `ts` |
| `escalate-decision.sh` | new | `--channel <id> --ts <ts>` prints `approve`, `reject`, or `none` |
| `ESCALATE_OPERATOR_SLACK_ID` | new variable | The operator's Slack member ID, for example `U01ABCD2345` |
| Slack app manifest | changed | Adds the `commands` bot scope |
| `docs/integrations/slack.md` | changed | One Slack app per host; slash-command troubleshooting |

## Storage

N/A. The reader is stateless. The caller keeps its own state. The bridge config stays owned by `pi-messenger-bridge`. The scripts only read the bridge config.

## Architectural Decisions

- The operator's Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. The fallback is the first `slack:` entry of `.auth.trustedUsers`.
- The reader returns `none` for any signal from another identity. A bot that shares a host with the operator cannot approve its own escalation.
- The reader exits 2 when no identity resolves. The reader never guesses an operator.
- A conflicting decision resolves to `reject`.
- `slack.sh` is the single owner of token resolution and Slack HTTP calls. The token reaches `curl` only through a header file.
- The reader answers one question for one message. Callers own their queues and their poll schedule.
- The Slack gateway stays one app per host. The harness adds no cross-host event routing.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-slack-token-source.sh` | token from bridge config; env token first; no-token reason; token absent from all output; dry-run `ts` | US-001 |
| `.agro/evals/probes/escalate-decision-reader.sh` | ✅, ❌, and reply decisions; other user and bot → `none`; conflict → `reject`; `missing_scope`, no operator, and no `--ts` exit codes | US-002 |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `commands` scope present; manifest fence byte-identical; one-app-per-host fragment present | US-003 |
| `.agro/evals/probes/escalate-contract.sh` | existing contract, including the header-file token rule | US-001 regression |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing destination contract | US-001 regression |

Write each new probe first. Confirm that the probe exits 1 against the base branch. Then implement. Drive each REGRESSION branch with a broken copy, per `.agro/evals/AGENTS.md`.

## Design Principles

- Keep one path to Slack for delivery and one for decisions.
- Make the human decision explicit and attributable.
- Report a missing Slack scope by name.
- Never put the token on a command line, in output, or in a log.
- Add no tracked comments. Express intent through names and probes.
- Edit the canonical `.agro/skills/escalate/` sources, not a provider mirror.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Cross-host event routing for one Slack app.
- Changes to `gateway.sh` token loading or to the bridge package.
- Migration of existing GitHub-comment approval loops to the reader.

## Open Questions

1. Dry-run `ts`: a dry run posts nothing, so no Slack `ts` exists. This plan emits `"ts": ""` in the dry-run JSON. Confirm, or name the value the dry run must carry.
2. Conflict rule: this plan resolves operator ✅ plus ❌ to `reject`. Confirm, or choose "latest signal wins".
3. Token order: this plan keeps `.devcontainer/.env` ahead of the bridge config. Confirm, or put the bridge config ahead of `.env`.
4. `conversations.replies` pagination: this plan reads the first page only, with `limit=<N>`. Name `<N>`, or require cursor pagination.
5. Public documentation: `docs/contributing.md` names `mifunedev/agro-web` as the rendered docs site. Confirm whether the Slack page change needs a matching `agro-web` change in this task.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts ✅ (`white_check_mark`) and ❌ (`x`) reactions, and thread replies that start with `approve` or `reject`, only from the operator's member ID.
- [ ] A decision from another Slack user prints `none`.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` field and the `needed` field.
- [ ] `escalate.sh` and the reader take the bot token from `~/.pi/msg-bridge.json` `.slack.botToken` when no earlier source holds a token, and never print the token.
- [ ] `escalate.sh --dry-run` output and the delivered JSON result carry `ts`.
- [ ] `docs/integrations/slack.md` holds a complete manifest with the 7 bridge slash commands, the `commands` scope, `reactions:read`, the history scopes, and the message events. The page states that each host needs its own Slack app.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION, and the CI jobs `Shellcheck boot scripts` and `Eval Probe Regression Gate` pass.

## Lessons

Filled by the advisor before undraft.
