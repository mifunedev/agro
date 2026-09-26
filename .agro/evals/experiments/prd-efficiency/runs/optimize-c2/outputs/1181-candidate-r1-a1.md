# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Read the bot token from the bridge config

**Description:** As an operator, I want escalations to find the bridge token so that a host install needs no export.

**Acceptance Criteria:**

- [ ] When `PI_SLACK_BOT_TOKEN` is unset and the `.devcontainer` env file holds no token, `.agro/skills/escalate/scripts/escalate.sh` reads `.slack.botToken` from the file that `ESCALATE_BRIDGE_CONFIG` names. The default file is `~/.pi/msg-bridge.json`.
- [ ] The token source order is the environment, then the `.devcontainer` env file, then the bridge config.
- [ ] The token never appears in stdout, in stderr, in the JSON result, or in the escalation log under `.agro/logs`. A probe greps each output for a fixture token and finds no match.
- [ ] The `escalate.sh --dry-run` JSON has a `ts` key. The value is an empty string, because a dry run posts no message.
- [ ] The existing probes `.agro/evals/probes/escalate-contract.sh` and `.agro/evals/probes/escalate-destination-fan-out.sh` pass.

### US-002: Add the decision reader

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act after a human decides.

**Acceptance Criteria:**

- [ ] New file `.agro/skills/escalate/scripts/escalate-decision.sh` is executable and accepts `--channel <id> --ts <ts>`.
- [ ] The reader prints exactly one of `approve`, `reject`, or `none` on stdout and exits 0 on each Slack API success.
- [ ] A `white_check_mark` reaction from the operator member ID prints `approve`.
- [ ] An `x` reaction from the operator member ID prints `reject`.
- [ ] An operator thread reply whose text starts with `approve` prints `approve`. An operator thread reply whose text starts with `reject` prints `reject`. The match ignores letter case.
- [ ] A reaction or a thread reply from another member ID prints `none`.
- [ ] When the operator gives both an approve signal and a reject signal, the reader prints `reject`.
- [ ] When a Slack response has `ok: false`, the reader exits 2. Stderr holds the `error` field and the `needed` field, for example `missing_scope` and `reactions:read`.
- [ ] When no operator member ID resolves, the reader exits 2 and names `ESCALATE_OPERATOR_SLACK_ID` on stderr.
- [ ] When no token resolves, the reader exits 2 and names the three token sources on stderr.
- [ ] Missing or unknown arguments exit 64, as in `escalate.sh`.
- [ ] The reader uses the same token source order as US-001 and never prints the token.
- [ ] New file `.agro/evals/probes/escalate-decision-reader.sh` covers each case above with a stub `curl` placed first on `PATH`, and passes under `bash .agro/skills/eval/run.sh`.

### US-003: Document decisions and the Slack app setup

