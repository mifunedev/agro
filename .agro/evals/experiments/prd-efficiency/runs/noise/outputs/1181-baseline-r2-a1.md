# PRD: Escalate Slack decisions

Status: BLOCKED

Source: `work/issue-1181.md`. Branch: `feat/<issue#>-escalate-slack-decisions`.

## User Stories

### US-001: Shared Slack token resolution with a bridge-config fallback

**Description:** As a host operator, I want `escalate.sh` to read the bot token from the bridge config so that I skip a manual export.

**Acceptance Criteria:**

- [ ] A new sourced file `.agro/skills/escalate/scripts/slack-common.sh` holds the token resolution and the Slack API call. `escalate.sh` sources this file and keeps no second copy of the token lookup.
- [ ] The token resolution order is: `PI_SLACK_BOT_TOKEN` in the environment, then `PI_SLACK_BOT_TOKEN` in `.devcontainer/.env`, then `.slack.botToken` in `ESCALATE_BRIDGE_CONFIG` (default `~/.pi/msg-bridge.json`).
- [ ] With `PI_SLACK_BOT_TOKEN` unset, no `.devcontainer/.env` token, and a bridge config that holds `.slack.botToken`, `escalate.sh` sends the `Authorization` header with that token to a stub `curl`.
- [ ] The token string does not appear in stdout, in stderr, in `ESCALATE_LOG`, or in the argument vector of any `curl` call. The probe checks all four.
- [ ] The no-token reason names all three sources.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.
- [ ] `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` exits 0.

### US-002: Decision reader script

**Description:** As an unattended session, I want one tested decision command per Slack message so that I act only after a human decides.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/scripts/escalate-decision.sh --channel <id> --ts <ts>` prints exactly one of `approve`, `reject`, or `none` on stdout and exits 0.
- [ ] The reader counts a `white_check_mark` reaction from the operator as `approve`.
- [ ] The reader counts an `x` reaction from the operator as `reject`.
- [ ] The reader counts an operator thread reply as `approve` when the reply text starts with `approve`, and as `reject` when the reply text starts with `reject`. The match ignores letter case and leading whitespace.
- [ ] A reaction or a reply from any other Slack user, the bot included, gives `none`.
- [ ] When the operator gives both an approve signal and a reject signal, the reader prints `reject`.
- [ ] The operator ID comes from `ESCALATE_OPERATOR_SLACK_ID`. When that variable is unset, the operator ID is the first `slack:` entry of `.auth.trustedUsers` in the bridge config, without the `slack:` prefix.
- [ ] When no operator ID resolves, the reader prints a message that names `ESCALATE_OPERATOR_SLACK_ID` on stderr and exits 2.
- [ ] When Slack returns `ok: false`, the reader prints the `error` and `needed` fields on stderr and exits 2. Example: a stub response `{"ok":false,"error":"missing_scope","needed":"reactions:read"}` gives stderr that contains `missing_scope` and `reactions:read`.
- [ ] When `curl` exits non-zero, the reader exits 2 and names the Slack method on stderr.
- [ ] A missing `--channel` or `--ts` exits 64, the same usage code as `escalate.sh`.
- [ ] The reader uses the token resolution in `slack-common.sh` from US-001.
- [ ] The reader makes read-only Slack calls: `reactions.get` and `conversations.replies`.

### US-003: Probe for the reader and the token source

**Description:** As an operator, I want CI to prove each reader case with a stub HTTP client so that a regression cannot reach `development`.

**Acceptance Criteria:**

- [ ] A new probe `.agro/evals/probes/escalate-decision-reader.sh` declares `# tier:`, `# source:`, and `# desc:` headers and follows `.agro/evals/AGENTS.md`.
- [ ] The probe puts a stub `curl` first on `PATH`. The stub returns fixture JSON per Slack method and makes no network call.
- [ ] The probe covers these cases: approve by `white_check_mark`, approve by thread reply, reject by `x`, a decision from another user, both signals from the operator, API `ok: false`, transport failure, no operator ID, token from the bridge config, and no printed token.
- [ ] Each case fails the probe when the named behavior breaks. Record the fault-injection run for each case in the story notes.
- [ ] `bash .agro/evals/probes/escalate-decision-reader.sh` exits 0 in less than 30 seconds.
- [ ] `bash .agro/skills/eval/run.sh` reports the new probe as PASS.

