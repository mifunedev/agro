# Run files and the stage contract

This file is the contract between the dispatcher and each stage module. Each
stage codes against this file. The dispatcher is
`.agro/skills/behavioral-training/scripts/behavioral-training.mjs`. The run store
is `.agro/skills/behavioral-training/scripts/lib/run-store.mjs`.

## Commands

The dispatcher runs one stage for each command:

```bash
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs <stage> [options]
node .agro/skills/behavioral-training/scripts/behavioral-training.mjs <stage> --help
```

The dispatcher defines a fixed stage list. The stage order is `inventory`, `sample`, `normalize`,
`validate`, `report`, `publish`, `compare`. The dispatcher loads the module
`scripts/lib/<stage>.mjs` by name.

- If the module file does not exist, `<stage> --help` prints the stage purpose
  and the run options. The command exits 0.
- If the module file does not exist, each other command prints
  `stage not implemented` and exits 1.
- A new stage module needs no change to the dispatcher.

### Run options

| Option | Default | Rule |
|---|---|---|
| `--since <timestamp>` | `--until` minus 7 days | UTC ISO-8601 that ends in `Z` |
| `--until <timestamp>` | the run creation time | UTC ISO-8601 that ends in `Z` |
| `--environment <name>` | `null` | Langfuse environment filter |
| `--harness <name>` | `null` | Coding-harness filter |
| `--sample-size <n>` | `100` | Integer, 1 or more |
| `--seed <n>` | `42` | Integer from 0 to 4294967295 |
| `--run-dir <path>` | a new directory under `TMPDIR` | Outside each git worktree |
| `--resume` | off | Continues the run in `--run-dir` |
| `--max-sessions <n>` | `1000` | Integer, 1 or more |
| `--max-bytes <n>` | `262144` | Integer, 1 or more; the chunk size of one normalized session |
| `--max-judge-calls <n>` | `0` | Integer, 0 or more; 0 disables judge calls |

The parser accepts `--flag value` and `--flag=value`. The parser rejects an
unknown flag, a missing value, and a timestamp with an offset or without `Z`.
The parser also rejects `--since` at or after `--until`. Each rejection exits 2.

### Run identity and budgets

The first command on a run directory creates `manifest.json`. The manifest
records the window, the filters, the sample size, and the seed. These values
are the run identity.

- Each later command on the same run directory needs `--resume`.
- `--resume` needs `--run-dir`. If the run directory holds no manifest,
  `--resume` creates a new run.
- Without `--resume`, the dispatcher refuses a run directory that holds a
  manifest. The command exits 5.
- With `--resume`, the dispatcher reads the run identity from the manifest.
- If an option on a resumed command changes the run identity, the command
  exits 2.
- `--max-sessions`, `--max-bytes`, and `--max-judge-calls` are budgets. A
  resumed command can change a budget. The manifest records the new budget.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | The stage is `complete`, or `--resume` skipped a complete stage |
| 1 | The stage is `failed`, or the stage module does not exist |
| 2 | Usage error |
| 3 | The stage is `empty` |
| 4 | The stage is `partial` |
| 5 | Refused: lock held, run directory inside a git worktree, or run exists without `--resume` |

An empty corpus and a failed read never share one exit code.

## Run directory

- Without `--run-dir`, the dispatcher creates a unique directory
  `behavioral-training-<random>` under `os.tmpdir()`. `os.tmpdir()` reads
  `TMPDIR`.
- If `--run-dir` names a missing directory, the dispatcher creates the
  directory.
- If `--run-dir` names an existing directory, the directory must be empty or
  must hold `manifest.json` or `run.lock`.
- The dispatcher sets mode `0700` on the run directory.
- The run store writes each run file with mode `0600`.
- The dispatcher prints `run directory: <path>` on stdout.

The dispatcher refuses a run directory inside a git worktree. The check walks
from the run directory to the file-system root. If one ancestor holds a `.git`
file or a `.git` directory, the command exits 5. The check also applies to the
default `TMPDIR` location. The check does not run `git`, so an inherited
`GIT_DIR` cannot change the result.

### Lock

The dispatcher holds one lock for each run directory while one stage runs.

1. The dispatcher creates `run.lock` with an exclusive create and mode `0600`.
2. `run.lock` holds `pid`, `host`, `startedAt`, and `stage`.
3. If `run.lock` exists, the second process exits 5. The message names the
   holder PID, the holder host, and the start time.
4. The dispatcher deletes `run.lock` when the stage ends. The dispatcher also
   deletes `run.lock` on `SIGINT`, `SIGTERM`, `SIGHUP`, and process exit.

A crash can leave a stale `run.lock`. The dispatcher reclaims a lock only when
both conditions are true:

- the lock host is equal to the current host;
- the lock PID is not a live process.

