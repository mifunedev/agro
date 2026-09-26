---
name: escalate
description: |
  Deliver a human-addressed escalation from an unattended session to the
  supervisor session and to the operator's Slack channel, so a finding that
  needs a person does not die in a log nobody tails or a GitHub thread that
  notifies no one.
  TRIGGER when: an unattended, detached, cron, or background session is blocked
  and needs an operator decision; a finding requires consent the session cannot
  give (restart infrastructure, spend budget, change identity, publish
  externally); a guard or cap refuses and only a human can lift it; asked to
  "escalate this", "tell the operator", "notify me", or "ping me in Slack".
  Do NOT trigger for routine progress, completion notices, or anything the
  session can resolve itself. No-ops when every destination is unavailable.
argument-hint: "--summary <what happened> --needs <the human decision> [--tried <what you already did>] [--supervisor <herdr-target>] [--key <dedupe-key>] [--link <url>]"
allowed-tools: Bash
---

# Escalate

Send one escalation to the supervisor session and to the operator's Slack
channel. Use the bundled script. The script is the only supported path. The
script works with no live agent and no attached terminal.

```bash
bash .agro/skills/escalate/scripts/escalate.sh \
  --summary    "<what happened, in one or two sentences>" \
  --needs      "<the decision only the operator can make>" \
  --tried      "<what you already attempted and why it was not enough>" \
  --supervisor "<herdr pane id or agent name>" \
  --key        "<stable-slug>" \
  --link       "<issue, PR, or log URL>"
```

## When to escalate

Escalate only when a human blocks the session. The bar is a decision, not a
status.

| Escalate | Do not escalate |
|---|---|
| A guard, cap, or permission refuses and only the operator can lift it | A task finished, or the task makes normal progress |
| An action needs consent the session cannot give — restart infrastructure, spend budget, publish externally, change identity | A problem the session can fix, retry, or route around itself |
| A finding will rot unseen before the next run | A finding already sits where the operator will see it |

An escalation that names no decision is a log line. The script requires
`--needs` for exactly that reason. A caller who cannot state the human decision
is reporting, not escalating.

## Destinations

The script attempts two destinations in this order.

| Order | Destination | Transport | Resolution |
|---|---|---|---|
| 1 | Supervisor session | `herdr agent send <target>` then `herdr pane send-keys <target> Enter` | `--supervisor`, else `AGRO_SUPERVISOR_PANE` |
| 2 | Operator Slack channel | `chat.postMessage` | `--channel`, else the first enabled bridge channel |

The supervisor runs an advisor in a Herdr pane and reads that pane. The
supervisor acts on a live escalation before the Slack channel reaches a person.

`herdr agent send` writes the text into the pane and submits nothing. The
following `herdr pane send-keys <target> Enter` submits the text. The script
makes both calls.

The script skips the supervisor destination when no target resolves. The Slack
delivery then runs exactly as before.

The supervisor session starts an advisor with an environment variable, so the
advisor resolves the supervisor without a flag:

```bash
herdr agent start <name> --cwd <harness root> --env AGRO_SUPERVISOR_PANE=<pane>
```

## Rules

1. **Say what you already tried.** An operator who cannot tell what the session
   attempted must redo the diagnosis before acting. Use `--tried`.
2. **Pass a `--key` for every recurring finding.** The script suppresses the same key
   for 12 hours (`ESCALATE_QUIET_HOURS`). A repeating session that escalates one
   finding every run trains the operator to ignore the channel. The
   `prompt-miner` cron sent one escalation nine times before anyone acted. Use
   `--force` only when the situation changed.
3. **Never assume delivery. Exit 0 is not proof.** An unavailable destination is
   a **no-op**, not an error. The script exits `0` so a dead channel does not
   break the blocked session. Read `.ok` on stdout. `.ok` is true when at least
   one destination delivered. `.ok` is false when no destination delivered, and
   the operator was **not** reached. Read `.destinations` to learn which
   destination delivered and which one failed. After a false `.ok`, surface the
   escalation where a human will look — a PR comment, the PR body. The script
   already wrote the record (see below). The script made nobody read the record.
4. **One escalation per blocker.** Do not narrate a session in Slack.
5. **Read the reply channel honestly.** Sending does not wait for an answer.
   A session without its answer must stop and leave durable state. A caller
   can check one message later with `escalate-decision.sh`; it must not poll.

## Exit codes

Branch on `.ok` in the JSON on stdout, not on the exit code alone.

| Exit | stdout | Meaning | What the session must do |
|---|---|---|---|
| `0` | `{"ok":true,...,"destinations":{...}}` | At least one destination delivered | Continue |
| `0` | `{"ok":false,"skipped":true,"reason":...,"destinations":{...}}` | **No-op** — every attempted destination failed | **Record the escalation elsewhere; the operator did not see it** |
| `64` | — | Bad usage: missing `--summary` or `--needs` | Fix the call |
| `75` | — | The quiet window for this `--key` suppressed every destination | Continue; the operator already heard this |

