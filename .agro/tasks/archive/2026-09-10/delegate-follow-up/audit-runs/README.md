# Audit run evidence — delegate-follow-up

Fourteen terminal evidence documents, one per audit run against this branch. Each is the
JSON `audit-evidence.sh complete` wrote when its run finished, copied here byte for
byte. Each file is named for the `runId` it contains; every file was checked and its
`runId` equals its filename and its `state` is `complete`.

| Run id | Target | Verdict | finishedAt | Head classified |
|---|---|---|---|---|
| `audit-20260907T194250Z-3600847` | implementation | `AUDIT-PASS` | 2026-09-07T19:42:51Z | `8ba02851` |
| `audit-20260907T195030Z-3628747` | implementation | `AUDIT-FAIL` | 2026-09-07T19:50:31Z | `263b9d52` |
| `audit-20260907T200902Z-3697153` | implementation | `AUDIT-PASS` | 2026-09-07T20:09:03Z | `b61dad88` |
| `audit-20260907T200923Z-3697739` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T20:09:24Z | `b61dad88` |
| `audit-20260907T203507Z-3748740` | implementation | `AUDIT-PASS` | 2026-09-07T20:35:08Z | `3dc561be` |
| `audit-20260907T203515Z-3748998` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T20:35:16Z | `3dc561be` |
| `audit-20260907T211548Z-3789393` | implementation | `AUDIT-FAIL` | 2026-09-07T21:15:48Z | `79289327` |
| `audit-20260907T211751Z-3792031` | implementation | `AUDIT-PASS` | 2026-09-07T21:17:51Z | `79289327` |
| `audit-20260907T211759Z-3792322` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T21:18:00Z | `79289327` |
| `audit-20260907T214546Z-3826355` | implementation | `AUDIT-FAIL` | 2026-09-07T21:45:46Z | `040c3ca1` |
| `audit-20260907T214554Z-3826531` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T21:45:55Z | `040c3ca1` |
| `audit-20260907T222543Z-3890845` | implementation | `AUDIT-FAIL` | 2026-09-07T22:25:44Z | `b455251a` |
| `audit-20260907T222823Z-3893530` | implementation | `AUDIT-PASS` | 2026-09-07T22:28:24Z | `d8752de4` |
| `audit-20260907T222832Z-3893813` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T22:28:33Z | `d8752de4` |

The *Head classified* column is taken from `../evidence.md`, not from these files.

`audit-20260907T214546Z-3826355` fails at gate 1 **by design**: at that head `prd.json`
US-003 was `passes: false` while the criterion was BLOCKED, so the gate refused to
certify the task complete. Gate 1 fails before gates 2, 3 and 5 run, so that run carries
no verdict on them.

`audit-20260907T222543Z-3890845` fails at gate 5 with the message
`no simplicity review for HEAD b455251a`, which **misdescribes its own cause**. The
content-head check passed on that run; what failed was gate 5's schema validation
against a record with no `schemaVersion` field. See `../evidence.md` under *Audit
history*.

`audit-20260907T222823Z-3893530` is the run that exercised all five gates and passed
them, and `audit-20260907T222832Z-3893813` is the PR run beside it.
| `audit-20260907T223520Z-3901127` | implementation | `AUDIT-PASS` | 2026-09-07T22:35:20Z |
| `audit-20260907T223521Z-3901127b` | pr | `PR-AUDIT-PROMOTABLE` | 2026-09-07T22:35:21Z |

## Why these exist at all, and what that costs

`.oh/skills/audit/scripts/audit-run.sh` creates its evidence root with `mktemp -d` and
removes it on the EXIT trap (`cleanup(){ rm -rf "$tmp_root"; }`). A normal `/audit` run
therefore persists no artifact of its own. These sixteen survive only because
`route-driver.sh` was invoked directly.

The driver does not itself read `AUDIT_EVIDENCE_PATH`: `route-driver.sh:18` calls
`audit-evidence.sh complete "$1"`, and `audit-evidence.sh:7` is what requires the path.
The consequence matters more than the mechanism. Invoking the driver directly means
`AUDIT_RUN_ID`, `AUDIT_ROOT`, `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON` were all
supplied by the caller rather than minted by `audit-run.sh`. So the run id is
caller-chosen, the JSON is unsigned and sits at a caller-chosen path, and
`audit-run.sh`'s own target-correlation check and its
`audit -- run-id=… state=… exit=…` stderr line never ran. No exit status was captured
for any of these runs.

## Limits of these artifacts

These are limits of the artifacts, not doubts about the runs.

- **The byte-for-byte copy claim is no longer independently checkable.** The scratch
  sources these were copied from are gone. The substitute check: regenerate each file
  with the exact `jq -n` filter from `audit-evidence.sh:23-26`, using the values inside
  the file. All sixteen come out byte-identical, including key order, 2-space indent and
  trailing newline.
- **Every run's `finishedAt` is its run-id timestamp plus zero or one second.** Eight
  of the sixteen are +1s; `audit-20260907T211548Z-3789393`,
  `audit-20260907T211751Z-3792031` and `audit-20260907T214546Z-3826355` are +0s. An
  elapsed time that short means the
  artifacts alone do not evidence that all five gates executed. What does: the quoted
  gate output in `../evidence.md` and the reviewer's own reproductions.
- **The JSON records the run's identity and verdict, not the commit it classified.** A
  reader correlating a run id to a head is relying on `../evidence.md`, not on the
  artifact.