If the lock host is a different host, the dispatcher never reclaims the lock.
If the lock holds no PID, the dispatcher never reclaims the lock. In both cases,
the operator confirms that no stage runs, then deletes `run.lock` by hand.

### Atomic writes

The run store writes `manifest.json` and each JSON file in four steps:

1. Create a temporary file `.<name>.<pid>.<random>.tmp` in the run directory.
2. Write the content.
3. Call `fsync` on the temporary file.
4. Rename the temporary file to the target name.

A reader sees the old content or the new content, never part of a file.
`appendJsonl` appends to the end of a file and is not atomic. A stage that
appends records must accept a repeated batch on resume. As an alternative, the
stage writes the full file with `writeJsonl`.

### Resume

The manifest holds one checkpoint for each stage.

- With `--resume`, the dispatcher skips a stage when the checkpoint status is
  `complete` and each recorded input and output checksum still matches.
- The dispatcher runs the stage again when the status is `running`,
  `partial`, `empty`, or `failed`.
- The dispatcher also runs the stage again when a recorded file changed or
  does not exist.
- The dispatcher always runs a stage again when the stage module exports
  `resumeAlways = true`. The checkpoint status and the checksums then do not
  matter.
- A new attempt receives the previous checkpoint in `ctx.previous`.

## Stage module contract

A stage module is `scripts/lib/<stage>.mjs`. The module exports one required
function and three optional values:

```js
export const options = {
  apply: { type: "boolean", description: "Write to Langfuse." },
  "dataset-prefix": { type: "string", default: "agro/behavior", description: "Dataset namespace." },
};

export const help = "Extra help text for this stage.";

export const resumeAlways = true;

export async function run(ctx) {
  return { status: "complete", counters: { sessions: 12 } };
}
```

### `options`

`options` declares the stage flags. The dispatcher parses each stage flag
together with the run options.

- Each key is the flag name without `--`.
- `type` is `boolean`, `string`, `integer`, or `timestamp`.
- `default`, `min`, `max`, and `description` are optional.
- The value arrives in `ctx.options` under the camel-case key. For example,
  `--dataset-prefix` arrives as `ctx.options.datasetPrefix`.
- A stage flag must not use the name of a run option.

`<stage> --help` lists each stage flag and prints `help` at the end.

### `resumeAlways`

`resumeAlways` is optional. The default is `false`.

- If the value is `false`, `--resume` skips the stage after a `complete`
  checkpoint with matching checksums.
- If the value is `true`, `--resume` runs the stage again each time.
- Set `true` only when a repeated run changes no data. `publish` sets `true`,
  because `publication-ledger.json` makes each rerun skip each completed write.

### `run(ctx)` result

`run(ctx)` returns `{ status, counters, cause }`.

| Field | Type | Rule |
|---|---|---|
| `status` | string | `complete`, `partial`, `empty`, or `failed` |
| `counters` | object | Optional. Integer counts for the checkpoint and the summary line |
| `cause` | string | Optional. A short cause code, for example `forbidden` or `budget-exhausted` |

- A `cause` is a code, never a message from a remote service.
- A `cause` never holds a credential, a path to a credential, or transcript text.
- If `run` throws, the dispatcher records `failed`. The dispatcher uses
  `error.cause` when `error.cause` is a string. Otherwise, the dispatcher
  records `unhandled-error`.
- If `run` returns a status outside the four values, the dispatcher records
  `failed` with the cause `invalid-stage-result`.

### `ctx`

| Field | Content |
|---|---|
| `ctx.stage` | The stage name |
| `ctx.runDir` | The absolute run directory |
| `ctx.repoRoot` | The repository root |
| `ctx.env` | The process environment; tests inject a fake |
| `ctx.options` | The run options from the manifest, the budgets, and the stage flags |
| `ctx.manifest` | A copy of the current manifest |
| `ctx.updateManifest(change)` | Applies `change(draft)` and writes the manifest atomically |
| `ctx.previous` | The checkpoint of the previous attempt, or `null` |
| `ctx.saveProgress(progress, counters)` | Writes `progress` to the running checkpoint atomically |
| `ctx.store` | The run-file helpers |
| `ctx.now()` | The current time as a `Date`; tests inject a fixed clock |
| `ctx.seed` | The run seed |
| `ctx.random()` | A seeded generator that returns a number in `[0, 1)` |
| `ctx.langfuse()` | A promise of the Langfuse client |
| `ctx.stdout(line)` | Writes one line to stdout |
| `ctx.stderr(line)` | Writes one line to stderr |

`ctx.updateManifest` keeps `schemaVersion`, `runId`, and `stages` unchanged.
`ctx.updateManifest` refuses a manifest that holds a Langfuse key prefix
`sk-lf-` or `pk-lf-`.

`ctx.random` uses the mulberry32 algorithm. If a stage needs an independent
sequence, the stage calls `createRandom(seed)` from `run-store.mjs`.

### `ctx.store`

