# PRD: Escalate Slack decisions

Status: DRAFT

## User Stories

### US-001: Read operator decisions

**Description:** As an unattended session, I want to read one operator decision so that I act only after human approval.

**Acceptance Criteria:**

- [ ] `escalate-decision.sh --channel C123 --ts 1757630000.000100` prints exactly `approve`, `reject`, or `none` and exits 0 for valid Slack responses.
- [ ] Only reactions `white_check_mark` and `x` by the configured operator count.
- [ ] Only thread replies beginning with `approve` or `reject` by the configured operator count.
- [ ] Another user's reaction or reply does not count; a reject takes precedence over an approve.
- [ ] A Slack API error exits 2 and prints the `error` and `needed` fields without exposing the token.
- [ ] Stubbed HTTP tests cover approvals, rejections, other users, API errors, and missing operator identity.

### US-002: Resolve credentials and message identity

**Description:** As an operator, I want the scripts to use bridge credentials so that an unattended session can read a decision.

**Acceptance Criteria:**

- [ ] Both scripts use `.slack.botToken` from the bridge config when neither the environment nor `.devcontainer/.env` provides a token.
- [ ] Neither script prints the bot token or puts it in a process argument.
- [ ] `escalate.sh --dry-run` includes `ts` in JSON; a successful Slack send includes the returned `ts` in JSON.
- [ ] Stubbed HTTP tests cover token fallback, token precedence, and timestamp output.

### US-003: Document and configure Slack

**Description:** As an operator, I want a complete app manifest so that the gateway receives commands and decision events on its own host.

**Acceptance Criteria:**

- [ ] The tracked Slack manifest declares seven bridge slash commands, `commands`, `reactions:read`, required history scopes, and message events.
- [ ] The Slack guide states that each host needs its own Slack app and explains operator identity, scopes, and the decision command.
- [ ] The escalate skill explains decision interpretation and error handling without instructing sessions to poll.
- [ ] A deterministic manifest check and the repository validation commands pass.

## Summary

`escalate.sh` sends messages to Slack but has no decision reader. The tracked manifest already declares seven commands, message events, and most required scopes. Add one stateless decision command. Use the Slack operator member ID, not the bot token or shared GitHub identity, as the authorization boundary.

## Key Integration Points

| File | Symbol | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate.sh` | `slack_api` | Send and return message timestamp. |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | command | Read reactions and thread replies. |
| `.pi/install/slack-manifest.json` | `oauth_config` | Declare bot permissions. |
| `docs/integrations/slack.md` | setup | Explain app and host setup. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate-decision.sh --channel <id> --ts <ts>` | New | Print one decision or an error. |
| `escalate.sh --dry-run` | Modify | Include the timestamp field. |
| Slack manifest and guides | Modify | Include required permissions and setup instructions. |

## Storage

N/A. The reader does not persist decisions. The caller owns its state.

## Architectural Decisions

- Use `ESCALATE_OPERATOR_SLACK_ID` when set; otherwise use the first `slack:` entry in `.auth.trustedUsers`.
- If the operator identity is absent or Slack denies a request, fail closed with exit 2. Never treat failure as `none`.
- Count only exact Slack operator user IDs. Give rejection precedence when decisions conflict.
- Resolve the bot token from the environment, then `.devcontainer/.env`, then the bridge configuration. Keep it out of process arguments and output.
- Read one message per invocation. Callers keep their own queues; do not add polling.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/escalate/scripts/test-escalate-decision.sh` | reactions, replies, identity, API errors, credential precedence | Reader and sender contracts. |
| `.agro/evals/probes/escalate-contract.sh` | existing delivery cases | Delivery regression. |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing destination cases | Delivery regression. |

## Design Principles

- Make the smallest change that preserves the existing delivery contract.
- Use code and tests as the source of truth. Do not add explanatory comments to tracked code.
- Never confuse an API failure with the absence of a decision.

## Out of Scope

- Workflow-specific queues, interactive buttons, and multi-operator approval.
- A daemon that watches Slack.

## Open Questions

None.

## Acceptance Criteria

- [ ] All three stories pass their binary checks.
- [ ] Stubbed HTTP tests and affected regression probes pass.
- [ ] CI passes on the published PR branch.

## Lessons

Filled after implementation.
