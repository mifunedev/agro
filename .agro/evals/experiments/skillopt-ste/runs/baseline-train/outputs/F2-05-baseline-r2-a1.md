# `.agro/logs/`

Every coding harness reads this file directly.

This directory holds durable operational records. Unattended sessions write
these records. Git ignores every file in this directory except this file. A log
is evidence for the next session and for the operator. A log is never
repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt — delivered and not delivered alike |

## When to write a record

A session writes a record here only when the record must survive the session.
Write a record for each of these cases:

- an escalation that the operator has not answered;
- a decision that the session made without operator consent, because the
  session could not get consent;
- a finding that otherwise exists only in a tmux scrollback.

If a session can still act on a finding, the session acts on the finding. If a
session cannot act on the finding, the session takes these steps:

1. The session writes the record to this directory.
2. The session reports the record in <location that the operator reads>.

## When not to write a record

Do not write a record here in these cases:

- The record is a process log that a service already owns, for example
  `/tmp/cron-*.log` or `/tmp/client-slack-*.log`.
- A probe or `RESULTS.md` already asserts the fact.
- The record replaces `evidence.md` in a task folder.

## Record format

Each record is one line of JSON. This format keeps the file append-only. This
format also lets the operator search the file with `grep`, without a JSON
parser.

The command below lists each escalation that reached no human:

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

## Rotation

The operator rotates these files by hand. The files stay small. The operator
reads the files after a failure.

1. If <condition that makes a log file no longer useful>, the operator
   truncates the file.
2. The operator never rewrites a record in place.