Each name is a plain file name inside the run directory. The store rejects a
name with `/` or `..`. The store also rejects the names `manifest.json` and
`run.lock`.

| Helper | Effect |
|---|---|
| `path(name)` | Returns the absolute path |
| `exists(name)` | Returns `true` when the file exists |
| `readJson(name)` | Parses one JSON file |
| `readJsonl(name)` | Parses one JSONL file; a malformed line is an error that names the line number |
| `readText(name)` | Reads one text file |
| `writeJson(name, value)` | Writes one JSON file atomically |
| `writeJsonl(name, records)` | Writes one JSONL file atomically |
| `writeText(name, text)` | Writes one text file atomically |
| `appendJsonl(name, records)` | Appends records to one JSONL file |

A read of a missing file is an error with the code `missing-run-file`. A stage
never reads a missing input as an empty input.

The store records each file that a stage reads and each file that a stage
writes. The dispatcher stores a SHA-256 checksum of each file in the
checkpoint.

### `ctx.langfuse()`

`ctx.langfuse()` creates the Langfuse client on the first call. Each later call
returns the same client. If a stage never calls `ctx.langfuse()`, the
dispatcher never loads the adapter.

The default factory imports `scripts/lib/langfuse.mjs` and calls
`createClient(ctx)`. US-003 implements `createClient`. Tests pass
`langfuseFactory` to `main(argv, deps)` and inject a fake client.

### Test entry point

`main(argv, deps)` returns the exit code and never calls `process.exit`. Each
`deps` field is optional:

| Field | Purpose |
|---|---|
| `loadStage(name)` | Returns a stage module or `null` |
| `langfuseFactory(ctx)` | Returns the Langfuse client |
| `tmpdir()` | Returns the parent of the default run directory |
| `now()` | Returns the current `Date` |
| `env` | Replaces `process.env` |
| `repoRoot` | Replaces the repository root |
| `stdout(text)` | Receives each stdout line |
| `stderr(text)` | Receives each stderr line |

## Run files

Privacy classes:

- **metadata**: ids, names, counts, timestamps, versions, checksums, and
  numbers. No message text, no tool input, no tool output, and no text that a
  person or a model wrote about a session.
- **transcript**: message text, tool input, tool output, or text that an
  annotator wrote about a session.

Never copy a transcript-class file into a git worktree. A report that leaves
the run directory holds only metadata-class content.

| File | Writer | Story | Privacy |
|---|---|---|---|
| `manifest.json` | dispatcher and each stage | US-002 | metadata |
| `inventory-pages.jsonl` | `inventory` | US-003 | metadata |
| `inventory.jsonl` | `inventory` | US-003 | metadata |
| `sample.json` | `sample` | US-004 | metadata |
| `normalized-sessions.jsonl` | `normalize` | US-005 | transcript |
| `annotations.jsonl` | the agent; `validate` checks | US-006 | transcript |
| `taxonomy.json` | the agent; the operator approves; `validate` checks | US-006 | transcript |
| `rubric.json` | the agent from the starting rubric; `validate` checks | US-006 | metadata |
| `calibration.json` | `validate` | US-006 | metadata |
| `facts.jsonl` | `validate` | US-014 | metadata |
| `dataset-items.jsonl` | the agent writes candidates; `publish` curates | US-007 | transcript |
| `publication-ledger.json` | `publish` | US-008 | metadata |
| `report.json` | `report` | US-009 | metadata |
| `report.md` | `report` | US-009 | metadata |
| `compare-thresholds.json` | the advisor; `compare` reads | US-009 and US-012 | metadata |
| `baseline-results.jsonl` | the advisor, from fresh replay runs; `compare` reads | US-009 | metadata |
| `candidate-results.jsonl` | the advisor, from fresh replay runs; `compare` reads | US-009 | metadata |
| `comparison.json` | `compare` | US-009 | metadata |

Each field that the source does not supply holds `null`. A stage never invents
a value. Each timestamp is a UTC ISO-8601 string that ends in `Z`.

### `manifest.json`

| Field | Content |
|---|---|
| `schemaVersion` | `1` |
| `runId` | A random UUID |
| `createdAt`, `updatedAt` | Timestamps |
| `endpoint` | `{ baseUrl, configRoot, capabilities }` from preflight, or `null` before preflight |
| `project` | `{ id, name }` from preflight, or `null` |
| `window` | `{ since, until }` |
| `filters` | `{ environment, harness }` |
| `sampling` | `{ policy, sampleSize, seed }`; `policy` is `stratified-50-25-25` |
| `budgets` | `{ maxSessions, maxBytes, maxJudgeCalls }` |
| `sources` | A list of `{ id, kind, checksum }` for each source export or fixture |
| `versions` | `{ node, cli, skill, api, harnesses, models }`; the dispatcher sets `node` and `skill`, preflight sets `cli` and `api`, and `inventory` sets `harnesses` and `models` |
| `completeness` | Counters that each stage adds; see `inventory.jsonl` |
| `datasets` | `{ prefix, version }` |
| `rubric` | `{ version }` |
| `stages` | One checkpoint for each stage that ran |

