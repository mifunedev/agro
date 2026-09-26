# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Resolve the Slack bot token from the bridge config

**Description:** As a host operator, I want `escalate.sh` to read the bot token from the bridge config so that I need no manual export.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/scripts/slack.sh` exists and defines the token resolution and the Slack API call that both escalate scripts source.
- [ ] When `PI_SLACK_BOT_TOKEN` is unset and `.devcontainer/.env` holds no token, `escalate.sh` reads `.slack.botToken` from `ESCALATE_BRIDGE_CONFIG`, default `~/.pi/msg-bridge.json`.
- [ ] The resolution order is: the environment, then `.devcontainer/.env`, then the bridge config.
- [ ] With a fixture token in the bridge config and a stub `curl` on `PATH`, stdout, stderr, and the `ESCALATE_LOG` file contain no copy of the token.
- [ ] The stub `curl` receives the token only through a header file, never as a command-line argument.
- [ ] `escalate.sh --dry-run` prints a JSON object that has a `ts` key with the value `null`.
- [ ] A delivered `escalate.sh` run prints a JSON object whose `ts` equals the `ts` from the stub `chat.postMessage` response.
- [ ] `bash .agro/skills/eval/run.sh --probe escalate-contract` and `bash .agro/skills/eval/run.sh --probe escalate-destination-fan-out` report `PASS`.

### US-002: Read the operator decision for one Slack message

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/scripts/escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none`, and exits 0.
- [ ] A `white_check_mark` reaction from the operator member ID prints `approve`.
- [ ] An `x` reaction from the operator member ID prints `reject`.
- [ ] A thread reply from the operator member ID whose text starts with `approve` prints `approve`.
- [ ] A thread reply from the operator member ID whose text starts with `reject` prints `reject`.
- [ ] A `white_check_mark` reaction or an `approve` reply from any other Slack user prints `none`.
- [ ] When the operator gives both an approve signal and a reject signal, the reader prints `reject`.
- [ ] The reader takes the operator member ID from `ESCALATE_OPERATOR_SLACK_ID`. When that variable is unset, the reader takes the first `slack:` entry of `.auth.trustedUsers` in the bridge config.
- [ ] When no operator member ID resolves, the reader prints a message that names `ESCALATE_OPERATOR_SLACK_ID` to stderr and exits 2.
- [ ] When Slack answers `ok: false`, the reader prints the `error` and `needed` fields to stderr and exits 2. The fixture `{"ok":false,"error":"missing_scope","needed":"reactions:read"}` produces output that contains `missing_scope` and `reactions:read`.
- [ ] When no token resolves, the reader exits 2.
- [ ] Missing `--channel` or `--ts` exits 64.
- [ ] The reader prints no copy of the token on stdout or stderr.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.

### US-003: Document the decision reader in the escalate skill

**Description:** As an unattended session, I want the escalate skill to state the decision procedure so that I read the answer through one supported path.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`, its three outputs, its exit codes `0`, `2`, and `64`, and `ESCALATE_OPERATOR_SLACK_ID`.
- [ ] `SKILL.md` states that only the operator member ID counts as a decision, and that a reject signal wins over an approve signal.
- [ ] `SKILL.md` no longer states that the skill is one-way. Rule 5 and the "Receiving replies" entry under "Not this skill" describe the decision reader instead.
- [ ] `SKILL.md` states that the caller keeps the `channel` and `ts` from the `escalate.sh` result and owns its own retry schedule.
- [ ] The **Token** entry under "Resolution" lists the bridge config `.slack.botToken` as the third source.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` reports no new finding in the changed lines.

### US-004: Complete the Slack app manifest and the one-app-per-host rule

