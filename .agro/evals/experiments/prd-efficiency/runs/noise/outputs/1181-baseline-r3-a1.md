# PRD: Escalate Slack Decisions

Status: DRAFT

Source: `work/issue-1181.md`. Branch: `feat/<issue#>-escalate-slack-decisions`. PR target: `development`.

## User Stories

### US-001: Resolve the bot token from the bridge config

**Description:** As a host operator, I want `escalate.sh` to read the bridge bot token so that I need no manual export.

**Acceptance Criteria:**

- [ ] A new file `.agro/skills/escalate/scripts/slack-lib.sh` holds one token resolver. The resolver checks `PI_SLACK_BOT_TOKEN` first, `.devcontainer/.env` second, and `.slack.botToken` in `$ESCALATE_BRIDGE_CONFIG` third. `$ESCALATE_BRIDGE_CONFIG` defaults to `~/.pi/msg-bridge.json`.
- [ ] `escalate.sh` sources `slack-lib.sh` and contains no other token lookup.
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/.env` token, and a bridge config that holds `.slack.botToken`, `escalate.sh` sends the token to the stub `curl` in an `Authorization` header.
- [ ] If no source holds a token, the `slack` destination reason names all three sources.
- [ ] Stdout, stderr, and `escalations.jsonl` do not contain the fixture token string in any probe case.
- [ ] The `escalate.sh --dry-run` JSON carries a `ts` key. The value follows the decision in Open Question 1.
- [ ] The non-dry-run JSON result and the log line keep the `ts` field that Slack returns.
- [ ] The `Resolution` section of `.agro/skills/escalate/SKILL.md` lists the three token sources in resolver order.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.

### US-002: Read the operator decision for one escalation

**Description:** As an unattended session, I want one tested command that reads the operator decision so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none` on stdout, and exits 0.
- [ ] The reader counts a `white_check_mark` reaction from the operator member ID as `approve`.
- [ ] The reader counts an `x` reaction from the operator member ID as `reject`.
- [ ] The reader counts a thread reply from the operator member ID as `approve` when the reply text starts with `approve`. The reader counts the reply as `reject` when the text starts with `reject`.
- [ ] A reaction or a reply from any other Slack user, the bot user included, gives `none`.
- [ ] If the operator gives an approve signal and a reject signal on one message, the reader prints the result that Open Question 2 selects.
- [ ] The reader resolves the operator member ID from `ESCALATE_OPERATOR_SLACK_ID` first. Without that variable, the reader uses the first `slack:` entry of `.auth.trustedUsers` in the bridge config, without the `slack:` prefix.
- [ ] If no operator member ID resolves, or no token resolves, the reader exits 2 and names the missing input on stderr.
- [ ] If Slack returns `ok: false`, the reader exits 2 and prints the `error` field and the `needed` field on stderr. The fixture `{"ok":false,"error":"missing_scope","needed":"reactions:read"}` produces stderr that contains `missing_scope` and `reactions:read`.
- [ ] The reader gets the token from `slack-lib.sh` and sends the token only through a header file, as `escalate.sh` does.
- [ ] Stdout and stderr do not contain the fixture token string in any probe case.
- [ ] The reader makes one read per call. The reader contains no loop that waits for a decision.
- [ ] `.agro/skills/escalate/SKILL.md` documents the reader: the command, the three outputs, exit code 2, the operator identity, the two signal types, and the required scopes.
- [ ] `.agro/skills/escalate/SKILL.md` rule 5 and the `Receiving replies` entry no longer state that the skill receives no answer.
- [ ] The new probe `.agro/evals/probes/escalate-decision-reader.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION`.

### US-003: Document a Slack app setup that works

**Description:** As an operator of a Slack gateway, I want a documented app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` lists the `commands` bot scope.
- [ ] The manifest keeps the 7 bridge slash commands: `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, and `/toggletools`.
- [ ] The manifest keeps `reactions:read`, `channels:history`, `groups:history`, `im:history`, and the bot events `message.channels`, `message.groups`, and `message.im`.
- [ ] The YAML fence in `docs/integrations/slack.md` matches `.pi/install/slack-manifest.yaml` byte for byte.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states the failure when two hosts share one app: Slack delivers each event to one connection only.
- [ ] `docs/integrations/slack.md` states that the bridge accepts a DM admin command only when the text starts with `/`.
- [ ] The troubleshooting table in `docs/integrations/slack.md` maps `not a valid command` to the missing manifest command or the missing `commands` scope.
- [ ] The expected scope list in `.agro/evals/probes/slack-admin-command-surface.sh` includes `commands`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