The dispatcher sets `versions.skill` when the dispatcher creates the run. The
value is `skills.langfuse.commit` from `.agro/skills.lock` in the repository
root. If the lock does not exist, does not parse, or has no `langfuse` entry,
the value is `null`.

The manifest never holds a credential. The run store refuses a manifest that
holds `sk-lf-` or `pk-lf-`.

### Checkpoint

| Field | Content |
|---|---|
| `status` | `running`, `complete`, `partial`, `empty`, or `failed` |
| `startedAt` | The start of the last attempt |
| `finishedAt` | The end of the last attempt, or `null` while the stage runs |
| `attempts` | The count of attempts |
| `counters` | Counters from `saveProgress` and from the stage result |
| `cause` | The cause code, or `null` |
| `progress` | The value of the last `saveProgress` call, for example a page cursor |
| `inputs` | `{ <file>: "sha256:<hex>" }` for each file that the stage read |
| `outputs` | `{ <file>: "sha256:<hex>" }` for each file that the stage wrote |

### `inventory.jsonl`

One record for each session. The file holds metadata only.

| Field | Content |
|---|---|
| `sessionId` | The Langfuse session id |
| `projectId` | The Langfuse project id |
| `traceIds` | The trace ids of the session, in time order |
| `firstSeenAt`, `lastSeenAt` | The first and the last observation timestamps |
| `environment` | The Langfuse environment |
| `harness` | The coding harness |
| `models` | The model names from the observations |
| `traceCount`, `observationCount` | Counts |
| `toolErrorCount` | The count of `TOOL` observations with the level `ERROR`; `null` when the session has no `TOOL` observation |
| `latencyMs` | `lastSeenAt` minus `firstSeenAt` in milliseconds |
| `costUsd` | The total cost |
| `tokens` | `{ input, output, total }`, or `null` |
| `scores` | A list of `{ name, value, source }` from existing Langfuse scores; `null` when the API contract has no `scores list` |
| `sourceLink` | `<baseUrl>/project/<projectId>/sessions/<sessionId>` |
| `unavailable` | The field names that the source did not supply |

`inventory` also writes `inventory-pages.jsonl`. Each row is one compact
observation or score from one page. A row holds ids, types, timestamps, the
environment, the level, the model name, the harness tag, token counts, the
cost, and the score subject. A row holds no input, no output, no status
message, and no metadata value. `--resume` reads this file and continues from
the saved cursor.

`inventory` adds `completeness.inventory` to the manifest:

| Field | Content |
|---|---|
| `status` | The stage status |
| `truncated` | `true` when `--max-sessions` stopped the read |
| `pages` | The count of pages read |
| `sessions`, `observations` | Counts |
| `sessionlessObservations`, `sessionlessTraces` | Observations and traces without a `sessionId`; the stage creates no session for these |
| `sessionsOverBudget` | Sessions after the `--max-sessions` budget |
| `excludedByHarness` | Sessions that `--harness` removed |
| `byHarness`, `byModel`, `byEnvironment`, `bySessionLength`, `byToolErrors`, `byLatency`, `byCost`, `byOutcomeSignal` | Session counts for each bucket |
| `unavailableFields` | Each field that no session supplied |

On a failed read, `completeness.inventory` holds only `{ status, cause, message }`.

### `sample.json`

| Field | Content |
|---|---|
| `policy` | `stratified-50-25-25` |
| `rateLabel` | `discovery-sample` |
| `seed`, `sampleSize` | From the manifest |
| `inventoryChecksum` | The checksum of `inventory.jsonl` |
| `inventoryCount` | The count of inventory records |
| `eligibleCount` | The count of eligible sessions |
| `excluded` | `{ missing-session-id, no-traces, duplicate-session-id, duplicate-content }` counts |
| `rounding` | `flagged` and `heavy` each target `floor(sampleSize / 4)`; `baseline` targets the remainder |
| `order` | `["baseline", "flagged", "heavy"]`, the order in which the strata take sessions |
| `thresholds` | See the next table |
| `unavailableSignals` | Each signal that no eligible session can supply |
| `strata` | `{ baseline, flagged, heavy }`; each holds `{ target, eligible, selected }` |
| `reallocation` | A list of `{ from, to, slots }` for each moved slot |
| `sessions` | A list of `{ sessionId, stratum, memberships, reason }` |

`thresholds` holds these fields:

| Field | Content |
|---|---|
| `observationCount`, `costUsd`, `latencyMs` | `{ quantile: 0.75, threshold, minimum }`, or `null` when no eligible session supplies the field |
| `scores` | `{ <score name>: { quantile: 0.25, threshold, maximum } }` |

