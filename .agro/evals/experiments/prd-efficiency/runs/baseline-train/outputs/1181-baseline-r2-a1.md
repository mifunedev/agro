# PRD: Escalate Slack decisions

Status: BLOCKED

## User Stories

### US-001: Resolve the Slack bot token from the bridge config

**Description:** As an operator of a host install, I want `escalate.sh` to find the bridge bot token so that I skip a manual export.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/scripts/slack-token.sh` defines one token resolver. `escalate.sh` sources the resolver.
- [ ] The resolver uses this order: `PI_SLACK_BOT_TOKEN` from the environment, then `PI_SLACK_BOT_TOKEN=` from `.devcontainer/.env`, then `.slack.botToken` from `$ESCALATE_BRIDGE_CONFIG` (default `~/.pi/msg-bridge.json`).
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/.env` token, and a bridge config that holds `.slack.botToken`, `escalate.sh` sends the bridge-config token in the `Authorization` header to the stub `curl`.
- [ ] The token string does not appear in stdout, stderr, the escalation log, or any `curl` argument.
- [ ] With no token in any source, the Slack destination reason names all three sources.
- [ ] `escalate.sh --dry-run` output holds a `ts` key. The failure JSON result holds a `ts` key. The success JSON result keeps its `ts` key.
- [ ] `bash .agro/evals/probes/escalate-token-source.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.

### US-002: Read the operator decision for one escalation

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/escalate/scripts/escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader resolves the operator member ID from `ESCALATE_OPERATOR_SLACK_ID`. If that variable is unset, the reader uses the first `slack:` entry of `.auth.trustedUsers` in the bridge config, without the `slack:` prefix.
- [ ] If no operator member ID resolves, the reader exits 2 and names `ESCALATE_OPERATOR_SLACK_ID` and `.auth.trustedUsers` on stderr.
- [ ] A `white_check_mark` reaction from the operator prints `approve`.
- [ ] An `x` reaction from the operator prints `reject`.
- [ ] An operator thread reply whose text starts with `approve` prints `approve`. An operator thread reply whose text starts with `reject` prints `reject`.
- [ ] A reaction or a thread reply from any other Slack user prints `none`.
- [ ] A Slack response with `ok: false` makes the reader exit 2. stderr holds the `error` field and the `needed` field, for example `missing_scope` and `reactions:read`.
- [ ] The reader takes the token from `slack-token.sh`. The token does not appear in stdout, stderr, or any `curl` argument.
- [ ] `bash .agro/evals/probes/escalate-decision-reader.sh` exits 0 and covers each case above with a stub `curl` on `PATH`.
- [ ] `.agro/skills/escalate/SKILL.md` documents the reader command, the two decision forms, the operator identity rule, and exit codes 0 and 2. The sentence "The script waits for no answer and receives no answer" no longer describes the whole skill.

### US-003: Document a working Slack app setup

**Description:** As an operator of a Slack gateway, I want a complete manifest and a one-app-per-host rule so that each bot receives its own events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` declares the 7 bridge slash commands: `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, and `/toggletools`.
- [ ] The manifest bot scopes include `commands`, `reactions:read`, `channels:history`, `groups:history`, and `im:history`.
- [ ] The manifest bot events include `message.channels`, `message.groups`, and `message.im`.
- [ ] The YAML fence in `docs/integrations/slack.md` section 2 matches `.pi/install/slack-manifest.yaml` byte for byte.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states the cause: two bridges on one app split events between hosts.
- [ ] `docs/integrations/slack.md` states that the bridge accepts a DM admin command only when the text starts with `/`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0 with `commands` in its expected scope list.

## Summary

Verified current state:

- `.agro/skills/escalate/scripts/escalate.sh` posts with `chat.postMessage`. The script reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script reads the bridge config at `$ESCALATE_BRIDGE_CONFIG` (default `~/.pi/msg-bridge.json`) only for the default channel.
- The success JSON result holds `channel` and `ts`. The `--dry-run` JSON and the failure JSON hold no `ts` key.
- `.agro/skills/escalate/SKILL.md` states that the script waits for no answer. No script reads an operator answer.
- The script sends the token through `-H @<(printf ...)`, so the token stays off the `curl` command line. The new reader must keep this pattern.
- `.pi/install/slack-manifest.yaml` already declares the 7 slash commands, `reactions:read`, the three history scopes, and the three message events. The manifest has no `commands` scope.
- `docs/integrations/slack.md` holds a byte-identical copy of the manifest. `.agro/evals/probes/slack-admin-command-surface.sh` enforces the copy and an exact expected manifest.
- The documentation has no one-app-per-host rule.
- CI job `eval-probes` in `.github/workflows/ci-harness.yml` runs `bash .agro/skills/eval/run.sh`. The existing escalate probes run there. `vitest.config.ts` does not include `.agro/skills/**/__tests__/`.

Selected approach: add a shared token resolver, add one stateless decision reader, and correct the manifest and the setup documentation. Tests are eval probes with a stub `curl` on `PATH`, next to the two existing escalate probes.

Facts from the issue that this plan does not verify locally: the bridge stores the bot token at `.slack.botToken`, and the field defects of 2026-09-26.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/slack-token.sh` | token resolver (new) | One token source for delivery and decisions |
| `.agro/skills/escalate/scripts/escalate.sh` | token block, `--dry-run` output, final JSON | Sources the resolver; adds `ts` to every JSON result |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | decision reader (new) | Calls `reactions.get` and `conversations.replies`; prints one decision |
| `.agro/skills/escalate/SKILL.md` | procedure | Documents the reader |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Adds `commands` |
| `docs/integrations/slack.md` | section 2 manifest fence, one-app-per-host rule | Setup documentation |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected manifest | Adds `commands` to the expected scopes |
| `.agro/scripts/gateway.sh` | `start_pi` | Read only. The bridge token path does not change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Reads the token from the bridge config as the last source; every JSON result holds `ts` |
| `escalate-decision.sh --channel <id> --ts <ts>` | new | Prints `approve`, `reject`, or `none`; exits 0, or exits 2 on a Slack or config error |
| `ESCALATE_OPERATOR_SLACK_ID` | new environment variable | The operator Slack member ID |
| Slack app manifest | changed | Adds the `commands` bot scope |

