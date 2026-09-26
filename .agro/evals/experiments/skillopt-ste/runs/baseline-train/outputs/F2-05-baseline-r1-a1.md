# `.agro/logs/`

Every coding harness reads this file directly.

This directory holds durable operational records that unattended sessions
write. Git ignores everything in this directory except this file. A log is
evidence for the next session and for the operator. A log is not repository
content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt. The object marks the attempt delivered or not delivered. |

When a session must leave evidence that outlives the session, write a record
here. Examples: an escalation the operator has not answered; a decision the
session made without consent because the session could not obtain consent;
a finding that exists only in a tmux scrollback otherwise.

Do not write a process log that a service already owns, for example
`/tmp/cron-*.log` or `/tmp/client-slack-*.log`. Do not duplicate a claim that a
probe or `RESULTS.md` already asserts. Do not use this directory as a
substitute for `evidence.md` in a task folder.

Each record is one line of JSON. The one-line-per-record format keeps the file
append-only and greppable without a parser:

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

When a record must survive the session, write the record here. A session able
to act on a finding acts on the finding. A session unable to act on a finding
writes the record here. That session also alerts the operator.

Rotation is manual. Humans read these files after an incident. When a file's
records no longer guide a decision, the operator truncates the file. Never
rewrite an existing record in place.