`flagged` holds flagged, low-score, and tool-error sessions. `heavy` holds long,
high-cost, high-latency, and repeated-correction sessions. `memberships` lists
each stratum that the session matches, and always holds `baseline`. `reason`
is `<stratum>:<rule>`. `rule` is `uniform`, `tool-error`, `low-score`,
`long-session`, `high-cost`, or `high-latency`.

A content duplicate is a second session with the same `projectId` and the same
set of `traceIds`. The inventory holds no content hash and no correction count.
Thus `repeated-correction` is always in `unavailableSignals`.

### `normalized-sessions.jsonl`

One record for each session, or one record for each chunk of a large session.
`normalize` reads `sample.json` and `inventory.jsonl`.

| Field | Content |
|---|---|
| `sessionId`, `projectId` | Ids |
| `chunk` | `{ index, count }`; a session under `--max-bytes` has `{ index: 0, count: 1 }` |
| `taskGroupId`, `attempt` | The task group and the attempt number, or `null` |
| `harness`, `models` | From the observations |
| `costUsd`, `tokens` | Totals for the session |
| `traces` | A list of `{ traceId, timestamp, name }` in time order |
| `events` | A list of events in time order |
| `sourceLinks` | `{ session, traces: { <traceId>: <url> } }` |
| `capture` | `{ truncated, complete, missing, crossSessionParents, window }` |

Each chunk repeats each session-level field: `traces`, `sourceLinks`,
`capture`, and the totals. Only `chunk` and `events` change between chunks.

- `traces[].timestamp` is the earliest start time of the observations of the
  trace.
- `taskGroupId` comes only from the metadata key `taskGroupId` or
  `task_group_id`. `attempt` comes only from the metadata key `attempt`.
  `normalize` sets each field only when the session holds exactly one distinct
  value. Otherwise the field is `null`.

Each event holds `observationId`, `traceId`, `parentObservationId`, `type`,
`name`, `startTime`, `endTime`, `role`, `input`, `output`, `metadata`,
`model`, `level`, `statusMessage`, and `dedupedFrom`.

`capture.truncated` is `true` only on an explicit truncation marker.
`capture.complete` is `true`, `false`, or `"unknown"`. `capture.window` is
`{ from, to, source, splits }`. `source` is `inventory` or `run`. `window` is
`null` when a caller runs `normalizeSession` directly.

`capture.missing` lists each missing source item. A known gap sets
`complete` to `false`:

| Kind | Fields |
|---|---|
| `parent` | `observationId`, `traceId`, `referencedBy` |
| `trace` | `traceId` |
| `observations` | `expected`, `found` |
| `truncated` | `observationId`, `field` |

Each other kind sets `complete` to `"unknown"`, unless a known gap exists:

| Kind | Fields |
|---|---|
| `capture-limit` | `observationId`, `field`, `length` |
| `start-time` | `observationId` |
| `inventory-record` | `sessionId` |
| `parent-lookup` | `observationId`, `traceId`, `referencedBy`, `cause` |
| `parent-lookup-capped` | `observationId`, `traceId`, `referencedBy` |

A `parent` gap means that the trace lookup found the parent in the same
session, or did not find the parent. A parent in another session is not a gap.
`capture.crossSessionParents` lists each such parent as
`{ observationId, sessionId, referencedBy }`. The adapter contract describes
the trace lookup.

`normalize` adds `completeness.normalize` to the manifest:
`{ status, cause, sessions, chunks, complete, incomplete, unknown, truncated, crossSessionParents }`.

### `annotations.jsonl`

One record for each judgment.

| Field | Content |
|---|---|
| `annotationId` | A stable id |
| `sessionId`, `traceId`, `observationId` | Ids; `traceId` and `observationId` can be `null` |
| `dimension` | A rubric dimension id |
| `category` | A taxonomy category id, or `null` before taxonomy approval |
| `verdict` | `pass`, `fail`, `unknown`, or `not_applicable` |
| `evidence` | A list of `{ traceId, observationId, kind }` |
| `observedBehavior` | What the session shows |
| `proposedCause` | A causal hypothesis, kept apart from `observedBehavior` |
| `annotator` | `{ type, id }`; `type` is `human`, `agent`, or `judge` |
| `rubricVersion`, `judgeVersion` | Versions; `rubricVersion` is a non-empty string; `judgeVersion` is `null` for a human |
| `reviewStatus` | `pending`, `approved`, or `rejected` |
| `createdAt` | Timestamp |
| `judgeExample` | Optional. `true`, `false`, or `null`; `true` marks a human label that a judge prompt uses as an example |

`evidence[].kind` is `tool-result`, `command-exit`, `test-result`,
`file-change`, `user-message`, or `assistant-claim`. A `pass` on task completion
needs one evidence item with a kind other than `assistant-claim`.

