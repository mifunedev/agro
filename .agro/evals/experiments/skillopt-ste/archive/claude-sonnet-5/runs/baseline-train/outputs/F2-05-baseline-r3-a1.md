# `.agro/logs/`

Every coding harness reads this file directly.

This directory holds durable operational records written by unattended
sessions. Git ignores every file here except this README. A log is evidence
for the next session and for the operator. A log is never repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt — delivered and not delivered alike |

Use this directory when a session must leave a record that outlives the
session. Three cases apply:

- an escalation the operator has not answered
- a decision the session made without consent, because the session could not
  obtain consent
- a finding that would otherwise exist only in a tmux scrollback

Do not use this directory for these three cases:

- a process log a service already owns, such as `/tmp/cron-*.log` or
  `/tmp/client-slack-*.log`
- a finding a probe or `RESULTS.md` already asserts
- a substitute for `evidence.md` in a task folder

Each record is one line of JSON. One line per record keeps the file
append-only. One line per record keeps the file greppable without a parser.

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

Write a record here only when the record must survive the session. If a
session can still act on a finding, the session acts on the finding. If a
session cannot act on a finding, the session leaves the record here. The
session then reports the finding through a channel a human monitors.

Rotation is manual. These files stay small. A human reads these files after
an incident occurs. Truncate a file when the file stops being useful. Never
rewrite a record in place.