**Description:** As an operator of a Slack gateway, I want a documented app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` bot scope.
- [ ] The manifest keeps the 7 slash commands `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, and `/toggletools`.
- [ ] The manifest keeps `reactions:read`, `channels:history`, `groups:history`, `im:history`, and the events `message.channels`, `message.groups`, and `message.im`.
- [ ] The YAML fence in `docs/integrations/slack.md` section 2 stays byte-identical to `.pi/install/slack-manifest.yaml`.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and names the event split between two bridges as the failure.
- [ ] `docs/integrations/slack.md` states that a DM admin command must start with `/`.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` fails when the `commands` scope or the one-app-per-host statement is absent.
- [ ] `bash .agro/skills/eval/run.sh --probe slack-admin-command-surface` reports `PASS`.

## Summary

Verified current state:

- `.agro/skills/escalate/scripts/escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script reads no token from the bridge config.
- `escalate.sh` already reads `ESCALATE_BRIDGE_CONFIG`, default `$HOME/.pi/msg-bridge.json`, for the default channel.
- A delivered `escalate.sh` run already prints `channel` and `ts`. The `--dry-run` output has no `ts` key.
- `escalate.sh` sends the token to `curl` through `-H @<(printf ...)`. The `chat.postMessage` call has no `--max-time`.
- `.agro/skills/escalate/SKILL.md` rule 5 and the "Not this skill" section state that the skill is one-way and receives no answer.
- `docs/integrations/slack.md` section 2 holds the manifest. `.agro/evals/probes/slack-admin-command-surface.sh` requires the fence to match `.pi/install/slack-manifest.yaml` byte for byte.
- The manifest already declares the 7 bridge slash commands, `reactions:read`, the three history scopes, and the three message events. The manifest has no `commands` scope.
- The documentation has no one-app-per-host rule.
- The `ci-harness.yml` shellcheck step already covers `.agro/skills/escalate/scripts/*.sh`. The `eval-probes` job runs `bash .agro/skills/eval/run.sh`.

Selected approach:

1. Move the token resolution and the header-file `curl` call into one sourced file, `slack.sh`.
2. Add `escalate-decision.sh`. The reader calls `reactions.get` and `conversations.replies` for one message, then filters by the operator member ID.
3. Test both scripts with a stub `curl` on `PATH` in a new tier-A probe. The stub returns fixture JSON per Slack method and records its arguments.
4. Update the skill, the manifest, and the Slack documentation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/slack.sh` | token resolution, `slack_api` | New sourced file. One path to the Slack token and the Slack API. |
| `.agro/skills/escalate/scripts/escalate.sh` | token block, `slack_api`, `chat.postMessage` call, dry-run output | Sources `slack.sh`. Adds `ts` to the dry-run output. |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new script | Reads the operator decision for one message. |
| `.agro/skills/escalate/SKILL.md` | Rules, Resolution, Not this skill | Documents the decision reader. |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Adds the `commands` scope. |
| `docs/integrations/slack.md` | section 2 manifest, setup text, troubleshooting | Mirrors the manifest. States the one-app-per-host rule. |
| `.agro/evals/probes/escalate-decision.sh` | new probe | Tests the reader and the token source with a stub `curl`. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `need_literal` checks | Guards the `commands` scope and the one-app-per-host statement. |
| `.agro/scripts/gateway.sh` | `start_pi` | Read only. The bridge token source stays unchanged. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate-decision.sh --channel <id> --ts <ts>` | New | Prints `approve`, `reject`, or `none`. Exits 0, 2, or 64. |
| `ESCALATE_OPERATOR_SLACK_ID` | New | The operator member ID that counts as a decision. |
| `escalate.sh` token resolution | Modify | Adds the bridge config `.slack.botToken` as the third source. |
| `escalate.sh --dry-run` output | Modify | Adds the `ts` key with the value `null`. |
| Slack app manifest | Modify | Adds the `commands` bot scope. |
| `docs/integrations/slack.md` | Modify | Adds the one-app-per-host rule and the leading-`/` rule. |

## Storage

N/A. The reader is stateless. The caller keeps the `channel` and the `ts` from the `escalate.sh` result.

## Architectural Decisions