### `taxonomy.json`

| Field | Content |
|---|---|
| `version` | The taxonomy version |
| `rubricVersion` | The rubric version, a non-empty string |
| `approval` | `{ approvedBy, approvedAt }`, or `null` before operator approval |
| `categories` | A list of `{ id, name, dimension, definition, counterexamples, sourceIds }` |

### `rubric.json`

| Field | Content |
|---|---|
| `version` | The rubric version, a non-empty string, for example `rubric-v1` |
| `positiveClass` | `fail` |
| `dimensions` | A list of `{ id, name, question, deterministicChecks, judge }` |
| `gate` | The calibration gate |

`judge` is `{ provider, model, promptVersion }`, or `null`. `gate` holds
`minLabeled` 30, `minFail` 10, `minPass` 10, `minTruePositiveRate` 0.8,
`minTrueNegativeRate` 0.8, and `minCoverage` 0.8. The operator can change each
gate value.

### `calibration.json`

| Field | Content |
|---|---|
| `rubricVersion` | The rubric version |
| `gate` | A copy of the gate from `rubric.json` |
| `judgeCalls` | `{ used, budget }` |
| `dimensions` | One entry for each dimension id |
| `judgeLabels` | A list of `{ annotationId, sessionId, dimension, annotatorType, verdict, status, reason }` for each `agent` and `judge` label |

Each dimension entry holds these fields:

- `sampleSize`
- `classes` as `{ fail, pass }`, the counts of human reference labels
- `confusion` as `{ truePositive, falsePositive, trueNegative, falseNegative }`
- `pass`, `fail`, `unknown`, and `notApplicable` counts
- `precision`, `recall`, `f1`, `truePositiveRate`, `trueNegativeRate`,
  `coverage`, and `passRate`
- `status`, which is `calibrated` or `provisional`
- `gateFailures`, which names each gate condition that failed
- `reasons`, which maps each `null` metric to its reason

`passRate` excludes `unknown` and `not_applicable` from the denominator.

`validate` applies these rules:

- The human reference label is the first human label for each session and
  dimension with a review status other than `rejected`. A label with
  `judgeExample: true` is not a reference label.
- The judge label is the first `agent` or `judge` label for each session and
  dimension, after the budget.
- Only a `judge` annotation uses a call from `--max-judge-calls`. After the
  budget, each remaining `judge` label holds the verdict `unknown` and the
  reason `budget-exhausted` in `judgeLabels`. The stage reports `partial`.
- `validate` never changes `annotations.jsonl`.
- A schema error prints `<file>:<line>: <field> <rule>` and never prints a
  field value. The stage then writes no `calibration.json` and reports
  `failed` with the cause `invalid-run-files`.
- If `annotations.jsonl` does not exist or holds no record, the stage reports
  `empty` with the cause `no-annotations`.
- The starting `rubric.json` is the JSON block in `rubric.md`.
- Each rubric version is a non-empty string: `version` in `rubric.json`, and
  `rubricVersion` in `taxonomy.json` and in each annotation. `publish` needs
  the same string.

### `facts.jsonl`

`validate` writes `facts.jsonl` when `normalized-sessions.jsonl` exists. The
module is `scripts/lib/facts.mjs`. The file holds one record for each
normalized session, in file order. The file holds ids, counts, classes, tool
names, and input hashes. The file holds no tool input, no tool output, and no
message text.

| Field | Content |
|---|---|
| `sessionId` | The session id |
| `toolCalls`, `toolErrors` | Counts |
| `resolvedErrors` | A list of `{ observationId, tool, resolvedBy }` |
| `unresolvedErrors` | A list of `{ observationId, tool, reason }` |
| `excludedErrors` | A list of `{ observationId, class }`; `class` is `red-test`, `pending-check`, or `obeyed-guard` |
| `repeatedFailingCalls` | A list of `{ tool, inputHash, observationIds }` |
| `guardBlocks` | A list of `{ observationId, remedy, nextObservationId, followUp }` |
| `unclassified` | A list of `{ observationIds, reason }` |

`validate` reads `normalized-sessions.jsonl` as a stream, one session at a
time. The chunks of one session are adjacent lines. A malformed line, a line
without `sessionId`, or a session id that repeats after another session is a
schema error. On a schema error, `validate` writes no `facts.jsonl`. The
checkpoint holds no checksum of a streamed file. Thus `validate` sets
`resumeAlways`, and each `--resume` runs the stage again. Before annotations
exist, `validate` writes `facts.jsonl` and reports `empty` with the cause
`no-annotations`. The stage counters hold `factsSessions`, `toolCalls`,
`toolErrors`, and the item count of each list field.

A tool call is an event with the role `tool`. The metadata value `tool_name`
or `codex.tool_name` gives the `tool` value. Without that metadata value, the
event name gives the `tool` value. The input hash is `sha256:<hex>` of the canonical JSON of the command text. When the input
holds no command text, the hash covers the full input.