## Storage

N/A. The reader is stateless. The caller keeps its own state. The resolver reads the existing `.devcontainer/.env` and `~/.pi/msg-bridge.json` and writes nothing.

## Architectural Decisions

- The operator's Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. Without that variable, the first `slack:` entry of `.auth.trustedUsers` sets the ID.
- `slack-token.sh` is the single token source for both scripts. `gateway.sh` keeps its own token logic in this task.
- The scripts never put the token on a command line, in output, or in a log. Both scripts pass the header through process substitution.
- The reader answers one question for one message. Callers own their queues, their polling, and their timeouts.
- The reader calls `reactions.get` with `full=true` and `conversations.replies`. The reader ignores the parent message in the replies.
- A Slack error is exit 2, not `none`. A caller never reads a missing scope as "no decision yet".

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-token-source.sh` (new) | env token wins; `.devcontainer/.env` token; bridge-config token; no token names 3 sources; token absent from output, log, and `curl` argv; `ts` key in all JSON | US-001 |
| `.agro/evals/probes/escalate-decision-reader.sh` (new) | ✅ by operator; ❌ by operator; reply `approve`; reply `reject`; other user; no decision; `missing_scope` error; no operator ID; token absent | US-002 |
| `.agro/evals/probes/slack-admin-command-surface.sh` (changed) | expected manifest holds `commands` | US-003 |
| `.agro/evals/probes/escalate-contract.sh`, `.agro/evals/probes/escalate-destination-fan-out.sh` (unchanged) | existing no-op and fan-out contract | No regression in US-001 |

Each new probe follows `.agro/evals/AGENTS.md`: `# tier:`, `# source:`, and `# desc:` headers, paths from `${BASH_SOURCE[0]}`, and a run time under 30 seconds. Drive each REGRESSION branch against a broken copy before landing.

## Design Principles

- Keep one path to Slack for delivery and one for decisions.
- Keep one source for the bot token.
- Make the human decision explicit and attributable to one member ID.
- Report a missing Slack scope by name.
- Write no explanatory comments in tracked code (root `AGENTS.md`, principle 5).

Surface review:

- Host and sandbox: applied. The scripts run on the host install and in the sandbox.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: applied. All skill changes are in `.agro/skills/escalate/`.
- Root and scaffold: applied. Initialized projects receive the skill and the manifest.
- Interactive and headless processes: not applicable. The reader is a one-shot command.
- Local and remote operation: applied. The reader needs no attached terminal.
- Parallel operation: applied. The reader is stateless.
- Public documentation: open. See question 4.
- Verification: applied. See the test plan.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Changes to the token logic in `.agro/scripts/gateway.sh`.
- A code fix for event splitting between two bridges on one Slack app. This task documents the rule only.

## Open Questions

1. Which decision wins when the operator gives both an approve signal and a reject signal on one message?
   - A. Print `none` and let the operator resolve the conflict. (Recommended: reactions carry no timestamp.)
   - B. The latest thread reply wins; reactions lose to replies.
   - C. `reject` wins.
2. How does the reader match a thread reply?
   - A. Trim leading whitespace, compare case-insensitively, and require a word boundary after `approve` or `reject`. (Recommended.)
   - B. Exact lowercase prefix only.
3. What does "`escalate.sh --dry-run` output includes the Slack `ts`" mean? A dry run posts nothing and has no `ts`.
   - A. Every JSON result holds a `ts` key; the key is empty when no post happened. (Recommended; this plan uses A.)
   - B. Drop the dry-run part of the criterion.
4. Does `mifunedev/agro-web` mirror `docs/integrations/slack.md`?
   - A. Yes: add a matching change in `mifunedev/agro-web`.
   - B. No: this repository holds the only copy.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts ✅ (`white_check_mark`) and ❌ (`x`) reactions, and thread replies that start with `approve` or `reject`, only from the operator member ID.
- [ ] A decision from another Slack user prints `none`.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` and `needed` fields.
- [ ] `escalate.sh` and the reader take the bot token from `~/.pi/msg-bridge.json` `.slack.botToken` when no other source holds a token, and never print the token.
- [ ] `escalate.sh --dry-run` output and its JSON result hold a `ts` key.
- [ ] The Slack manifest and its documentation copy hold the 7 bridge slash commands, the `commands` scope, `reactions:read`, the history scopes, and the message events.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app.
- [ ] `bash .agro/skills/eval/run.sh` reports PASS for `escalate-token-source`, `escalate-decision-reader`, `slack-admin-command-surface`, `escalate-contract`, and `escalate-destination-fan-out`.
- [ ] CI job `eval-probes` passes on the task branch.

## Lessons

Filled by the advisor before undraft.
