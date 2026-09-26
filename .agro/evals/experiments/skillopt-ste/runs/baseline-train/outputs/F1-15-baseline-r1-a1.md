# RFC: Normalized trace / event ledger

Status: Draft foundational spec for [#525](https://github.com/mifunedev/agro/issues/525).

This RFC describes the normalized append-only event ledger. Later
self-improvement work builds on this ledger. This RFC is a spec only. The RFC
adds no runtime emission, no provider wiring, and no replay code. The RFC makes
no change to Ralph, autopilot, `/eval`, or `/audit`.

This RFC is the first proposed child issue in the
[self-improving harness roadmap curation](rfc-selfimprove-roadmap.md). The terms
`trace`, `session`, `run`, `step`, and `artifact` follow the working definitions
in the [glossary](../glossary.md).

## Goals

- Normalize traces from different agents and harness surfaces into one event
  shape.
- Keep enough structure for replay, diagnosis, and scoring. By default, store no
  secrets and no large raw transcripts.
- Reserve a storage layout that fits the `.agro/` control-plane model. The
  [`.agro/` directory layout](../agro-directory-layout.md) documents that model.
- Keep the ledger append-only. Later analysis can then trust historical events.

## Non-goals

- This RFC adds no provider adapters, no hooks, and no runner changes.
- This document creates no `.agro/traces/` directory and no `.agro/sessions/`
  directory.
- This RFC does not promise byte-for-byte deterministic replay of model output.
- This RFC adds no central service and no external database. The first storage
  target is files in the repo checkout.

## Event model

A ledger is newline-delimited JSON. Each line holds one immutable event. Writers
append events. Writers never rewrite old events. To correct an event, a writer
appends a new event with `corrects_event_id` and the corrected payload.

Common envelope fields:

| Field | Required | Meaning |
|---|---:|---|
| `schema_version` | yes | Schema identifier. The first value is `trace-ledger.v0`. |
| `event_id` | yes | Stable ID, unique within the ledger. |
| `run_id` | yes | One end-to-end run, such as one Ralph iteration or one cron fire. |
| `session_id` | recommended | Agent or session container, when known, such as a tmux session. |
| `step_id` | recommended | Current workflow step or task story. |
| `parent_event_id` | optional | Causal parent event for nested calls. |
| `corrects_event_id` | optional | Prior event that this append-only correction supersedes. |
| `ts` | yes | UTC ISO-8601 timestamp. |
| `type` | yes | Event type from the core vocabulary below. |
| `actor` | yes | Agent, runner, human, or system surface that emitted the event. |
| `source` | recommended | File, command, provider, skill, or runner that produced the event. |
| `payload` | yes | Type-specific JSON object. |

Core event types:

| Type | Payload captures |
|---|---|
| `Run` | Run start and end, task slug, branch, issue, terminal outcome. |
| `Step` | Workflow step or story start and end, status, dependencies, acceptance surface. |
| `model_call` | Provider and model, redacted input and output refs or hashes, token counts, error state. |
| `tool_call` | Tool name, redacted args summary, result status, referenced artifacts. |
| `file_change` | Path, change kind, diff stat, content hash. Raw diffs appear only as safe artifacts. |
| `command` | Redacted argv, cwd, exit code, duration, output artifact refs or summaries. |
| `git_action` | Branch, remote, ref, commit, and merge/fetch/checkout/commit/push metadata. |
| `validation` | Check command or probe, expected result, observed result, PASS/REGRESSION/SKIPPED. |
| `approval` | Human or gate decision, approver surface, reason, scope of the granted authority. |
| `handoff_status` | Emitted status token or completion marker, next target, parse result. |
| `artifact_effect` | Artifact created/updated/deleted/read, location, content hash, consumer. |
| `cost_time` | Wall time, model tokens and cost when available, retry count, unattended flag. |

The #525 epic names a `browser_action` type. At first, a writer records a
browser action as a `tool_call` with browser-specific payload fields. If browser
traces need separate scoring semantics, a later RFC can split `browser_action`
into a first-class type.

## Storage layout

Traces are harness runtime evidence, not application source. For this reason,
the ledger belongs in the `.agro/` machinery namespace. The current
[`.agro/` directory layout](../agro-directory-layout.md) lists `traces/` and
`sessions/` as **proposed, not present**. This listing is correct. For the
runtime implementation, this RFC reserves these paths:

```text
.agro/traces/<run_id>/events.jsonl
.agro/traces/<run_id>/artifacts/<artifact_id>
.agro/traces/<run_id>/manifest.json
.agro/sessions/<session_id>.json
```

- `.agro/traces/<run_id>/events.jsonl` is the append-only ledger.
- `.agro/traces/<run_id>/artifacts/` stores optional sanitized artifacts. An
  artifact goes here when the artifact is too large or too sensitive to inline
  in an event.
- `.agro/traces/<run_id>/manifest.json` records the schema version, the task,
  branch, and issue pointers, the retention policy, and the artifact hash
  inventory.
- `.agro/sessions/<session_id>.json` maps a longer-lived session to the runs
  that the session produced. This index does not duplicate event payloads.

Until a runtime implementation lands, the repo contains none of these
directories. This absence is the expected repo state.

## Secret and privacy handling

The ledger must be safe to inspect. If the ledger contains private run evidence,
the ledger must also be safe to keep out of public PRs.

- Do not record raw environment dumps, credentials, tokens, cookies, private
  `.env` contents, Slack secrets, browser profile data, or host paths that reveal
  private user material.
- By default, store hashes, artifact references, redacted summaries, and diff
  stats.
- After <classifying actor> classifies an item as a safe artifact, store the
  raw prompt, command output, or file diff. Store no other raw item.
- Before a writer writes an event, the writer redacts command argv and tool
  arguments. Record `argv_redacted` plus `redactions: ["token", "env"]` in place
  of lossy prose.
- For `file_change`, record the path, change kind, stat, and content hash. Do not
  inline full file contents.
- For `model_call`, record the provider and model, token counts, status, and
  content hashes or artifact refs. Raw model prompts and responses are optional
  sanitized artifacts, not required envelope fields.
- If a writer detects a possible secret after an append, the writer must append
  a correction event. The writer must then quarantine or purge the unsafe
  artifact under the retention policy. The writer must not silently edit the
  historical line.

## Minimal events for replay, diagnosis, and scoring

A run does not need every possible event. A run needs enough event coverage to
explain what happened.

### Replay-required minimum

- `Run` start and end.
- `Step` start and end for each workflow step or user story.
- `model_call` events that identify the model and provider, the prompt artifact
  refs or hashes, and the response status.
- One event for each harness side effect: `tool_call`, `command`, `git_action`,
  `file_change`, or `artifact_effect`.
- `handoff_status` for terminal status markers and next-step routing.

### Diagnosis-required minimum

- Error payloads on failed `model_call`, `tool_call`, and `command` events.
- `validation` events for checks that passed, failed, regressed, or skipped.
- `artifact_effect` events for required artifacts. Include each create, delete,
  and read transition.
- `approval` events for each human or gate decision that expands authority or
  permits a risky action.

### Scoring-required minimum

- Final `Run` outcome.
- `validation` outcomes for the regression floor and for the capability checks
  that apply to the run.
- `cost_time` events or fields for elapsed time, token and cost totals when
  available, retries, and unattended completion.
- `handoff_status` parse results. The scorer counts a malformed completion
  marker as a harness failure, not as ambiguous success.

## Minimal JSONL example

Each line below is a complete JSON object.

```jsonl
{"schema_version":"trace-ledger.v0","event_id":"evt_0001","run_id":"run_20260703T190800Z_oh525","session_id":"sess_firstmate_oh_selfimprove_foundation","ts":"2026-07-03T19:08:00Z","type":"Run","actor":"firstmate","source":".agro/scripts/firstmate.sh","payload":{"task":"oh-selfimprove-foundation","branch":"feat/525-oh-selfimprove-foundation","status":"started"}}
{"schema_version":"trace-ledger.v0","event_id":"evt_0002","run_id":"run_20260703T190800Z_oh525","session_id":"sess_firstmate_oh_selfimprove_foundation","step_id":"US-002","parent_event_id":"evt_0001","ts":"2026-07-03T19:09:00Z","type":"Step","actor":"ralph","source":".agro/tasks/oh-selfimprove-foundation/prd.json","payload":{"title":"Normalized trace/event ledger RFC (foundational spec, descriptive)","status":"started"}}
{"schema_version":"trace-ledger.v0","event_id":"evt_0003","run_id":"run_20260703T190800Z_oh525","session_id":"sess_firstmate_oh_selfimprove_foundation","step_id":"US-002","parent_event_id":"evt_0002","ts":"2026-07-03T19:20:00Z","type":"file_change","actor":"ralph","source":"git diff","payload":{"path":".agro/docs/rfcs/rfc-trace-ledger.md","change":"created","diff_stat":"+170 -0","content_sha256":"sha256:example"}}
{"schema_version":"trace-ledger.v0","event_id":"evt_0004","run_id":"run_20260703T190800Z_oh525","session_id":"sess_firstmate_oh_selfimprove_foundation","step_id":"US-002","parent_event_id":"evt_0002","ts":"2026-07-03T19:25:00Z","type":"validation","actor":"ralph","source":"pnpm","payload":{"command":"pnpm run test","exit_code":0,"status":"PASS"}}
{"schema_version":"trace-ledger.v0","event_id":"evt_0005","run_id":"run_20260703T190800Z_oh525","session_id":"sess_firstmate_oh_selfimprove_foundation","step_id":"US-002","parent_event_id":"evt_0002","ts":"2026-07-03T19:26:00Z","type":"handoff_status","actor":"ralph","source":"progress.txt","payload":{"marker":"US-002 PASS","next":"US-003","parse_status":"ok"}}
```

## Implementation notes for future child issues

- Add `.agro/traces/` and `.agro/sessions/` to the directory-layout doc only in
  the implementation PR that creates these directories.
- Decide retention rules and gitignore rules before any writer writes private
  traces to disk.
- Keep provider-specific raw logs as optional artifacts. Normalize only the
  cross-provider facts that later weakness mining and scoring need.
- When runtime emission lands, add eval probes for append-only behavior,
  redaction invariants, and malformed handoff-status detection.
