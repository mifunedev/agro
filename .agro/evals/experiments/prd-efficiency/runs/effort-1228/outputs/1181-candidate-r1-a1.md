# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Read the bot token from the bridge config

**Description:** As an operator on a host install, I want `escalate.sh` to read the token from the bridge config so that I skip a manual export.

**Acceptance Criteria:**

- [ ] If `PI_SLACK_BOT_TOKEN` is unset and `.devcontainer/.env` holds no token, `escalate.sh` reads `.slack.botToken` from `$ESCALATE_BRIDGE_CONFIG` (default `~/.pi/msg-bridge.json`).
- [ ] A probe runs `escalate.sh` with a fixture bridge config and a stub HTTP client, and the probe confirms that stdout, stderr, and `ESCALATE_LOG` never contain the fixture token.
- [ ] The token source lives in one shared shell function that `escalate.sh` and `escalate-decision.sh` both call.
- [ ] `escalate.sh --dry-run` JSON output holds a `ts` key. The value is an empty string, because a dry run posts no message.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.

### US-002: Add the decision reader

**Description:** As an unattended session, I want one tested decision command so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts a `white_check_mark` reaction as `approve` and an `x` reaction as `reject`.
- [ ] The reader counts a thread reply that starts with `approve` or `reject` as that decision.
- [ ] The reader counts a reaction or a reply only when the Slack user is the operator member ID.
- [ ] The operator member ID comes from `ESCALATE_OPERATOR_SLACK_ID`. If that variable is unset, the ID comes from the first `slack:` entry of `.auth.trustedUsers` in the bridge config.
- [ ] If the reader resolves no operator member ID, the reader exits 2 and prints the reason.
- [ ] A decision from another Slack user prints `none`.
- [ ] If the Slack API returns `ok: false`, the reader exits 2 and prints the `error` and `needed` fields, for example `missing_scope` and `reactions:read`.
- [ ] The reader sends the token only through a header file descriptor, as `escalate.sh` does, and never prints the token.
- [ ] A new probe `.agro/evals/probes/escalate-decision.sh` covers approve by reaction, approve by thread reply, reject by reaction, a decision from another user, an API `ok: false`, and the token source. The probe uses a stub HTTP client and exits 0.

### US-003: Document the decision path and the Slack app setup

- [ ] A new probe `.agro/evals/probes/escalate-decision.sh` uses a stub HTTP client and exits 0. The probe covers approve by reaction, approve by reply, reject by reaction, another user, an API `ok: false`, and the token source.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` declares the `commands` bot scope in addition to the 7 bridge slash commands, `reactions:read`, the history scopes, and the message events that the manifest holds now.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states that two bridges on one app split events between hosts.
- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`, the decision reactions, the reply keywords, and `ESCALATE_OPERATOR_SLACK_ID`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

## Summary

The `/escalate` skill posts an escalation to Slack through `.agro/skills/escalate/scripts/escalate.sh`. The skill has no path that reads the operator answer. Unattended loops use GitHub comments for approval. Sessions on one host can share one `gh` login, so a session can post an approval comment. Slack separates the identities: only the operator posts as the operator member ID. Source: `work/issue-1181.md`.

Verified current state:

- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env` (lines 79-86). The script does not read `.slack.botToken` from the bridge config.
- `escalate.sh` sends the token through `-H @<(printf ...)` (lines 145-146 and 162), so the token stays off the command line.
- The live path prints `ts` in the JSON result (line 208). The `--dry-run` path prints no `ts` key (lines 102-105).
- `BRIDGE_CONFIG` defaults to `$HOME/.pi/msg-bridge.json` and honors `ESCALATE_BRIDGE_CONFIG` (line 6).
- `.pi/install/slack-manifest.yaml` declares the 7 slash commands, `reactions:read`, the history scopes, and the 4 message events. The manifest has no `commands` scope.
- `gateway.sh` `start_pi` reads the tokens from `.devcontainer/.env` only.

Selected approach: add one shared token function, add one stateless reader script, extend the manifest by one scope, and document the setup.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | token block (lines 79-86), `slack_api`, `--dry-run` block | Posts the escalation and prints `channel` and `ts` |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new | Reads the operator decision for one message |
| `.agro/skills/escalate/scripts/<shared token file>` | new token function | One token source for both scripts |
| `.agro/skills/escalate/SKILL.md` | procedure | Documents the reader |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical Slack app manifest |
| `docs/integrations/slack.md` | section 2, section 6 | App setup and the one-app-per-host rule |
| `.agro/evals/probes/escalate-contract.sh`, `.agro/evals/probes/escalate-destination-fan-out.sh` | existing probes | Regression floor for `escalate.sh` |
| `.github/workflows/ci-harness.yml` | `eval-probes` job | Runs the probes in CI |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Reads the token from the bridge config when the environment and `.devcontainer/.env` hold none |
| `escalate.sh --dry-run` | changed | JSON output holds a `ts` key |
| `escalate-decision.sh` | new | Prints `approve`, `reject`, or `none` for one Slack message |
| `ESCALATE_OPERATOR_SLACK_ID` | new | Operator member ID for decisions |
| Slack app manifest | changed | Adds the `commands` bot scope |

## Storage

N/A. The reader is stateless. The caller keeps its own state.

## Architectural Decisions

- The operator Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. Without that variable, the reader uses the first `slack:` entry of `.auth.trustedUsers`.
- The scripts never put the token on a command line, in output, or in a log.
- The reader answers one question for one message. Callers own their queues.
- The reader reads reactions through `reactions.get` and replies through `conversations.replies`.
- The token lookup order is: environment, then `.devcontainer/.env`, then the bridge config.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-decision.sh` | approve by `white_check_mark`, approve by thread reply, reject by `x`, decision from another user, API `ok: false` with `needed` | Decision reader |
| `.agro/evals/probes/escalate-decision.sh` | token from bridge config, token absent from all output | Token source |
| `.agro/evals/probes/escalate-contract.sh` | `--dry-run` output holds `ts` | Dry-run contract |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest holds the `commands` scope | Manifest |

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one path to Slack for delivery and one path for decisions.
- Make the human decision explicit and attributable.
- Report a missing Slack scope by name.
- Write each probe as a deterministic 3-state oracle.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- A token source change in `gateway.sh` `start_pi`.
- Public documentation in `mifunedev/agro-web`, unless the operator asks for it.

## Open Questions

1. The issue asks for the Slack `ts` in `--dry-run` output, but a dry run posts no message. This plan adds an empty `ts` key. Confirm or name another intent.
2. If the operator both approves and rejects one message, the plan has no rule. Proposed rule: the latest operator action wins, and a tie prints `none`. Confirm the rule.
3. The issue offers `.agro/skills/escalate/scripts/__tests__/` or a probe. This plan uses a probe under `.agro/evals/probes/`. Confirm.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] The `eval-probes` job in `.github/workflows/ci-harness.yml` passes on the pull request.
- [ ] `git grep -n 'xoxb-'` finds no real token in tracked files.

## Lessons

Filled by the advisor before undraft.