- **Decision identity:** Only the operator member ID counts. `ESCALATE_OPERATOR_SLACK_ID` wins. The fallback is the first `slack:` entry of `.auth.trustedUsers`, with the `slack:` prefix removed.
- **Signals:** The reader counts the reactions `white_check_mark` and `x` and the thread replies whose trimmed, lowercased text starts with `approve` or `reject`.
- **Conflict:** A reject signal wins over an approve signal. A wrong reject costs one more escalation. A wrong approve can run an unsafe action.
- **Token:** The resolution order is the environment, `.devcontainer/.env`, then the bridge config. Neither script puts the token on a command line, in output, or in a log.
- **One path:** `slack.sh` owns token resolution and the Slack API call. Both scripts source `slack.sh`.
- **Scope:** The reader answers one question for one message. Callers own their queues and their retry schedule.
- **Errors:** A Slack `ok: false` exits 2 and prints `error` and `needed`. The reader never maps an API error to `none`, so a caller cannot mistake a missing scope for "no decision yet".
- **Dry run:** A dry run sends nothing, so no `ts` exists. The dry-run output carries `ts: null` so that callers parse one shape.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-decision.sh` | operator ✅ prints `approve` | Reader, reaction approve |
| same | operator ❌ prints `reject` | Reader, reaction reject |
| same | operator reply `approve` and operator reply `reject` | Reader, thread replies |
| same | ✅ and `approve` reply from another user print `none` | Operator-only identity |
| same | operator ✅ plus operator ❌ prints `reject` | Conflict rule |
| same | `ok: false` with `missing_scope` and `reactions:read` exits 2 and prints both | API error path |
| same | no operator member ID exits 2; missing `--ts` exits 64 | Usage and configuration errors |
| same | `ESCALATE_OPERATOR_SLACK_ID` overrides `.auth.trustedUsers` | Identity resolution |
| same | token only in the bridge config; stub `curl` records the call | Token source for both scripts |
| same | fixture token absent from stdout, stderr, the log, and the stub argument record | No token leak |
| same | `escalate.sh --dry-run` has `ts: null`; a stubbed delivery has the stub `ts` | `ts` in the result |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `commands` scope present; one-app-per-host statement present | Manifest and documentation |
| `.agro/evals/probes/escalate-contract.sh`, `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | No regression in delivery |

The CI job `eval-probes` in `.github/workflows/ci-harness.yml` runs each probe. The shellcheck step in the same workflow covers the new scripts.

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make each human decision explicit and attributable to one member ID.
- Report a missing Slack scope by name.
- Prefer the safe answer: an API error is an error, and a conflict is a reject.
- Add no tracked-code comments. Express intent through names and probes.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- Pagination of `conversations.replies` beyond the first page.
- A `--max-time` on the existing `chat.postMessage` call, unless the `slack.sh` refactor carries the call through `slack_api`.
- Changes to the bridge package or to `.agro/scripts/gateway.sh`.

## Open Questions

1. The repository does not hold the bridge package, so the plan cannot verify the `.slack.botToken` key. The key comes from the issue. The implementation owner confirms the key against a live `~/.pi/msg-bridge.json`.
2. The issue asks for a `ts` in the `--dry-run` output. A dry run posts nothing. The plan uses `ts: null`. The operator confirms this reading.
3. The plan resolves a conflict between an approve signal and a reject signal as `reject`. The operator confirms this rule.
4. The public documentation in `mifunedev/agro-web` can mirror `docs/integrations/slack.md`. The operator decides whether this task includes a matching change there.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts ✅ (`white_check_mark`) and ❌ (`x`) reactions and thread replies that start with `approve` or `reject`, each only from the operator member ID.
- [ ] A decision from another Slack user prints `none`.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` and `needed` fields.
- [ ] When `PI_SLACK_BOT_TOKEN` is unset, `escalate.sh` and the reader take the bot token from `~/.pi/msg-bridge.json` `.slack.botToken`. Neither script prints the token.
- [ ] `escalate.sh --dry-run` output has a `ts` key, and a delivered result has the Slack `ts`.
- [ ] The Slack gateway documentation holds the complete manifest with the `commands` scope and states that each host needs its own Slack app.
- [ ] `bash .agro/skills/eval/run.sh` reports `PASS` for `escalate-decision`, `escalate-contract`, `escalate-destination-fan-out`, and `slack-admin-command-surface`.
- [ ] The `ci-harness.yml` workflow passes on the task branch.

## Lessons

Filled by the advisor before undraft.
