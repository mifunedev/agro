# Manual review evidence: escalate timeouts

This file records observed sandbox commands for US-004.
Use it to write the PR `## Manual review` section in server, CLI, or API shape.
Do not contact Slack during this review.

## Prerequisites and location

Prerequisites: a checkout of AGRO on branch `feat/1192-escalate-timeouts`, Bash, jq, Python 3, and executable escalate scripts.
Location: AGRO sandbox checkout at repository root.
Live Slack: not used.
Remote resources: not created.

## A. Local stub deadline suite

Run the local stub suite.

```bash
bash .agro/skills/escalate/scripts/test-escalate-timeouts.sh > /tmp/us004-stub.stdout 2> /tmp/us004-stub.stderr; status=$?; printf 'status=%s\n' "$status"; printf -- '--- stdout ---\n'; python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/us004-stub.stdout')
print(p.read_text(), end='')
PY
printf -- '--- stderr ---\n'; python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/us004-stub.stderr')
print(p.read_text(), end='')
PY
```

Observed output:

```text
status=0
--- stdout ---
--- stderr ---
PASS: escalate timeout deadlines
```

Exit status: 0.

The stub suite owns its temporary directory and removes it through its trap.
It sent no live Slack message.

## B. Invalid threshold failure path

Run the timeout command with an invalid reminder threshold.

```bash
ESCALATE_REMIND_AFTER=abc ESCALATE_NOW=1086400 ESCALATE_DECISION_SCRIPT=/bin/true ESCALATE_SENDER_SCRIPT=/bin/true bash .agro/skills/escalate/scripts/escalate-timeouts.sh <<'JSON' > /tmp/us004-invalid.stdout 2> /tmp/us004-invalid.stderr
[{"channel":"C1","ts":"1000000.000100","link":"https://example.invalid/escalation"}]
JSON
status=$?; printf 'status=%s\n' "$status"; printf -- '--- stdout ---\n'; python3 - <<'PY'
from pathlib import Path
print(Path('/tmp/us004-invalid.stdout').read_text(), end='')
PY
printf -- '--- stderr ---\n'; python3 - <<'PY'
from pathlib import Path
print(Path('/tmp/us004-invalid.stderr').read_text(), end='')
PY
```

Observed output:

```text
status=64
--- stdout ---
--- stderr ---
escalate-timeouts: ESCALATE_REMIND_AFTER must be a positive integer number of seconds
```

Exit status: 64.

The reviewer supplies no state directory.
The invalid-threshold command exits before any post or marker creation.

## C. Dry-run CLI success path

Run a deterministic dry-run with JSON stdin.
This scenario uses `ESCALATE_NOW=1086400` and `ts=1000000.000100`.
The computed age is exactly 86400 seconds.
Caution: dry run reports `decision` as `unchecked`.
Do not use this output as proof that Slack has no decision.

```bash
ESCALATE_NOW=1086400 bash .agro/skills/escalate/scripts/escalate-timeouts.sh --dry-run <<'JSON' > /tmp/us004-dryrun.stdout 2> /tmp/us004-dryrun.stderr
[{"channel":"C1","ts":"1000000.000100","link":"https://example.invalid/escalation"}]
JSON
status=$?; printf 'status=%s\n' "$status"; printf -- '--- stdout ---\n'; python3 - <<'PY'
from pathlib import Path
print(Path('/tmp/us004-dryrun.stdout').read_text(), end='')
PY
printf -- '--- stderr ---\n'; python3 - <<'PY'
from pathlib import Path
print(Path('/tmp/us004-dryrun.stderr').read_text(), end='')
PY
```

Observed output:

```text
status=0
--- stdout ---
{"ok":true,"results":[{"channel":"C1","ts":"1000000.000100","link":"https://example.invalid/escalation","state":"reminder_requested","action":"remind","decision":"unchecked","reason":"dry run: reminder threshold reached","ageSeconds":86400,"remindAfter":86400,"expireAfter":259200,"blockedActionExecuted":false,"notice":{"attempted":false,"ok":false,"dryRun":true,"exitCode":0,"reason":"dry run: no Slack notice sent","marker":"/home/sandbox/.agro/escalate/timeout_reminder_646bc050f98a0b87096882978e94b293719a0e32069ef41c625bfbc30376028e"}}]}
--- stderr ---
```

Exit status: 0.

The output shows `notice.attempted=false` and `notice.dryRun=true`.
The dry-run command sends no live Slack message.
The dry-run command writes no marker.

## Cleanup

Remove only the transcript capture files from `/tmp`.

```bash
rm -f /tmp/us004-stub.stdout /tmp/us004-stub.stderr /tmp/us004-invalid.stdout /tmp/us004-invalid.stderr /tmp/us004-dryrun.stdout /tmp/us004-dryrun.stderr
```

Observed cleanup: the command exited 0 and removed the transcript capture files.
No Slack resource or remote resource exists for cleanup.