## Summary

The `/escalate` skill posts an escalation through `.agro/skills/escalate/scripts/escalate.sh`. The skill has no path that reads the operator answer. `SKILL.md` rule 5 states that the skill is one-way.

Verified current state, at commit `7219977`:

- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script does not read `~/.pi/msg-bridge.json` for the token.
- `escalate.sh` reads the bridge config path from `ESCALATE_BRIDGE_CONFIG` and uses the path only for `.auth.channels`.
- `escalate.sh` calls `curl` directly and passes the token through a process-substitution header file.
- The non-dry-run JSON result and the log line carry `ts`. The `--dry-run` JSON carries `dryRun`, `channel`, `supervisor`, and `text`, and no `ts`.
- `.pi/install/slack-manifest.yaml` declares the 7 bridge slash commands, `reactions:read`, the three history scopes, and the three message events. The manifest does not declare the `commands` scope.
- `.agro/evals/probes/slack-admin-command-surface.sh` pins the exact scope list, and checks that the doc YAML fence equals the manifest byte for byte.
- `docs/integrations/slack.md` has no one-app-per-host rule.
- CI runs the probes through the `eval-probes` job in `.github/workflows/ci-harness.yml` (`bash .agro/skills/eval/run.sh`). CI runs `shellcheck` on `.agro/skills/escalate/scripts/*.sh`. No CI job runs `node:test` files under `.agro/skills/*/scripts/__tests__/`.

Selected approach:

1. Move token resolution into one sourced file, `slack-lib.sh`. Both scripts use that file.
2. Add `escalate-decision.sh`. The reader calls `reactions.get` and `conversations.replies` for one message. The reader filters each signal by the operator member ID.
3. Test both scripts with a probe that puts a stub `curl` first on `PATH`. The stub returns fixture JSON per Slack method and records the headers that it receives.
4. Add the `commands` scope to the canonical manifest.
5. Copy the canonical manifest into the doc.
6. Add `commands` to the scope list that the manifest probe pins.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | token block, `--dry-run` branch, `slack_api` | Posts the escalation. Changes to source `slack-lib.sh` and to add `ts` to the dry-run JSON. |
| `.agro/skills/escalate/scripts/slack-lib.sh` | new token resolver | One token source for delivery and decisions |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | `Rules`, `Resolution`, `Not this skill` | Documents the reader and the token order |
| `.agro/scripts/gateway.sh` | `start_pi` | Reference only. The bridge reads its own token. No change. |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical Slack app manifest |
| `docs/integrations/slack.md` | sections 2, 6, and 8 | Manifest copy, one-app-per-host rule, troubleshooting |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list | Pins the manifest |
| `.agro/evals/probes/escalate-contract.sh` | dry-run check | Existing escalate contract |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | Modify | Reads the token from the bridge config when the environment and `.devcontainer/.env` hold none. Adds `ts` to the dry-run JSON. |
| `escalate-decision.sh --channel <id> --ts <ts>` | New | Prints `approve`, `reject`, or `none`. Exits 0, or 2 on an error. |
| `ESCALATE_OPERATOR_SLACK_ID` | New | The operator Slack member ID |
| Slack app manifest | Modify | Adds the `commands` bot scope |
| `docs/integrations/slack.md` | Modify | One app per host, DM command rule, troubleshooting row |

## Storage

N/A. The reader is stateless. The caller keeps its own state. The reader reads `~/.pi/msg-bridge.json` and writes no file.

## Architectural Decisions

- **Source of truth for a decision:** Slack. The operator Slack member ID is the only decision identity. A `gh` login that many sessions share cannot give this separation.
- **Operator identity:** `ESCALATE_OPERATOR_SLACK_ID` first. Without that variable, the first `slack:` entry of `.auth.trustedUsers` in the bridge config.
- **Token handling:** The scripts never put the token on a command line, in output, or in a log. The scripts pass the token to `curl` through a header file. The repository secret guard denies ad-hoc token commands, so the reader must be a committed, tested script.
- **One path per direction:** `escalate.sh` owns delivery. `escalate-decision.sh` owns decisions. `slack-lib.sh` owns token resolution.
- **State management:** None. The reader answers one question for one message. Callers own their queues and their schedule.
- **Exit codes:** `0` with a decision on stdout. `2` for a Slack API error, a transport failure, a missing token, or a missing operator ID.

