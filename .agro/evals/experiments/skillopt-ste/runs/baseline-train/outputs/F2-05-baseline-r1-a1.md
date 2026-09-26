# `.agro/logs/`

Every coding harness reads this file directly.

This directory holds durable operational records from unattended sessions. Git
ignores every file in this directory except this file. A log is evidence for the
next session and for the operator. A log is never repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt — delivered and not delivered alike |

Write a record to this directory when the record must outlive the session that
writes the record. These cases qualify:

- an escalation that the operator has not answered;
- a decision that the session made without consent, because the session could
  not get consent;
- a finding that otherwise exists only in a tmux scrollback.

Do not write these records to this directory:

- process logs that a service already owns, such as `/tmp/cron-*.log` and
  `/tmp/client-slack-*.log`;
- a fact that a probe or `RESULTS.md` already asserts;
- a replacement for `evidence.md` in a task folder.

Each record is one line of JSON. This format keeps the file append-only. This
format also lets a reader search the file with `grep` and no JSON parser:

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

If a session can still act on a finding, the session acts on the finding and
writes no record. If a session cannot act on a finding, the session writes the
record. The session then reports the record at <operator-visible location>.

Rotation is manual. Each file stays small. The operator reads a file after a
failure. When <truncation condition>, the operator truncates the file. Never
rewrite a record in place.
