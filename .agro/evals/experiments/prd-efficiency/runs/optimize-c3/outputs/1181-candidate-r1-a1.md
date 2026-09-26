# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Bridge config token source

**Description:** As an unattended session, I want the bot token from the bridge config so that host installs need no export.

**Acceptance Criteria:**

- [ ] If `PI_SLACK_BOT_TOKEN` is unset and the sandbox env file has no token, `.agro/skills/escalate/scripts/escalate.sh` reads `.slack.botToken` from the file at `BRIDGE_CONFIG`.
- [ ] The token lookup order is: the environment, then the sandbox env file, then `BRIDGE_CONFIG`.
- [ ] No stdout, stderr, record line, or process argument of `escalate.sh` contains the token value.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.

### US-002: Operator decision reader

**Description:** As an unattended session, I want one tested decision command so that I act only after the operator decides.

**Acceptance Criteria:**

- [ ] The new file `.agro/skills/escalate/scripts/escalate-decision.sh` accepts `--channel <id> --ts <ts>`.
- [ ] On success, the reader prints exactly one of `approve`, `reject`, or `none`, and exits 0.
- [ ] A `white_check_mark` reaction from the operator prints `approve`.
- [ ] An `x` reaction from the operator prints `reject`.
- [ ] An operator thread reply that starts with `approve` or `reject` prints that decision.
- [ ] A reaction or a reply from another Slack user prints `none`.
- [ ] The operator ID comes from `ESCALATE_OPERATOR_SLACK_ID`. If the variable is unset, the ID comes from the first `slack:` entry of `.auth.trustedUsers` in `BRIDGE_CONFIG`.
- [ ] If Slack returns `ok: false`, the reader prints the `error` and `needed` fields to stderr and exits 2.
- [ ] The reader uses the US-001 token lookup and never prints the token.
- [ ] The new probe file `.agro/evals/probes/escalate-decision.sh` covers each case above with a stub `curl` on `PATH`, and exits 0.
- [ ] The new probe fails when a fault injection makes the reader accept a decision from a non-operator user.

### US-003: Slack app setup documentation

**Description:** As an operator, I want a complete Slack app setup so that the bot receives commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` bot scope.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app.
- [ ] `docs/integrations/slack.md` states that a DM command must start with the slash character.
- [ ] The manifest copy in `docs/integrations/slack.md` matches `.pi/install/slack-manifest.yaml`.
- [ ] `.agro/skills/escalate/SKILL.md` documents the decision reader, its exit codes, and the operator ID source.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

## Summary

The /escalate skill posts to Slack but cannot read the operator's answer. A shared `gh` login lets any session post an approving GitHub comment. A Slack member ID separates the operator from the bot.

Verified state: `escalate.sh` reads the token from the environment or the sandbox env file only (lines 79-85). `BRIDGE_CONFIG` defaults to the bridge config in the home directory. The live JSON result already includes `ts`. The dry-run result has no `ts`, because dry-run posts nothing. `.pi/install/slack-manifest.yaml` declares the 7 bridge commands, `reactions:read`, the history scopes, and the message events. The manifest does not declare the `commands` scope.

The approach adds a bridge-config token fallback, a new decision reader with a probe, and documentation fixes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | `PI_SLACK_BOT_TOKEN` lookup, `BRIDGE_CONFIG`, `slack_api` curl helper | Token source and delivery |
| `.agro/skills/escalate/SKILL.md` | procedure | Documents the decision reader |
| `.agro/scripts/gateway.sh` | `start_pi` | Bridge token source; no change |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical manifest |
| `docs/integrations/slack.md` | manifest section | App setup and one-app-per-host rule |
| `.agro/evals/probes/escalate-contract.sh` | dry-run contract | Existing regression floor |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Reads the token from `BRIDGE_CONFIG` when the other sources have none |
| `escalate-decision.sh` | new | Prints the operator decision for one Slack message |
| Slack app manifest | changed | Adds the `commands` bot scope |

## Storage

N/A. The reader is stateless. The caller keeps its own state.

## Architectural Decisions

- The operator's Slack member ID is the only decision identity.
- The scripts pass the token through a header file descriptor, as `escalate.sh` does now. The token never appears on a command line, in output, or in a log.
- The reader answers one question for one message. Callers own their queues.
- The reader calls `reactions.get` and `conversations.replies` through `curl`, so the probe can stub `curl` on `PATH`.
- If the operator gives an approve signal and a reject signal, the reader prints `reject`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/escalate-decision.sh` | approve by reaction, approve by reply, reject by reaction, other user, `ok: false` with `missing_scope` | Decision reader |
| new file `.agro/evals/probes/escalate-decision.sh` | token from `BRIDGE_CONFIG`, token absent from output | Token source |
| `.agro/evals/probes/escalate-contract.sh` | existing dry-run contract | No regression |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest command surface | No regression |

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make the human decision explicit and attributable.
- Report a missing Slack scope by name.
- Write no comments in tracked code.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Changes to the bridge event routing between hosts.

## Open Questions

1. The issue asks for `ts` in the `--dry-run` output. Dry-run posts nothing, so no `ts` exists. This plan keeps `ts` in the live result only. Confirm, or name the dry-run value.
2. The new probe uses a stub `curl`. `.agro/evals/AGENTS.md` permits fixtures only for the hook-unit-test pattern. Confirm that this probe fits that pattern.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/evals/probes/escalate-decision.sh` exits 0 in CI.
- [ ] The CI shellcheck step in `.github/workflows/ci-harness.yml` exits 0.

## Lessons

Filled by the advisor before undraft.
