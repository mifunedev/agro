# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Resolve the Slack bot token from the bridge config

**Description:** As a host operator, I want `escalate.sh` to read the bridge bot token so that I do not export the token.

**Acceptance Criteria:**

- [ ] A new file `.agro/skills/escalate/scripts/slack-token.sh` resolves `PI_SLACK_BOT_TOKEN` in this order: the environment, then `.devcontainer/.env`, then `.slack.botToken` in the bridge config at `ESCALATE_BRIDGE_CONFIG` or `~/.pi/msg-bridge.json`.
- [ ] `escalate.sh` sources `slack-token.sh` and keeps no second copy of the token lookup.
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/.env` token, and a bridge config that holds `.slack.botToken`, `escalate.sh` sends the token to the stub `curl` in the `Authorization` header.
- [ ] The token string appears in no stdout, stderr, log line, or `curl` argument in that case.
- [ ] `escalate.sh --dry-run` JSON holds a `ts` key. The value is `""` because a dry run posts nothing.
- [ ] The failure JSON of `escalate.sh` holds a `ts` key.
- [ ] The probe `.agro/evals/probes/escalate-slack-token.sh` covers each criterion of this story with a stub `curl` on `PATH`, and exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.

### US-002: Read the operator decision for one Slack message

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader resolves the token through `slack-token.sh`.
- [ ] The reader takes the operator member ID from `ESCALATE_OPERATOR_SLACK_ID`. If that variable is unset, the reader takes the first `slack:` entry of `.auth.trustedUsers` in the bridge config and removes the `slack:` prefix.
- [ ] If no operator member ID resolves, the reader prints the reason to stderr and exits 2.
- [ ] A `white_check_mark` reaction by the operator prints `approve`.
- [ ] An `x` reaction by the operator prints `reject`.
- [ ] A thread reply by the operator whose text starts with `approve` prints `approve`.
- [ ] A thread reply by the operator whose text starts with `reject` prints `reject`.
- [ ] A reaction or a thread reply from another Slack user prints `none`.
- [ ] If the operator gives both an approve signal and a reject signal, the reader prints `reject`.
- [ ] If a Slack response has `ok: false`, the reader exits 2 and prints the `error` field and the `needed` field to stderr, for example `missing_scope` and `reactions:read`.
- [ ] A missing `--channel` or a missing `--ts` exits 64.
- [ ] The token string appears in no stdout, stderr, or `curl` argument.
- [ ] The probe `.agro/evals/probes/escalate-decision.sh` covers each case of this story with a stub `curl` on `PATH`, and exits 0.

### US-003: Document the decision reader in the escalate skill

**Description:** As an unattended session, I want the escalate skill to state how to read the operator decision so that I follow one documented path.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`, its three outputs, and exit codes 0, 2, and 64.
- [ ] Rule 5 in `.agro/skills/escalate/SKILL.md` states that the reader answers one question for one message and that the caller owns the queue and the schedule.
- [ ] The Resolution section of `.agro/skills/escalate/SKILL.md` lists the bridge config `.slack.botToken` as the third token source.
- [ ] The Resolution section names `ESCALATE_OPERATOR_SLACK_ID` and the `.auth.trustedUsers` fallback.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.

### US-004: Complete the Slack app manifest and the one-app-per-host rule

**Description:** As an operator of a Slack gateway, I want a documented app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` bot scope.
- [ ] The manifest copy in `docs/integrations/slack.md` matches `.pi/install/slack-manifest.yaml` byte for byte.
- [ ] The expected scope list in `.agro/evals/probes/slack-admin-command-surface.sh` holds `commands`.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app.
- [ ] `docs/integrations/slack.md` states that two bridges on one Slack app split events between hosts.
- [ ] `docs/integrations/slack.md` states that a DM admin command must start with `/`.
- [ ] The Troubleshooting table in `docs/integrations/slack.md` has a row for the Slack reply "not a valid command".
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/integrations/slack.md` reports no finding on the new lines.

## Summary

The source is `work/issue-1181.md`.

Verified current state:

- `.agro/skills/escalate/scripts/escalate.sh` posts one message with `chat.postMessage`. The script prints `channel` and `ts` in the success JSON. The dry-run JSON and the failure JSON hold no `ts` key.
- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script does not read `.slack.botToken` from the bridge config.
- `escalate.sh` passes the token to `curl` through `-H @<(printf ...)`. This pattern keeps the token off the command line. The new reader uses the same pattern.
- `.agro/skills/escalate/SKILL.md` rule 5 states that the skill is one-way. No script reads an answer.
- `.pi/install/slack-manifest.yaml` already declares the 7 bridge slash commands, `reactions:read`, the history scopes, and the message events. The manifest does not list the `commands` scope.
- `.agro/evals/probes/slack-admin-command-surface.sh` pins the exact scope list. A new scope needs a matching probe change.
- `docs/integrations/slack.md` holds no one-app-per-host rule.
- `vitest.config.ts` includes no path under `.agro/skills/`. The CI job `eval-probes` in `.github/workflows/ci-harness.yml` runs `.agro/evals/probes/*.sh`. The existing escalate tests are probes. The new tests are probes too.

