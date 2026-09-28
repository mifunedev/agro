# PRD: Remind and expire unanswered escalate decisions

Status: DRAFT

## User Stories

### US-001: Process pending escalation deadlines

**Description:** As an unattended loop, I want a deadline check for unanswered escalations so that silence cannot authorize an action.

**Acceptance Criteria:**

- [ ] A caller supplies a JSON array on stdin to `.agro/skills/escalate/scripts/escalate-timeouts.sh`; each item has `channel`, `ts`, and `link` strings.
- [ ] Before 24 hours after Slack `ts`, the script emits no reminder; at 24 hours it requests one reminder; at 72 hours it reports expiry instead.
- [ ] The script checks `.agro/skills/escalate/scripts/escalate-decision.sh` before either transition; `approve`, `reject`, and reader exit 2 prevent both posts and expiry.
- [ ] An expired record never invokes the blocked action; the caller owns its close action.
- [ ] `ESCALATE_REMIND_AFTER` and `ESCALATE_EXPIRE_AFTER` override the 24-hour and 72-hour defaults in seconds; invalid thresholds fail without posts.

### US-002: Deliver notices once without unsafe state changes

**Description:** As an operator, I want one reliable reminder and an expiry notice so that I can see when a decision window closes.

**Acceptance Criteria:**

- [ ] A reminder uses `.agro/skills/escalate/scripts/escalate.sh` and persists a marker only after the Slack destination reports `ok: true`.
- [ ] Repeated checks of the same `channel` and `ts` do not post a second successful reminder; a failed Slack post leaves the reminder eligible for retry.
- [ ] Expiry emits an explicit expired result without approving an action and attempts a Slack expiry notice with the original `link`.
- [ ] Concurrent checks under `flock` do not post duplicate notices; `--dry-run` writes no marker or log and sends no Slack message.
- [ ] Stub tests in `.agro/skills/escalate/scripts/test-escalate-timeouts.sh` cover fresh, reminder, repeat, expiry, decided, reader error, post failure, lock, and dry-run cases.
- [ ] `bash .agro/skills/escalate/scripts/test-escalate-timeouts.sh` and `bash .agro/evals/probes/escalate-contract.sh` exit 0.

### US-003: Document the caller contract

**Description:** As a loop author, I want the timeout contract in the escalate skill so that I can close a stale request without assuming consent.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` states the caller input format, threshold variables, output states, locking, marker location, and retry behavior.
- [ ] The skill states that the caller owns its queue and close action; expiry is not approval and no scheduler or polling service is installed.
- [ ] The canonical `.agro/skills/escalate/SKILL.md` remains the source for provider-linked skills.

### US-004: Record manual CLI review

**Description:** As a reviewer, I want a command transcript so that I can confirm deadline and failure behavior without contacting a live operator.

**Acceptance Criteria:**

- [ ] After US-001 through US-003, `.agro/tasks/escalate-timeouts/evidence/manual-review.md` records sandbox prerequisites, commands, observed output, exit status, failure path, and cleanup for a local stub run.
- [ ] The PR `## Manual review` section uses observed evidence in the server, CLI, or API shape from `.agro/skills/git/references/manual-review.md`.
- [ ] Any live Slack review requires operator approval and deletes each created review resource.

## Summary