## The destinations object

Stdout carries a `destinations` object. The object holds one entry per attempted
destination. Each entry carries `ok` and `reason`.

```json
{
  "ok": true,
  "channel": "C0123456789",
  "ts": "1757630000.000100",
  "destinations": {
    "supervisor": { "ok": true, "reason": "delivered to w6:p3", "target": "w6:p3" },
    "slack": { "ok": false, "reason": "channel C0123456789 is archived", "channel": "C0123456789" }
  }
}
```

The object omits the `supervisor` entry when no supervisor target resolves. The
script attempts the Slack destination on every run, so the object always carries
the `slack` entry.

## Destination health

The script checks the resolved Slack channel with `conversations.info` before
every send. A destination **no-ops** — never raises — under any of these
conditions:

- `herdr` is absent from `PATH`;
- the Herdr server is down, or the supervisor target does not resolve;
- no `PI_SLACK_BOT_TOKEN` resolves (the script checks before any network call);
- the caller passed no `--channel` and the bridge config enables no channel;
- Slack is unreachable, or answers `not_in_channel`, `channel_not_found`,
  `invalid_auth`, or another error;
- the Slack channel is archived;
- Slack rejects `chat.postMessage`.

A dead destination must not take down the session that reports through it. That
constraint is the whole reason for a no-op instead of a failure. A no-op is
still a **non-delivery**. Rule 3 governs what the session owes the operator
after a no-op. Silence is the exact failure this skill removes, so the script
always prints the reason to stderr and returns the reason in the JSON.

## Resolution

- **Supervisor target**: `--supervisor`, else `AGRO_SUPERVISOR_PANE`. A target
  is a Herdr pane id, a terminal id, or a unique agent name.
- **Token**: `PI_SLACK_BOT_TOKEN` from the environment, else from
  `.devcontainer/.env`, else `.slack.botToken` from the bridge config. The
  scripts pass the token to `curl` through a header file, never on the command
  line where `/proc` would expose it.
- **Channel**: `--channel`, else the first `enabled` entry in
  `~/.pi/msg-bridge.json` under `auth.channels`.
- **State**: quiet-window markers in `~/.agro/escalate` (`ESCALATE_STATE_DIR`).
  The script keeps an existing legacy `~/.agro/escalate` directory in use, so an
  open quiet window survives.
- **Harness root**: `AGRO_PROJECT_ROOT`, else the legacy alias
  `AGRO_PROJECT_ROOT`, else the path four levels above the script.
- **Log**: every attempt appends one JSON line to
  `$AGRO_PROJECT_ROOT/.agro/logs/escalations.jsonl` (`ESCALATE_LOG`). The line
  carries the per-destination result. The path resolves to the **harness root**,
  so sessions in worktrees and cron checkouts write one canonical trail. Logging
  never fails the send.

  ```bash
  jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
  ```

  The log makes a no-op recoverable. The next session, or the operator after the
  fact, sees that the script attempted an escalation and that every destination
  failed. See [`.agro/logs/AGENTS.md`](../../logs/AGENTS.md).
- **Timeout**: `ESCALATE_TIMEOUT` seconds per Slack call and per Herdr call,
  default 10. An unreachable destination must not hang an unattended session.

Verify the wiring without a send by adding `--dry-run`. The dry run prints the
resolved supervisor target, the resolved channel, and the exact rendered
message.

## Read one decision

Save `.channel` and `.ts` from a successful Slack send. The dry run sets `ts`
to an empty string because it sends no message. When the caller is ready to
check the message, run:

```bash
bash .agro/skills/escalate/scripts/escalate-decision.sh \
  --channel C0123456789 --ts 1757630000.000100
```

The reader prints `approve`, `reject`, or `none` and exits 0. Only the operator's
`white_check_mark` or `x` reaction, or a thread reply beginning with `approve`
or `reject`, counts. A reject wins over an approve. The reader uses
`ESCALATE_OPERATOR_SLACK_ID`, else the first `slack:` member ID in the bridge
config's `auth.trustedUsers`. It compares exact Slack IDs. On a missing
identity, transport failure, or Slack API error, it exits 2 and reports the
error and any `needed` scope. Never treat exit 2 as `none` or as consent.
The caller owns its state and decides when to check. Do not poll.

## Not this skill

- **Sending a routine message to Slack.** This skill carries escalations. The
  format and the dedupe assume a human must act.
- **Talking to the gateway agent.** The `client-slack-pi` tmux session runs an
  interactive agent. Do not type into that session to send a message. Typing
  needs a human at a keyboard, and this skill removes that failure.
- **Watching replies continuously.** Neither script watches Slack. The caller
  owns decision timing and durable state.