Selected approach:

1. Move the token lookup into one sourced file. Add the bridge config as the third token source.
2. Add `escalate-decision.sh`. The reader calls `reactions.get` and `conversations.replies` for one message. The reader counts only signals from the operator member ID.
3. Document the reader in the escalate skill.
4. Add the `commands` scope and the one-app-per-host rule to the Slack gateway documentation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | token lookup at lines 79-86, `slack_api`, dry-run block at lines 102-105, final `jq` at lines 206-209 | Sources the shared token lookup; adds `ts` to dry-run and failure JSON |
| `.agro/skills/escalate/scripts/slack-token.sh` | new | One token lookup for delivery and decisions |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | rule 5, Resolution section | Documents the reader and the token order |
| `.agro/scripts/gateway.sh` | `start_pi` | Reads the token from `.devcontainer/.env`. This task does not change `start_pi`. |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical Slack app manifest |
| `docs/integrations/slack.md` | section 2, section 6, section 8 | Manifest copy, one-app-per-host rule, troubleshooting |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list | Pins the manifest |
| `.agro/evals/probes/escalate-contract.sh` | SKILL.md literals | Must stay green |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | JSON shape | Must stay green |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Reads the token from the bridge config when the environment and `.devcontainer/.env` hold none; adds `ts` to dry-run and failure JSON |
| `escalate-decision.sh` | new | CLI: `--channel <id> --ts <ts>`; stdout `approve`, `reject`, or `none`; exit 0, 2, or 64 |
| `ESCALATE_OPERATOR_SLACK_ID` | new env var | Operator Slack member ID for decisions |
| Slack app manifest | changed | Adds the `commands` bot scope |
| `docs/integrations/slack.md` | changed | Adds the one-app-per-host rule and a troubleshooting row |

## Storage

N/A. The reader is stateless. The caller keeps its own state. The reader writes no log line.

## Architectural Decisions

- The operator Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. The fallback is the first `slack:` entry of `.auth.trustedUsers`.
- A bot user cannot post as the operator member ID. This rule blocks self-approval by an agent.
- One file, `slack-token.sh`, owns the token lookup for both scripts.
- The scripts pass the token only through a header file descriptor. The scripts never print the token and never put the token on a command line.
- The reader answers one question for one message. Callers own queues, retries, and schedules.
- A conflict between an approve signal and a reject signal resolves to `reject`. A human decision to stop wins over a decision to proceed.
- `start_pi` in `.agro/scripts/gateway.sh` keeps its token order. The bridge process reads its own config.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-slack-token.sh` | token from environment; token from `.devcontainer/.env`; token from bridge config; token absent from output and `curl` arguments; `ts` key in dry-run JSON and failure JSON | US-001 |
| `.agro/evals/probes/escalate-slack-token.sh` | token source order; token absent from output and `curl` arguments; `ts` key in dry-run JSON and failure JSON | US-001 |
| `.agro/evals/probes/escalate-contract.sh` | existing cases | US-001 and US-003 keep the contract |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | US-001 keeps the JSON shape |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list with `commands` | US-004 |

Each new probe writes a stub `curl` to a temporary directory and puts the directory first on `PATH`. The stub returns fixture JSON per Slack method and records its arguments. Write each new probe first and confirm that the probe exits 1 before the implementation.

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make each human decision explicit and attributable to one Slack member ID.
- Report a missing Slack scope by name.
- Follow the root `AGENTS.md`: no explanatory comments in tracked code; tests and probes are the evidence.
- Change the canonical manifest, then the documentation copy.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Changes to the bridge package or to `start_pi`.
- An automated check that two hosts use two Slack apps.

## Open Questions

1. The issue asks for the Slack `ts` in `--dry-run` output. A dry run posts nothing, so no `ts` exists. This plan adds a `ts` key with the value `""`. Confirm or change this choice.
2. This plan resolves a conflict between approve and reject to `reject`. Confirm or change this choice.
3. Does `mifunedev/agro-web` mirror `docs/integrations/slack.md`? If yes, the one-app-per-host rule needs a matching change there.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts `white_check_mark` and `x` reactions and thread replies that start with `approve` or `reject`, and only from the operator member ID.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` field and the `needed` field.
- [ ] `escalate.sh` and the reader take the bot token from `~/.pi/msg-bridge.json` `.slack.botToken` when no other source holds a token, and never print the token.
- [ ] `escalate.sh --dry-run` JSON holds a `ts` key.
- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` scope, and `docs/integrations/slack.md` states the one-app-per-host rule.
- [ ] Each probe in the Test Plan exits 0 in the CI job `eval-probes`.

## Lessons

Filled by the advisor before undraft.
