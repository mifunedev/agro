# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Resolve the Slack bot token from the bridge config

**Description:** As a host operator, I want `escalate.sh` to read the stored bridge token so that I skip a manual export.

**Acceptance Criteria:**

- [ ] New file `.agro/skills/escalate/scripts/slack-token.sh` defines one shell function that resolves `PI_SLACK_BOT_TOKEN` in this order: the environment, the `.devcontainer/` env file, then `.slack.botToken` in the bridge config at `ESCALATE_BRIDGE_CONFIG`.
- [ ] `.agro/skills/escalate/scripts/escalate.sh` sources `slack-token.sh` and contains no other token lookup.
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/` env file, and a bridge config that holds `.slack.botToken`, `escalate.sh --dry-run` resolves a channel and reports no token error.
- [ ] With no token in any source, the Slack destination reason names all three sources.
- [ ] The stub token value appears in no stdout, no stderr, and no line of the escalation log.
- [ ] The JSON result of a delivered send carries the Slack `ts`. The `--dry-run` JSON carries a `ts` key with the value `null`.
- [ ] New file `.agro/scripts/__tests__/escalate.test.ts` covers each criterion above with a stub `curl` on `PATH`, and `pnpm test:scripts` exits 0.

### US-002: Read the operator decision for one Slack message

**Description:** As an unattended session, I want one tested decision command so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] New file `.agro/skills/escalate/scripts/escalate-decision.sh` accepts `--channel <id> --ts <ts>`, prints exactly one of `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader sources `slack-token.sh` for the token and passes the token to `curl` through a header file, never on the command line.
- [ ] The reader takes the operator identity from `ESCALATE_OPERATOR_SLACK_ID`. When that variable is unset, the reader takes the first `slack:` entry of `.auth.trustedUsers` in the bridge config.
- [ ] When no operator identity resolves, the reader exits 2 and names both identity sources on stderr.
- [ ] The reader counts a `white_check_mark` reaction and a thread reply that starts with `approve` as `approve`, only from the operator identity.
- [ ] The reader counts an `x` reaction and a thread reply that starts with `reject` as `reject`, only from the operator identity.
- [ ] When the operator gave both an approve signal and a reject signal, the reader prints `reject`.
- [ ] A reaction or a reply from another Slack user prints `none`.
- [ ] When Slack answers `ok: false`, the reader exits 2 and prints the `error` field and the `needed` field on stderr, for example `missing_scope` and `reactions:read`.
- [ ] Missing or bad arguments exit 64, the same usage code as `escalate.sh`.
- [ ] The stub token value appears in no stdout and no stderr of any case.
- [ ] New file `.agro/scripts/__tests__/escalate-decision.test.ts` covers each case above with a stub `curl` on `PATH`, and `pnpm test:scripts` exits 0.

### US-003: Document the decision reader in the escalate skill

**Description:** As an unattended session, I want the skill to document the decision reader so that a shared `gh` login cannot approve my work.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`: its arguments, its three outputs, its exit codes `0`, `2`, and `64`, and the operator identity sources.
- [ ] `.agro/skills/escalate/SKILL.md` states that the Slack member ID is the only decision identity, and that a GitHub comment is not a decision.
- [ ] `.agro/skills/escalate/SKILL.md` Rule 5 and the "Receiving replies" entry no longer say that the skill receives no answer.
- [ ] The **Token** entry of the Resolution section names the bridge config `.slack.botToken` as the third source.
- [ ] `.agro/evals/probes/escalate-contract.sh` fails when `escalate-decision.sh` is absent, not executable, or interpolates the token into `argv`.
- [ ] A fault-injection run against a disposable copy drives the new probe branch to REGRESSION, and `bash .agro/evals/probes/escalate-contract.sh` exits 0 on the final tree.

### US-004: Ship a complete Slack app manifest and the one-app-per-host rule

**Description:** As a gateway operator, I want a working documented app setup so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` declares the `commands` bot scope next to the existing 7 slash commands, `reactions:read`, the history scopes, and the message events.
- [ ] The manifest copy in `docs/integrations/slack.md` section 2 matches `.pi/install/slack-manifest.yaml` byte for byte.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states the failure when two bridges share one app: Slack delivers each event to one connection only.
- [ ] `docs/integrations/slack.md` states that a DM admin command must start with `/`.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` fails when the manifest lacks the `commands` scope or `reactions:read`.
- [ ] A fault-injection run with `SLACK_MANIFEST_OVERRIDE` on a copy without `commands` drives the probe to REGRESSION, and the probe exits 0 on the final tree.

## Summary

The `/escalate` skill posts an escalation to Slack through `.agro/skills/escalate/scripts/escalate.sh`. The skill has no script that reads the operator's answer. Unattended approval loops read GitHub comments instead. Every session on one host shares one `gh` login. Each session on that host can post the approving comment. Slack separates the identities. The bot posts as the bot user. The operator alone posts as the operator member ID.

Verified current state:

- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from the `.devcontainer/` env file. The script does not read the bridge config token.
- `escalate.sh` already resolves the bridge config through `ESCALATE_BRIDGE_CONFIG`, with the default in the home directory under `.pi`.
- The delivered JSON result and the escalation log already carry `ts`. The `--dry-run` JSON has no `ts` key.
- `escalate.sh` passes the token to `curl` through `-H @<(printf 'Authorization: Bearer %s\n' ...)`. `.agro/evals/probes/escalate-contract.sh` pins that pattern.
- `.pi/install/slack-manifest.yaml` declares the 7 bridge slash commands, `reactions:read`, `channels:history`, `groups:history`, `im:history`, and 4 message events. The manifest lacks the `commands` bot scope.
- `.agro/evals/probes/slack-admin-command-surface.sh` extracts the manifest copy from `docs/integrations/slack.md` section 2 and compares it with `.pi/install/slack-manifest.yaml`.
- `vitest.config.ts` includes `.agro/scripts/__tests__/**/*.test.ts`. The configuration does not include tests under `.agro/skills/`. The new tests therefore live in `.agro/scripts/__tests__/`.
- `.agro/scripts/gateway.sh` `start_pi` reads the token from the environment, then from the `.devcontainer/` env file. This task does not change `start_pi`.

Selected approach: add one sourced token resolver, add one stateless decision reader that calls `reactions.get` and `conversations.replies`, add the `commands` scope, and document the one-app-per-host rule.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | token block, `--dry-run` output, final `jq` result | Sources the new resolver; adds `ts` to the dry-run JSON |
| new file `.agro/skills/escalate/scripts/slack-token.sh` | token resolver function | One token lookup order for both scripts |
| new file `.agro/skills/escalate/scripts/escalate-decision.sh` | `reactions.get`, `conversations.replies` | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | Rules, Resolution, Not this skill | Documents the reader and the token source |
| `.agro/scripts/gateway.sh` | `start_pi` | Reference only: bridge token source; no change |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Adds `commands` |
| `docs/integrations/slack.md` | sections 2, 5, 6 | Manifest copy, one-app-per-host rule, DM command prefix |
| `.agro/evals/probes/escalate-contract.sh` | header-file check | Extends the token-in-argv guard to the reader |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest checks | Requires `commands` and `reactions:read` |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` token resolution | changed | Reads `.slack.botToken` from the bridge config when the environment and the env file have no token |
| `escalate.sh --dry-run` JSON | changed | Adds `ts: null` so the dry-run shape matches the send shape |
| `escalate-decision.sh` | new | `--channel <id> --ts <ts>` prints `approve`, `reject`, or `none` |
| `ESCALATE_OPERATOR_SLACK_ID` | new | Sets the operator member ID for decisions |
| Slack app manifest | changed | Adds the `commands` bot scope |