### US-004: Skill documentation for the decision reader

**Description:** As an unattended session, I want the escalate skill to document the decision reader so that I read the operator decision through one path.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` documents `escalate-decision.sh`: the arguments, the three outputs, exit codes 0, 2, and 64, the operator ID resolution, and the required Slack scopes.
- [ ] `SKILL.md` Rule 5 and the "Receiving replies" entry under "Not this skill" state that `escalate.sh` sends and `escalate-decision.sh` reads. `SKILL.md` keeps the rule that a session without a decision stops and does not poll.
- [ ] The token row under "Resolution" lists the bridge-config fallback.
- [ ] `SKILL.md` states that only the operator's Slack member ID counts as a decision.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` reports no finding on the new or changed lines.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.

### US-005: Slack app manifest and one-app-per-host rule

**Description:** As an operator of a Slack gateway, I want a documented app setup that works so that the bot gets commands and events.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` adds `commands` to `oauth_config.scopes.bot`. The manifest keeps the 7 bridge slash commands, `reactions:read`, `channels:history`, `groups:history`, `im:history`, and the 4 message events.
- [ ] The YAML fence in `docs/integrations/slack.md` matches `.pi/install/slack-manifest.yaml` byte for byte.
- [ ] The expected scope list in `.agro/evals/probes/slack-admin-command-surface.sh` includes `commands`, and the probe exits 0.
- [ ] `docs/integrations/slack.md` states that each host needs its own Slack app, and states the failure when two bridges share one app: Slack delivers each event to one connection only.
- [ ] `docs/integrations/slack.md` Troubleshooting has a row for the "not a valid command" rejection. The fix is to update the app from the manifest and reinstall the app.
- [ ] `docs/integrations/slack.md` lists the scopes that `escalate-decision.sh` needs.

## Summary

### Verified current state

- `.agro/skills/escalate/scripts/escalate.sh` posts with `chat.postMessage` and prints `ts` in its JSON result. The log record also carries `ts`.
- `escalate.sh --dry-run` exits before any Slack call. The dry-run JSON has `dryRun`, `channel`, `supervisor`, and `text`, and no `ts`.
- `escalate.sh` reads `PI_SLACK_BOT_TOKEN` from the environment, then from `.devcontainer/.env`. The script does not read the bridge config for a token.
- `escalate.sh` already reads `ESCALATE_BRIDGE_CONFIG` (default `~/.pi/msg-bridge.json`) for the default channel.
- `escalate.sh` passes the token to `curl` through a process-substitution header file. `.agro/evals/probes/escalate-contract.sh` pins that pattern.
- `.agro/skills/escalate/SKILL.md` Rule 5 and "Not this skill" state that the skill is one-way and receives no reply.
- `.pi/install/slack-manifest.yaml` declares the 7 bridge slash commands, `reactions:read`, the 3 history scopes, and the 4 message events. The manifest does not declare the `commands` scope.
- `.agro/evals/probes/slack-admin-command-surface.sh` pins the exact scope list and a byte-for-byte match between the manifest and the doc fence.
- `docs/integrations/slack.md` does not state the one-app-per-host rule.
- CI runs `shellcheck -S warning` over `.agro/skills/escalate/scripts/*.sh` and runs the probe suite through `bash .agro/skills/eval/run.sh` (`.github/workflows/ci-harness.yml`).
- `.agro/scripts/gateway.sh` `start_pi` reads tokens from the environment, then from `.devcontainer/.env`. This task does not change `start_pi`.

### Assumption

- The issue reports that the bridge stores the bot token at `.slack.botToken` in `~/.pi/msg-bridge.json`. The repository does not confirm this key: the bridge package is not installed here, and the tracked `.pi/msg-bridge.json` has no `slack` key. See Open Question 2.

### Selected approach

Add one read-only script, `escalate-decision.sh`, next to `escalate.sh`. Move the token lookup and the Slack API call into one sourced file that both scripts use. Fix the manifest scope and document the one-app-per-host rule. Prove the reader with a probe that stubs `curl`.

### Affected surfaces

| Surface | Mark | Note |
|---|---|---|
| Host and sandbox | applied | The scripts run in the sandbox or on a host install. The bridge-config fallback serves the host install. |
| Lifecycle door | not applicable | No `agro` verb changes. |
| Canonical and provider surfaces | applied | All skill changes go to `.agro/skills/escalate/`. No provider mirror changes. |
| Root and scaffold | applied | The escalate skill ships to initialized projects through the normal payload. |
| Interactive and headless processes | not applicable | The reader is one short command. No process persists. |
| Local and remote operation | applied | The reader answers from Slack state, so a remote operator decides from a phone. |
| Parallel operation | applied | The reader keeps no state. Two sessions can read the same message. |
| Public documentation | applied | `docs/integrations/slack.md` changes. See Open Question 3 for `mifunedev/agro-web`. |
| Verification | applied | New probe, updated Slack probe, existing escalate probes, and CI shellcheck. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | token lookup, `slack_api`, dry-run branch | Posts the escalation and prints `channel` and `ts`. Changes to source `slack-common.sh`. |
| `.agro/skills/escalate/scripts/slack-common.sh` | new: token resolution, Slack API call | One source for the token and the header-file call |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | new | Reads the operator decision for one message |
| `.agro/skills/escalate/SKILL.md` | Rule 5, Resolution, Not this skill | Documents the decision reader |
| `.pi/install/slack-manifest.yaml` | `oauth_config.scopes.bot` | Canonical Slack app manifest |
| `docs/integrations/slack.md` | § 2 manifest fence, § 8 Troubleshooting | Setup and the one-app-per-host rule |
| `.agro/evals/probes/slack-admin-command-surface.sh` | expected scope list | Pins the manifest |
| `.agro/evals/probes/escalate-contract.sh` | token header checks | Pins the token handling |
| `.agro/scripts/gateway.sh` | `start_pi` | Reference only. The bridge token source does not change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` | changed | Reads the token from the bridge config when the environment and `.devcontainer/.env` have none |
| `escalate-decision.sh --channel <id> --ts <ts>` | new | Prints `approve`, `reject`, or `none`. Exit codes: 0 decision read, 2 Slack or configuration error, 64 usage error |
| `ESCALATE_OPERATOR_SLACK_ID` | new environment variable | The operator's Slack member ID |
| `.pi/install/slack-manifest.yaml` | changed | Adds the `commands` bot scope |
| `docs/integrations/slack.md` | changed | Manifest copy, one-app-per-host rule, Troubleshooting row |

## Storage

N/A. The reader keeps no state. The caller keeps its own state. The reader reads the bridge config and does not write the bridge config.

## Architectural Decisions

- **Decision identity:** The operator's Slack member ID is the only decision identity. `ESCALATE_OPERATOR_SLACK_ID` sets the ID. When the variable is unset, the reader uses the first `slack:` entry of `.auth.trustedUsers`. The bot posts as the bot user, so a session cannot forge the operator's decision.
- **Conflict rule:** When the operator gives both an approve signal and a reject signal, `reject` wins. A mistaken reject costs one retry. A mistaken approve can cost an irreversible action.
- **Token handling:** The scripts never put the token on a command line, in output, or in a log. `slack-common.sh` keeps the existing header-file pattern.
- **One Slack path:** `slack-common.sh` owns the token lookup and the Slack call. `escalate.sh` owns delivery. `escalate-decision.sh` owns the decision read.
- **Scope of the reader:** The reader answers one question for one message. Callers own their queues, their retries, and their wait policy.
- **Error surface:** A Slack error is exit 2, not a no-op. A caller must not read a failed read as `none`. This differs from `escalate.sh`, where a failed delivery is a no-op at exit 0.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-decision-reader.sh` | `white_check_mark` approve; reply approve; `x` reject; other user; both signals; `missing_scope` with `reactions:read`; transport failure; no operator ID; no `--ts` | Decision reader (US-002) |
| `.agro/evals/probes/escalate-decision-reader.sh` | token from `.slack.botToken`, token absent from stdout, stderr, log, and `curl` argv | Token source (US-001) |
| `.agro/evals/probes/escalate-contract.sh` | existing cases | `escalate.sh` contract holds after the refactor |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | Destinations object holds after the refactor |
| `.agro/evals/probes/slack-admin-command-surface.sh` | scope list with `commands`, doc fence equals manifest | Manifest (US-005) |
| CI `shellcheck -S warning .agro/skills/escalate/scripts/*.sh` | new and changed scripts | Shell quality |

Write each probe case first. Run the case against the current code and confirm a REGRESSION. Then implement.

## Design Principles

- Keep one path to Slack for delivery and one path for decisions.
- Make the human decision explicit and attributable to one Slack member ID.
- Report a missing Slack scope by name.
- Keep the token out of every command line, output, and log.
- Add no comments to tracked code. Express intent through names and probes.
- Apply YAGNI: no queue, no polling loop, no interactive buttons.

## Out of Scope

- Workflow-specific approval queues.
- Slack interactive buttons.
- Multi-operator approval.
- A polling or wait loop inside the reader.
- Changes to `.agro/scripts/gateway.sh` token handling.
- Code that stops two bridges from sharing one Slack app. This task documents the rule only.

## Open Questions

1. **Blocking.** The issue requires the `ts` in `escalate.sh --dry-run` output. A dry run makes no Slack call, so no `ts` exists. The real JSON result already carries `ts`. Choose one:
   - A. Drop the dry-run clause. Keep the verified `ts` in the real result, and add a probe assertion for the `ts` field.
   - B. Add `"ts": ""` to the dry-run JSON so the dry-run schema matches the real result.
   - C. Other: <specify>.
   Recommendation: A.
2. The repository does not confirm the `.slack.botToken` key in `~/.pi/msg-bridge.json`. Confirm the key against the pinned bridge fork `github:ryaneggz/pi-messenger-bridge#c8b96e9d0fb69611c4e67ae298d1d10d83792a26` before US-001 starts.
3. Does `mifunedev/agro-web` publish `docs/integrations/slack.md` from this repository, or does the page need a matching change in `mifunedev/agro-web`? <answer>
4. The GitHub issue number is not in the input. `prd.json` conversion needs `--issue <N>`.

## Acceptance Criteria

- [ ] `escalate-decision.sh --channel <id> --ts <ts>` prints `approve`, `reject`, or `none`, and exits 0.
- [ ] The reader counts `white_check_mark` and `x` reactions and thread replies that start with `approve` or `reject`, only from the operator's member ID.
- [ ] A decision from another Slack user prints `none`.
- [ ] On a Slack API error, the reader exits 2 and prints the `error` and `needed` fields.
- [ ] `escalate.sh` and the reader take the bot token from `~/.pi/msg-bridge.json` `.slack.botToken` when no other source holds the token, and never print the token.
- [ ] The `escalate.sh` JSON result includes the Slack `ts`. The dry-run clause follows the answer to Open Question 1.
- [ ] `docs/integrations/slack.md` holds a manifest with the 7 bridge slash commands, the `commands` scope, `reactions:read`, the history scopes, and the message events, and states that each host needs its own Slack app.
- [ ] `bash .agro/skills/eval/run.sh` reports PASS for `escalate-decision-reader.sh`, `escalate-contract.sh`, `escalate-destination-fan-out.sh`, and `slack-admin-command-surface.sh`.
- [ ] The CI workflow `ci-harness.yml` passes on the task branch.

## Lessons

Filled by the advisor before undraft.