Issue [#1192](https://github.com/mifunedev/agro/issues/1192) reports a prior deterministic 24-hour reminder and 72-hour expiry, with 18 stub tests and one live test. Those results describe the issue's earlier script, not a test run of this repository. The current `escalate-decision.sh` reads one Slack decision and exits 2 on a read error. The current `escalate.sh` sends an escalation and reports Slack delivery in `.destinations.slack.ok`. Neither script processes unanswered deadlines. Add a caller-invoked timeout command, not a new daemon or cron schedule.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/escalate/scripts/escalate-timeouts.sh` (new) | `ESCALATE_REMIND_AFTER`, `ESCALATE_EXPIRE_AFTER`, `--dry-run` | Check pending records and report transitions. |
| `.agro/skills/escalate/scripts/escalate-decision.sh` | `--channel`, `--ts`; `approve`, `reject`, `none`; exit 2 | Read the operator decision before notices. |
| `.agro/skills/escalate/scripts/escalate.sh` | `--summary`, `--needs`, `--link`, `--channel`; `.destinations.slack.ok` | Send notices and verify Slack delivery. |
| `.agro/skills/escalate/SKILL.md` | `Read one decision`, `Rules`, `Resolution` | Describe caller ownership and deadlines. |
| `.agro/skills/escalate/scripts/test-escalate-timeouts.sh` (new) | stub cases | Exercise deadline, delivery, and lock states. |
| `.agro/evals/probes/escalate-contract.sh` | regression contract | Preserve escalation delivery and reader behavior. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Caller-invoked shell CLI | Add | Read a JSON array of `channel`, `ts`, and `link` strings from stdin and emit machine-readable per-record states. |
| Environment | Add | Interpret `ESCALATE_REMIND_AFTER` and `ESCALATE_EXPIRE_AFTER` as seconds. |
| Skill documentation | Update | Explain input, output, dry run, notices, and caller-owned close action. |
| Slack messages | Add | Post a reminder and an expiry notice through the existing sender. |

## Storage

Store reminder and expiry notice markers under `ESCALATE_STATE_DIR`, else `~/.agro/escalate`, keyed by both channel and timestamp. Keep the caller's pending queue outside this skill. Use atomic marker updates under `flock`. Do not track runtime markers in git. Preserve the sender's existing escalation log contract.

## Architectural Decisions

Use a bounded, caller-invoked command. Do not add a scheduler, a second decision reader, or an approval path. The caller starts the clock only after `escalate.sh` reports a successful Slack send and supplies its returned `ts`. Use that Slack `ts` for both deadlines. The caller owns its pending queue and close action. Check expiry before reminder when both deadlines have passed. Recheck the decision before a notice; stop on reader errors. Serialize concurrent checks before decision reads and marker writes. Consider a Slack notice delivered only when `.destinations.slack.ok` is true. Supervisor delivery alone cannot mark the Slack reminder sent. Report expiry to the caller even if the notice fails. Expose notice failure separately so the caller can close its queue without treating silence as consent. Keep `.agro/` canonical; do not edit provider mirrors.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/escalate/scripts/test-escalate-timeouts.sh` (new) | Fresh, exact 24-hour boundary, exact 72-hour boundary, custom thresholds | Deadline order and seconds. |
| `.agro/skills/escalate/scripts/test-escalate-timeouts.sh` (new) | Repeated run, failed post, decided record, reader exit 2 | Idempotence and fail-closed behavior. |
| `.agro/skills/escalate/scripts/test-escalate-timeouts.sh` (new) | Concurrent lock, dry run, expiry notice failure | No duplicate send, no dry-run write, caller-visible failure. |
| `.agro/evals/probes/escalate-contract.sh` | Existing sender and decision reader cases | Existing no-op and Slack reader contracts remain intact. |

Write failing stub cases before implementation. Run `bash .agro/skills/escalate/scripts/test-escalate-timeouts.sh`, then `bash .agro/evals/probes/escalate-contract.sh` inside the sandbox. Do not run a live Slack test without operator approval.

## Design Principles

Keep the human decision authoritative. Keep queue ownership with the caller. Use one canonical skill and existing sender and reader. Make expiry explicit and never infer approval from elapsed time. Do not add explanatory comments to tracked code.

## Out of Scope

Workflow-specific close actions, automatic approval, a polling loop, a new cron job, a Slack gateway change, and a user interface are out of scope. The CLI change requires a manual command transcript, not a browser journey. Public `mifunedev/agro-web` documentation is not needed unless implementation adds a public operator workflow.

## Open Questions

None. The operator approved a JSON array on stdin and Slack `ts` as the clock start. The implementation must document its per-record output schema before callers depend on it.

## Acceptance Criteria

- [ ] The timeout command sends at most one successful Slack reminder per pending escalation after 24 hours and reports expiry after 72 hours.
- [ ] A read error, an operator decision, or a failed reminder post cannot create a reminder marker.
- [ ] Concurrent calls and dry runs satisfy the storage and no-post contracts.
- [ ] The new stub suite and existing escalation contract probe exit 0 in the sandbox.
- [ ] The skill documents caller responsibility and the manual review evidence records observed commands.

## Lessons

- Claim: Distinct pending records must not share a notice marker. Evidence: the stub test uses channel names that collided under the first marker encoding. Outcome: fixed in this PR with a marker identity from notice kind, channel, and timestamp.
- Claim: Sender diagnostics must not corrupt the JSON delivery result. Evidence: a stub sender emits a warning on stderr and a successful Slack result on stdout. Outcome: fixed in this PR by reading the streams separately.