## Storage

N/A. The reader is stateless and writes no file. The caller keeps its own state. The reader reads the bridge config and writes nothing to the config.

## Architectural Decisions

- The operator Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. When the variable is unset, the first `slack:` entry of `.auth.trustedUsers` sets the ID.
- A trusted bridge user is not automatically a decision identity. Only the one resolved member ID counts.
- `slack-token.sh` is the one source of the token lookup order for both scripts.
- The scripts never put the token on a command line, in stdout, in stderr, or in the log.
- The reader answers one question for one message. Callers own their queues, their polling, and their timeouts.
- When the operator gave both signals, `reject` wins, because a wrong reject costs less than a wrong approve.
- Configuration and Slack API failures exit 2. Usage failures exit 64. A missing decision is not a failure: the reader prints `none` and exits 0.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/scripts/__tests__/escalate.test.ts` | token from env; token from bridge config only; no token in any source; stub token absent from all output; dry-run `ts` is `null`; send result has `ts` | US-001 |
| new file `.agro/scripts/__tests__/escalate-decision.test.ts` | approve by ✅; approve by reply; reject by ❌; reject by reply; both signals give `reject` | US-002 decisions |
| new file `.agro/scripts/__tests__/escalate-decision.test.ts` | other user gives `none`; no signal gives `none`; `missing_scope` exits 2; no operator exits 2; bad arguments exit 64; token absent | US-002 failures |
| `.agro/evals/probes/escalate-contract.sh` | reader present, executable, and header-file token | US-003 |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest has `commands` and `reactions:read`; doc copy matches | US-004 |

Write each red test first. Each test puts a stub `curl` first on `PATH`. The stub returns fixture JSON per Slack method and records its arguments. Run `pnpm test:scripts` and `bash .agro/skills/eval/run.sh`. CI runs both in `.github/workflows/ci-harness.yml`.

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make each human decision explicit and attributable to one member ID.
- Report a missing Slack scope by name.
- Keep one source of truth for each policy: the token order lives in `slack-token.sh`, and the manifest lives in `.pi/install/slack-manifest.yaml`.
- Add no comments to tracked code. Express intent through names and tests.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Changes to `.agro/scripts/gateway.sh` `start_pi`.
- Automatic migration of two hosts that share one Slack app.
- Pagination of `conversations.replies` beyond the first page.

## Open Questions

1. The issue asks for the Slack `ts` in the `--dry-run` output. A dry run posts no message, so no `ts` exists. This plan emits `ts: null`. Confirm, or name another value.
2. Does a thread reply match `approve` and `reject` case-insensitively? This plan matches case-insensitively after leading whitespace.
3. Does `mifunedev/agro-web` mirror `docs/integrations/slack.md`? When the answer is yes, the one-app-per-host rule needs a matching change there.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] Only reactions and thread replies from the operator member ID count as a decision.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` and `needed` fields.
- [ ] Both scripts take the bot token from the bridge config `.slack.botToken` when no other source holds the token, and never print the token.
- [ ] The delivered JSON result and the `--dry-run` JSON of `escalate.sh` both carry a `ts` key.
- [ ] `docs/integrations/slack.md` holds the complete manifest with the `commands` scope and states the one-app-per-host rule.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

## Lessons

Filled by the advisor before undraft.