A tool call fails when one condition is true:

- `level` is `ERROR`.
- `statusMessage` is not empty.
- The output or the metadata holds `is_error: true` or `isError: true`.
- The output or the metadata holds `exit_code` or `exitCode` other than 0.
- The output text starts with `Exit code <n>`, and `<n>` is not 0.
- The call is a guard block. A guard block result starts with
  `PreToolUse:<tool> hook error`, `BLOCKED by`, or `hook error:`.

Each tool error enters exactly one list: `resolvedErrors`, `unresolvedErrors`,
`excludedErrors`, or `unclassified`. The first match in this order sets the
list:

| Step | Condition | Entry |
|---|---|---|
| 1 | A guard block | See the guard rules |
| 2 | `gh pr checks` exits 8 | `excludedErrors`, class `pending-check` |
| 3 | A test command fails, a later edit follows, and a later run of the same command passes | `excludedErrors`, class `red-test` |
| 4 | A later call to the same tool with a different input hash passes | `resolvedErrors` |
| 5 | A later call to the same tool with the same input hash passes | `unclassified`, reason `identical-retry-succeeded` |
| 6 | Each other error | `unresolvedErrors` |

The `reason` of an unresolved error is `no-later-call`,
`identical-retries-only`, `changed-calls-failed`, or `guard-routed-around`.

A run of identical failing calls holds two or more adjacent tool calls with the
same tool and the same input hash, and each call fails.

`remedy` is `ask-user` when the guard text names the user, the operator, or
approval. `remedy` is `explicit-paths` when the text names explicit paths.
`remedy` is `other` when the text holds `use`, `run`, `instead`, or `try`.
When no pattern matches, `remedy` is `null`.

A turn boundary is an event with the role `user`, or a root event of another
trace with a type other than `GENERATION`. The guard rules check the next 10 tool calls
before the next turn boundary:

- `obeyed`: no tool call comes before the turn boundary or the session end.
- `obeyed`: the first later tool call is an ask-user tool, for example
  `AskUserQuestion`.
- `routed-around`: a later call deletes a target path of the blocked delete
  with a different program, for example `git rm`, `find -delete`, `unlink`,
  or `node -e` with `fs.rmSync`.
- `routed-around`: a later command holds the blocked command text.
- `routed-around`: a later write puts the blocked command text in a file, and a
  later call runs the file.
- `obeyed`: the remedy is `explicit-paths`, and the first later call uses the
  same tool and the same program without a glob character.
- `unclear`: each other follow-up.

`nextObservationId` is the event that sets the follow-up. For `unclear`,
`nextObservationId` is the first later tool call. After a stop at the session
end, `nextObservationId` is `null`. An `obeyed` block enters `excludedErrors`. A `routed-around` block
enters `unresolvedErrors`. An `unclear` block enters `unclassified` with the
reason `guard-follow-up-unclear`.

### `dataset-items.jsonl`

One record for each dataset item.

| Field | Content |
|---|---|
| `itemId` | `bt-item-<32 hex>`, derived from project, source, rubric version, and dataset version |
| `split` | `regression`, `demonstrations`, or `holdout` |
| `groupId` | `task:<taskGroupId>` or `session:<sessionId>` |
| `source` | `{ projectId, sessionId, traceIds, observationIds }` |
| `sourceLinks` | Langfuse URLs |
| `input` | The case input |
| `expectedBehavior` | The explicit expected behavior |
| `acceptanceOracle` | The behavioral check of the case result |
| `correction` | The reviewed correction, or `null` |
| `reviewStatus` | `pending`, `approved`, or `rejected` |
| `holdoutEligible` | `false` when an exploratory step exposed the session |
| `fixture` | `{ revision, environment, requirements }`, or `null` |
| `replayable` | `true`, `false`, or `"unknown"` |
| `provenance` | `{ annotationIds, rubricVersion, createdBy }` |
| `datasetVersion` | The dataset version |
| `contentHash` | `sha256:<hex>` of the item content |

The agent writes each candidate to `dataset-items.jsonl` without `itemId`,
`split`, and `contentHash`. A candidate needs `source.sessionId` and
`reviewStatus`. The other fields are optional and default to `null`.
`publish` curates the candidates and writes the curated items back to the
file. A record with `itemId`, `split`, and `contentHash` is a frozen item and
keeps its split and its group.

- The hex of `itemId` is the first 32 characters of the SHA-256 of the
  canonical JSON of the project id, the session id, the sorted trace ids, the
  sorted observation ids, the rubric version, and the dataset version.
- `contentHash` covers the canonical JSON of `input`, `expectedBehavior`,
  `acceptanceOracle`, `correction`, and `fixture`.