**Description:** As an operator, I want a Slack app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` bot scope.
- [ ] The YAML block in `docs/integrations/slack.md` is byte-identical to `.pi/install/slack-manifest.yaml`.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` fails when the manifest lacks the `commands` scope or `reactions:read`.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states that two bridges on one app split events between hosts.
- [ ] `docs/integrations/slack.md` states that a DM admin command must start with `/`.
- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`, the operator identity rule, the output values, and exit codes 0, 2, and 64.

## Summary

The escalate skill posts an escalation through `.agro/skills/escalate/scripts/escalate.sh`. The skill has no path that reads the operator answer. Issue 1181 lists the field defects from 2026-09-26.

Verified current state:

- `escalate.sh` resolves `BRIDGE_CONFIG` from `ESCALATE_BRIDGE_CONFIG` with the default `$HOME/.pi/msg-bridge.json` (line 6). The script reads the bridge config only for the channel (line 90).
- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment or the `.devcontainer` env file (lines 79 to 81).
- `escalate.sh` sends the token through `curl -H @<(...)` in `slack_api` (lines 144 to 147). The token never reaches the command line. The reader must use the same pattern.
- The success JSON and the log entry already hold `ts` (lines 197 to 209). The `--dry-run` JSON holds no `ts` (lines 102 to 105).
- `.pi/install/slack-manifest.yaml` already declares the 7 bridge slash commands, `reactions:read`, the history scopes, and the message events. The manifest lacks the `commands` bot scope.
- The YAML block in `docs/integrations/slack.md` matches the manifest today.
- `docs/integrations/slack.md` has no one-app-per-host rule.
- CI runs the probe suite with `bash .agro/skills/eval/run.sh` in `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml`.

Selected approach: extend the token lookup in `escalate.sh`, add one stateless reader script beside `escalate.sh`, and add one probe. The reader calls Slack `reactions.get` and `conversations.replies` for one message.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | `BRIDGE_CONFIG`, token lookup, `slack_api`, dry-run JSON | Posts the escalation and gains the bridge-config token source |
| `.agro/skills/escalate/scripts/escalate-decision.sh` (new file) | argument parser, token lookup, operator lookup | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | `## Resolution` section | Documents the decision reader |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical Slack app manifest |
| `docs/integrations/slack.md` | `## 2. Create the Slack App` | Manifest copy and the one-app-per-host rule |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` checks | Guards the manifest scopes |
| `.agro/evals/probes/escalate-contract.sh` | `run` helper | Pattern for the new probe |
| `.agro/scripts/gateway.sh` | `start_pi` | Bridge token source; not changed |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` token lookup | changed | Adds the bridge config as the third token source |
| `escalate.sh --dry-run` JSON | changed | Adds a `ts` key with an empty value |
| `escalate-decision.sh --channel <id> --ts <ts>` | new | Prints `approve`, `reject`, or `none` |
| `ESCALATE_OPERATOR_SLACK_ID` | new | Names the operator Slack member ID |
| Slack app manifest | changed | Adds the `commands` bot scope |

## Storage

N/A. The reader is stateless. Each caller keeps the channel and `ts` that `escalate.sh` prints.

## Architectural Decisions

- The operator Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. If the variable is unset, the reader uses the first `slack:` entry of `.auth.trustedUsers` in the bridge config.
- A bot message, a reaction by the bot user, and any other member ID never count as a decision.
- Reject wins over approve. A conflicting signal must not release an action.
- The scripts send the token only through a process-substitution header. The token never appears in an argument, in output, or in a log.
- The reader answers one question for one message. Callers own their queues and their polling.
- Both scripts resolve the token in one order: the environment, then the `.devcontainer` env file, then the bridge config.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-decision-reader.sh` (new file) | reaction and reply decisions, reject wins, other user, bot reply, `missing_scope`, no operator, no token, usage | Decision reader |
| `.agro/evals/probes/escalate-decision-reader.sh` (new file) | token from bridge config for both scripts, fixture token absent from every output | Token source |
| `.agro/evals/probes/escalate-contract.sh` | dry-run JSON has a `ts` key | Dry-run contract |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest has `commands` and `reactions:read` | Manifest scopes |

Write each probe case first and confirm the case fails before the change. Run `bash .agro/skills/eval/run.sh` for the full suite.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one path to Slack for delivery and one path for decisions.
- Make each human decision explicit and attributable to one member ID.
- Report a missing Slack scope by name.
- Keep the reader small and stateless. Apply YAGNI.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Changes to the bridge event routing between hosts.
- Changes to `start_pi` in `.agro/scripts/gateway.sh`.

## Open Questions

1. The format of a `.auth.trustedUsers` entry is not verified. The tracked `.pi/msg-bridge.json` holds an empty list. Confirm that a Slack entry has the form `slack:<memberId>`.
2. Confirm that reject wins over approve when the operator gives both signals.
3. Confirm whether the documentation change needs a matching change in the mifunedev agro-web repository.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts only the operator member ID for reactions and thread replies.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` and `needed` fields.
- [ ] Both scripts take the bot token from the bridge config when the other sources are empty, and never print the token.
- [ ] The `escalate.sh --dry-run` JSON and the success JSON include the `ts` key.
- [ ] The manifest has the `commands` scope, and `docs/integrations/slack.md` states the one-app-per-host rule.
- [ ] `bash .agro/skills/eval/run.sh` passes, and the CI job `eval-probes` passes.

## Lessons

Filled by the advisor before undraft.