## Test Plan (TDD)

Write each probe case before the implementation. Each case must fail first.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-decision-reader.sh` | `white_check_mark` from the operator gives `approve` | Reaction approve |
| same | `x` from the operator gives `reject` | Reaction reject |
| same | thread reply `approve ...` from the operator gives `approve`; `reject ...` gives `reject` | Reply signals |
| same | `white_check_mark` and an `approve` reply from another user give `none` | Identity filter |
| same | no reaction and no reply give `none` | Empty case |
| same | approve and reject from the operator give the Open Question 2 result | Conflict rule |
| same | `ok: false` with `missing_scope` and `needed: reactions:read` gives exit 2 and both strings on stderr | API error |
| same | `ESCALATE_OPERATOR_SLACK_ID` unset: the reader uses the first `slack:` entry of `.auth.trustedUsers` | Identity fallback |
| same | no operator ID gives exit 2 | Missing identity |
| same | token only in the bridge config reaches the stub header; the fixture token is absent from stdout and stderr | Token source, no leak |
| `.agro/evals/probes/escalate-contract.sh` | dry-run JSON has a `ts` key | Dry-run `ts` |
| same | token only in the bridge config reaches the stub `curl`; the token is absent from stdout, stderr, and the log | Token source for delivery |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list includes `commands` | Manifest |

The stub `curl` is a fixture script in a temporary `bin` directory that the probe puts first on `PATH`. The stub selects a fixture by the Slack method in the URL. The stub writes the received header file to a temporary path, so that the probe can check the token without a print of the token.

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make the human decision explicit and attributable to one Slack member ID.
- Report a missing Slack scope by name.
- Fail closed: an unknown signal, another user, or an ambiguous state never gives `approve`.
- Follow the `escalate.sh` patterns: `set -euo pipefail`, `jq` for JSON, `ESCALATE_*` environment overrides, `ESCALATE_TIMEOUT` per call.
- Do not add tracked comments. Express intent through names and probes.
- Add no new dependency. Use `bash`, `curl`, and `jq`.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- A wait loop or a poll loop in the reader.
- Changes to `.agro/scripts/gateway.sh` or to the bridge package.
- Automatic detection of two hosts that share one Slack app.

## Open Questions

Approval of this plan accepts each proposed default below.

1. **Dry-run `ts` value.** A dry run posts no message, so Slack returns no `ts`. The issue requires `ts` in the dry-run output. Proposed default: the dry-run JSON carries `"ts": ""`, the same empty value that a failed send reports.
2. **Conflict rule.** The `reactions.get` response carries no reaction time. Proposed default: if the operator gives both an approve signal and a reject signal, the reader prints `reject`.
3. **Reply match.** Proposed default: the reader trims leading whitespace, ignores case, and requires a word boundary after `approve` or `reject`. `approved` does not match.
4. **Reply scope.** Proposed default: the reader counts only replies in the thread of the escalation message, not later top-level messages.
5. **Test location.** The issue allows `__tests__/` or a probe. CI runs no `node:test` file under a skill `__tests__/` directory. Proposed default: a probe in `.agro/evals/probes/`, which the `eval-probes` CI job runs.
6. **Public documentation.** Does `mifunedev/agro-web` need a matching change for the one-app-per-host rule and the `commands` scope? Proposed default: open a follow-up issue in `mifunedev/agro-web` after merge.
7. **Pagination.** `conversations.replies` pages its results. Proposed default: the reader reads the first page with `limit=200` and treats a longer thread as out of scope.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] Each new probe case fails before its implementation and passes after it.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION`.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.
- [ ] `git grep -n 'xoxb-'` finds only fixture strings inside probe files.
- [ ] No new dependency enters the repository.
- [ ] The draft PR `FROM feat/<issue#>-escalate-slack-decisions TO development` exists and CI is green.

## Lessons

Filled by the advisor before undraft.
