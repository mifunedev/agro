# `.agro/logs/`

Every coding harness reads this file directly.

Durable operational records written by unattended sessions. Everything here is
gitignored except this file: a log is evidence for the next session and for the
operator, never repository content.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `escalations.jsonl` | `.agro/skills/escalate/scripts/escalate.sh` | One JSON object per escalation attempt — delivered and not delivered alike |

Use this directory when a session must leave a record that outlives the session.
Examples:

- an escalation the operator has not answered;
- a decision the session made without consent, because no one could give consent;
- a finding that otherwise exists only in a tmux scrollback.

Do not use this directory for process logs a service already owns
(`/tmp/client-slack-*.log`), for a fact a test already asserts, or as a
substitute for task evidence. Task evidence lives in the `notes` of the task's
`prd.json` and in the PR body evidence sections.

Each record is one line of JSON so the file stays append-only and greppable
without a parser:

```bash
jq -c 'select(.ok == false)' .agro/logs/escalations.jsonl   # what never reached a human
```

Write here only when the record must survive the session. When a session can
still act on a finding, the session acts on the finding. When a session cannot
act, the session leaves the record and says so where a human looks.

Rotation is manual. These files stay small, and humans read these files after a failure.
When a file stops being useful, truncate the file. Never rewrite a record in place.