- A development group enters `demonstrations` only when each item of the group
  qualifies. An item qualifies when its review status is `approved` and one
  condition is true: the item has a `correction`, or the annotations in
  `provenance.annotationIds` hold no `fail` and at least one approved `pass`.
  Otherwise the group enters `regression`.
- Each session in `sample.json` counts as exposed by default, so its items
  hold `holdoutEligible: false`.

### `publication-ledger.json`

| Field | Content |
|---|---|
| `projectId` | The Langfuse project id |
| `datasetPrefix` | For example `agro/behavior` |
| `datasetVersion` | The dataset version |
| `rubricVersion` | The rubric version |
| `entries` | A list of completed writes |

Each entry holds `key`, `kind`, `dataset`, `remoteId`, `contentHash`,
`outcome`, `writtenAt`, and `retractedAt`. `kind` is `dataset`, `item`, or
`score`. `key` is the dataset name, the stable item id, or the stable score id.
`outcome` is `created` or `adopted`. `retractedAt` is `null` until
`publish --retract --apply` deletes the record.

If the ledger records another project, prefix, dataset version, or rubric
version, `publish` fails with the cause `ledger-mismatch`. The item write
puts `correction` in `expectedOutput`. The score names are
`behavior.<dimension>.human`, `behavior.<dimension>.judge`, and
`behavior.<dimension>.agent`. Each score holds the source `API`. The score
metadata holds `calibrationStatus` for an automated label.

### `report.json` and `report.md`

`report.json` holds these fields:

- `schemaVersion`, `runId`, `generatedAt`, `window`, `filters`, `project`,
  `endpoint`, and `versions`
- `rateLabel` and `rateNote`
- `inputs`, which maps each input file to `read`, `invalid`, or `not-run`
- `stages` with `{ status, cause, attempts, finishedAt }` of each other stage
- `counts` and `denominators`
- `inventory` and `sample` summaries
- `categoryDenominator`, and `categories` as a list of
  `{ id, dimension, count, denominator, calibrationStatus, sessionIds, sourceLinks }`
- `captureGaps`
- `calibration` with the status of each dimension
- `datasets` with the dataset versions
- `comparison`, a summary of `comparison.json`
- `errors` with the cause code and the redacted message of each error

The stage marks a missing input file `not-run`, never zero. If an input file
does not parse, the stage marks the file `invalid`, lists the file in
`errors`, and reports `partial`.

`report.md` presents the content of `report.json`. Both files hold ids, counts,
and links only. Both files hold no message text.

### Result records

`compare` reads one result file for each arm. `--baseline` names the baseline
file; the default is `baseline-results.jsonl`. `--candidate` names the
candidate file; the default is `candidate-results.jsonl`. Each line is one
case:

| Field | Content |
|---|---|
| `caseId` | The dataset item id; each case occurs once in each arm |
| `arm` | `baseline` or `candidate`; must match the file |
| `runId` | The id of the fresh agent run |
| `split` | `regression`, `demonstrations`, or `holdout` |
| `startRevision` | The starting repository revision, or `null` |
| `fixture` | The sandbox-safe execution fixture, or `null` |
| `replayable` | `true`, `false`, or `"unknown"` |
| `finalResponseHash` | The hash of the final response of the run, or `null` |
| `evaluator`, `budget` | Objects; both arms hold equal values |
| `dimensions` | `{ <dimension>: <verdict> }` |
| `costUsd`, `latencyMs` | Numbers, or `null` |

### `comparison.json`

| Field | Content |
|---|---|
| `status`, `cause` | The stage status and the cause code |
| `generatedAt` | Timestamp |
| `files` | `{ baseline, candidate }` file names |
| `thresholds` | `{ file, checksum, rubricVersion, createdAt, createdBy, dimensions }`, or `null` |
| `counts` | `{ cases, counted, reviewOnly, holdout, rejected, mismatches }` |
| `cases` | A list of `{ caseId, split, status, reasons, runIds }`; `status` is `counted` or `review-only` |
| `mismatches` | A list of `{ caseId, field }` |
| `rejected` | A list of `{ caseId, cause }` |
| `dimensions` | The per-dimension results, unknowns, regressions, and improvements |
| `cost`, `latency` | Totals and means for each arm, and the delta |
| `runIds` | `{ baseline, candidate }` run ids of the counted cases |
| `verdict` | `meets-thresholds`, `below-thresholds`, `undefined`, or `null` without thresholds |

### `compare-thresholds.json`

| Field | Content |
|---|---|
| `createdAt`, `createdBy` | Timestamp and author |
| `rubricVersion` | The rubric version |
| `dimensions` | `{ <dimension>: { minImprovement, maxRegression } }` |

`minImprovement` is the minimum pass-rate delta, from -1 to 1.
`maxRegression` is the maximum count of cases that move from `pass` to
`fail`.

The advisor writes this file before the advisor reads a holdout result. `compare`
refuses to read holdout results while this file does not exist.
