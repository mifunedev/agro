---
title: "A delegated worker that dies after implementing but before verifying leaves complete files with no evidence"
slug: pattern-delegate-worker-terminated-before-report
kind: pattern
tags: [delegate, spec, workers, rate-limit, verification, evidence]
created: 2026-09-06
updated: 2026-09-06
sources:
  - .oh/tasks/agro-cli-entry/progress.txt@89e4a8ac
  - .oh/tasks/agro-cli-entry/delegate-log.txt@89e4a8ac
  - .oh/cli/src/commands/self-upgrade.ts@e5736830
confidence: provisional
---

# A delegated worker that dies after implementing but before verifying leaves complete files with no evidence

## Relevant Source Files
- `.oh/tasks/agro-cli-entry/delegate-log.txt@89e4a8ac` — the T3 row: worker terminated by a provider rate limit after its implementation step, mid-verification.
- `.oh/tasks/agro-cli-entry/progress.txt@89e4a8ac` — the owner's entry recording that it completed the worker's verification itself.
- `.oh/cli/src/commands/self-upgrade.ts@e5736830` — the worker's output as committed after owner verification.

## Summary
A bounded worker can be killed by something outside the task — here a monthly
spend limit — at the moment it has written every file but none of its evidence.
Its last message reads as progress ("all green, now the full suite"), not as a
report. The files are not wrong; they are unverified. The owner must treat the
worker's absent report as absent evidence and run the worker's whole
verification list itself before committing.

## Detail
**Symptom.** The task notification arrives with status `failed` and an API
rate-limit error. `git status` shows the worker's new and modified files in
place. The only worker text is an in-progress line, so nothing states which
commands ran or what they returned.

**Root cause.** Verification and reporting are the last steps of a worker's
brief, so any external termination lands there. The work product and the
evidence for it have different completion times, and only the first survives.

**Workaround.** The owner re-runs the brief's verification list against the
working tree — typecheck, build, the full suite, the built-artifact smoke
commands, the probes — records the results in `progress.txt` as owner-run, and
only then commits. Re-spawning the worker to finish its report costs more than
running the commands and adds a second narrator.

**Reproduce.** Give a worker a long verification list and terminate it after
its last file write; inspect the transcript for a results table.

## See Also
- [[pattern-spec-stubbed-runner-state-gap]] — a related gap between what a runner reports and what state exists.
