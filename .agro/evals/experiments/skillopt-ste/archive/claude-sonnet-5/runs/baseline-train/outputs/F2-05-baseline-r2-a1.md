# `.agro/logs/`

Every coding harness reads this file directly.

`.agro/logs/` holds durable operational records that unattended sessions
write. Git ignores everything in this directory except this file. A log
record is evidence for the next session and for the operator. A log record
is not repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt — delivered and not delivered alike |

When a session must leave a record that outlives the session, use this
directory. Examples: an escalation the operator has not answered, a
decision the session made without operator consent because the session
could not obtain consent, a finding that otherwise exists only in a tmux
scrollback.

Do not use this directory for a process log that a service already owns,
for example `/tmp/cron-*.log` or `/tmp/client-slack-*.log`. Do not use this
directory for a fact that a probe or `RESULTS.md` already asserts. Do not
use this directory as a substitute for `evidence.md` in a task folder.

Each record is one line of JSON. This format keeps the file append-only and
greppable without a parser.

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

When a record must survive the session, write the record here.
If a session can still act on a finding, the session acts on the finding.
If a session cannot act on a finding, the session leaves a record in
`.agro/logs/` and escalates the finding so a human sees it.

Rotation is manual. When a log file's records stop being useful, the
operator truncates the file. The operator never rewrites a record in
place.
