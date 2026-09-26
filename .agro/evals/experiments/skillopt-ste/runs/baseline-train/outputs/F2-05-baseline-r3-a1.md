# `.agro/logs/`

Every coding harness reads this file directly.

This directory holds durable operational records. Unattended sessions write
these records. Git ignores every file in this directory except this file. A log
is evidence for the next session and for the operator. A log is never
repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt, for delivered and undelivered attempts |

A session writes a record to this directory when the record must outlive the
session. Three records qualify:

- an escalation that the operator has not answered;
- a decision that the session made without consent, because the session could
  not get consent;
- a finding that otherwise exists only in a tmux scrollback.

Do not write these records to this directory:

- process logs that a service already owns, such as `/tmp/cron-*.log` and
  `/tmp/client-slack-*.log`;
- a fact that a probe or `RESULTS.md` already asserts;
- a substitute for `evidence.md` in a task folder.

Each record is one line of JSON. The one-line format keeps the file
append-only. With the one-line format, `grep` can search the file without a
JSON parser. To list each escalation that never reached a human, run the
following `jq` command:

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

If a session can still act on a finding, the session acts on the finding. That
session writes no record. If a session cannot act on a finding, the session
writes the record here. The session then reports the record at <location where
a human reads>.

The operator rotates these files by hand. These files stay small. The operator
reads these files after a failure. If <condition that makes a log no longer
useful>, the operator truncates the file. Never rewrite a record in place.
