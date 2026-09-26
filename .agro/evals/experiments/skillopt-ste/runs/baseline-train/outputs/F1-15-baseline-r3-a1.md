# RFC: Normalized trace / event ledger

Status: Draft foundational spec for [#525](https://github.com/mifunedev/agro/issues/525).

This RFC describes the normalized append-only event ledger. Later
self-improvement work can build on this ledger. This RFC is a spec only. This
RFC adds no runtime emission, no provider wiring, and no replay code. This RFC
makes no changes to Ralph, autopilot, `/eval`, or `/audit`.

This RFC is the first proposed child issue in the
[self-improving harness roadmap curation](rfc-selfimprove-roadmap.md). The terms
`trace`, `session`, `run`, `step`, and `artifact` follow the working definitions
in the [glossary](../glossary.md).

## Goals

- Normalize traces from different agents and harness surfaces into one event
  shape.
- Keep the structure that replay, diagnosis, and scoring need.
- By default, store no secrets and no raw transcripts larger than
  <size threshold>.
- Reserve a storage layout that fits the `.agro/` control-plane model. The
  [`.agro/` directory layout](../agro-directory-layout.md) documents that model.
- Keep the ledger append-only. Later analysis can then trust historical events.

## Non-goals

- This RFC adds no provider adapters, no hooks, and no runner changes.
- This document creates no new `.agro/traces/` or `.agro/sessions/` directory.
- This RFC does not promise byte-for-byte deterministic replay of model output.
- This RFC adds no central service and no external database. The first storage
  target is files in the repo checkout.

## Event model

A ledger is newline-delimited JSON. Each line holds one immutable event.

1. Writers append new events.
2. Writers never rewrite old events.
3. If an event needs correction, the writer appends a new event. The new event
   carries `corrects_event_id` and the corrected payload.

Common envelope fields:

| Field | Required | Meaning |
|---|---:|---|
| `schema_version` | yes | Schema identifier. The first value is `trace-ledger.v0`. |
| `event_id` | yes | Stable ID. The ID is unique within the ledger. |
| `run_id` | yes | One end-to-end run, such as one Ralph iteration or one cron fire. |
| `session_id` | recommended | Agent/session container, such as a tmux session. Set the field when the writer knows the value. |
| `step_id` | recommended | Current workflow step or task story. |
| `parent_event_id` | optional | Causal parent for nested calls. |
| `corrects_event_id` | optional | Prior event that this append-only correction supersedes. |
| `ts` | yes | UTC ISO-8601 timestamp. |
| `type` | yes | Event type from the core vocabulary below. |
| `actor` | yes | Agent, runner, human, or system surface that emitted the event. |
| `source` | recommended | File, command, provider, skill, or runner that produced the event. |
| `payload` | yes | Type-specific JSON object. |

Core event types:

| Type | Payload should capture |
|---|---|
| `Run` | Run start/end, task slug, branch, issue, terminal outcome. |
| `Step` | Workflow step/story start/end, status, dependencies, acceptance surface. |
| `model_call` | Provider/model, redacted input/output refs or hashes, token counts, error state. |
| `tool_call` | Tool name, redacted args summary, result status, referenced artifacts. |
| `file_change` | Path, change kind, diff stat, content hash. Raw diffs appear only as safe artifacts. |
| `command` | Redacted argv, cwd, exit code, duration, output artifact refs or summaries. |
| `git_action` | Branch, remote, ref, commit, merge/fetch/checkout/commit/push metadata. |
| `validation` | Check command/probe, expected result, observed result, PASS/REGRESSION/SKIPPED. |
| `approval` | Human or gate decision, approver surface, reason, scope of authority granted. |
| `handoff_status` | Emitted status token or completion marker, next target, parse result. |
| `artifact_effect` | Artifact created/updated/deleted/read, location, content hash, consumer. |
| `cost_time` | Wall time, model tokens/cost when available, retry count, unattended flag. |

The #525 epic names a `browser_action` type. At first, a writer records a
`browser_action` as a `tool_call` with browser-specific payload fields. If
browser traces need separate scoring semantics, a later RFC can split
`browser_action` into a first-class type.

## Storage layout

Traces are harness runtime evidence, not application source. The ledger
therefore belongs in the `.agro/` machinery namespace. The current
[`.agro/` directory layout](../agro-directory-layout.md) lists `traces/` and
`sessions/` as **proposed, not present**. That listing is correct. When the
runtime implementation lands, this RFC reserves these paths:

```text
.agro/traces/<run_id>/events.jsonl
.agro/traces/<run_id>/artifacts/<artifact_id>
.agro/traces/<run_id>/manifest.json
.agro/sessions/<session_id>.json
```

- `.agro/traces/<run_id>/events.jsonl` is the append-only ledger.
- `.agro/traces/<run_id>/artifacts/` stores optional sanitized artifacts. An
  artifact goes here when the artifact is larger than <size threshold> or too
  sensitive to inline in an event.
- `.agro/traces/<run_id>/manifest.json` records the schema version, the
  task/branch/issue pointers, the retention policy, and the artifact hash
  inventory.
- `.agro/sessions/<session_id>.json` is an index from a longer-lived session to
  the runs of that session. The session index should not duplicate event
  payloads.

Until a runtime implementation lands, the repo contains none of these
directories. That absence is the expected repo state.

## Secret and privacy handling

The ledger must be safe to inspect. If the ledger contains private run
evidence, the ledger must stay out of public PRs.

- Do not record raw environment dumps, credentials, tokens, cookies, private
  `.env` contents, Slack secrets, or browser profile data.
- Do not record host paths that reveal private user material.
- By default, store hashes, artifact references, redacted summaries, and diff
  stats.
- Store raw prompts, command output, or file diffs only when the writer
  explicitly classifies them as safe artifacts.
- Redact command argv and tool arguments before the writer writes the event.
  Prefer `argv_redacted` plus `redactions: ["token", "env"]` over lossy prose.
- For `file_change`, record the path, the change kind, the stat, and the content
  hash. Do not inline full file contents.
- For `model_call`, record the provider/model, the token counts, the status, and
  the content hashes or artifact refs. Raw model prompts/responses are optional
  sanitized artifacts, not required envelope fields.
- If a writer detects a possible secret after the append, the writer must take
  these actions in order:
  1. Append a correction event.
  2. Quarantine or purge the unsafe artifact, as the retention policy in
     `manifest.json` directs.

  The writer must not silently edit the historical line.

## Minimal events for replay, diagnosis, and scoring

A run does not need every possible event. A run needs the events that explain
what happened. The three lists below give the minimum for each purpose.

### Replay-required minimum

- `Run` start and end.
- `Step` start/end for each workflow step or user story.
- `model_call` events that identify the model/provider, the prompt artifact refs
  or hashes, and the response status.
- Every harness side effect, as `tool_call`, `command`, `git_action`,
  `file_change`, or `artifact_effect`.
- `handoff_status` for terminal status markers and next-step routing.

### Diagnosis-required minimum

- Error payloads on failed `model_call`, `tool_call`, and `command` events.
- `validation` events for checks that passed, failed, regressed, or skipped.
- `artifact_effect` events for required artifacts. Include every create, delete,
  and read transition.
- An `approval` event each time a human or gate expands authority or permits a
  risky action.

### Scoring-required minimum

- Final `Run` outcome.
- `validation` outcomes for the regression floor and for
  <capability check set>.
- `cost_time` events or fields for elapsed time, retries, and unattended
  completion. Include token/cost totals when the provider reports them.
- `handoff_status` parse results. A malformed completion marker then counts as a
  harness failure, not as ambiguous success.

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

- Add `.agro/traces/` and `.agro/sessions/` to the directory-layout doc. Make
  that change only in the implementation PR that creates the directories.
- Decide the retention rules and the gitignore rules before any writer writes
  private traces to disk.
- Keep provider-specific raw logs as optional artifacts. Normalize only the
  cross-provider facts that later weakness mining and scoring need.
- When runtime emission lands, add eval probes for these behaviors:
  - append-only behavior;
  - redaction invariants;
  - malformed handoff-status detection.
