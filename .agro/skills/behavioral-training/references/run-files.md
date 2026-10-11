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
- A new attempt receives the previous checkpoint in `ctx.previous`.

## Stage module contract

A stage module is `scripts/lib/<stage>.mjs`. The module exports one required
function and two optional values:

```js
export const options = {
  apply: { type: "boolean", description: "Write to Langfuse." },
  "dataset-prefix": { type: "string", default: "agro/behavior", description: "Dataset namespace." },
};

export const help = "Extra help text for this stage.";

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
| `inventory.jsonl` | `inventory` | US-003 | metadata |
| `sample.json` | `sample` | US-004 | metadata |
| `normalized-sessions.jsonl` | `normalize` | US-005 | transcript |
| `annotations.jsonl` | the agent; `validate` checks | US-006 | transcript |
| `taxonomy.json` | the agent; the operator approves; `validate` checks | US-006 | transcript |
| `rubric.json` | the agent from the starting rubric; `validate` checks | US-006 | metadata |
| `calibration.json` | `validate` | US-006 | metadata |
| `dataset-items.jsonl` | `publish` | US-007 | transcript |
| `publication-ledger.json` | `publish` | US-008 | metadata |
| `report.json` | `report` | US-009 | metadata |
| `report.md` | `report` | US-009 | metadata |
| `compare-thresholds.json` | the advisor; `compare` reads | US-009 and US-012 | metadata |

Each field that the source does not supply holds `null`. A stage never invents
a value. Each timestamp is a UTC ISO-8601 string that ends in `Z`.

### `manifest.json`

| Field | Content |
|---|---|
| `schemaVersion` | `1` |
| `runId` | A random UUID |
| `createdAt`, `updatedAt` | Timestamps |
| `endpoint` | `{ baseUrl }` from `agro.json`, or `null` before preflight |
| `project` | `{ id, name }` from preflight, or `null` |
| `window` | `{ since, until }` |
| `filters` | `{ environment, harness }` |
| `sampling` | `{ policy, sampleSize, seed }`; `policy` is `stratified-50-25-25` |
| `budgets` | `{ maxSessions, maxBytes, maxJudgeCalls }` |
| `sources` | A list of `{ id, kind, checksum }` for each source export or fixture |
| `versions` | `{ node, cli, skill, api, harnesses, models }` |
| `completeness` | Counters that each stage adds; see `inventory.jsonl` |
| `datasets` | `{ prefix, version }` |
| `rubric` | `{ version }` |
| `stages` | One checkpoint for each stage that ran |

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
| `toolErrorCount` | The count of tool observations with an error level or an error status |
| `latencyMs` | `lastSeenAt` minus `firstSeenAt` in milliseconds |
| `costUsd` | The total cost |
| `tokens` | `{ input, output, total }` |
| `scores` | A list of `{ name, value, source }` from existing Langfuse scores |
| `unavailable` | The field names that the source did not supply |

`inventory` adds `completeness.inventory` to the manifest. The summary counts
sessions by harness, model, environment, session length, tool errors, latency,
cost, and outcome signal. `completeness.inventory.unavailableFields` lists each
field that no session supplied.

### `sample.json`

| Field | Content |
|---|---|
| `policy` | `stratified-50-25-25` |
| `seed`, `sampleSize` | From the manifest |
| `inventoryChecksum` | The checksum of `inventory.jsonl` |
| `eligibleCount` | The count of eligible sessions |
| `strata` | `{ baseline, flagged, heavy }`; each holds `{ target, eligible, selected }` |
| `reallocation` | A list of `{ from, to, slots }` for each moved slot |
| `sessions` | A list of `{ sessionId, stratum, memberships, reason }` |

`flagged` holds flagged, low-score, and tool-error sessions. `heavy` holds long,
high-cost, high-latency, and repeated-correction sessions. `memberships` lists
each stratum that the session matches. `reason` names the rule that selected
the session.

### `normalized-sessions.jsonl`

One record for each session, or one record for each chunk of a large session.

| Field | Content |
|---|---|
| `sessionId`, `projectId` | Ids |
| `chunk` | `{ index, count }`; a session under `--max-bytes` has `{ index: 0, count: 1 }` |
| `taskGroupId`, `attempt` | The task group and the attempt number, or `null` |
| `harness`, `models` | From the observations |
| `costUsd`, `tokens` | Totals for the session |
| `traces` | A list of `{ traceId, timestamp, name }` in time order |
| `events` | A list of events in time order |
| `sourceLinks` | Langfuse URLs for the session and each trace |
| `capture` | `{ truncated, complete, missing }` |

Each event holds `observationId`, `traceId`, `parentObservationId`, `type`,
`name`, `startTime`, `endTime`, `role`, `input`, `output`, `model`, `level`,
`statusMessage`, and `dedupedFrom`. `capture.truncated` is `true` only on an
explicit truncation marker. `capture.complete` is `true`, `false`, or
`"unknown"`. `capture.missing` lists each missing source item.

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
| `rubricVersion`, `judgeVersion` | Versions; `judgeVersion` is `null` for a human |
| `reviewStatus` | `pending`, `approved`, or `rejected` |
| `createdAt` | Timestamp |

`evidence[].kind` is `tool-result`, `command-exit`, `test-result`,
`file-change`, `user-message`, or `assistant-claim`. A `pass` on task completion
needs one evidence item with a kind other than `assistant-claim`.

### `taxonomy.json`

| Field | Content |
|---|---|
| `version` | The taxonomy version |
| `rubricVersion` | The rubric version |
| `approval` | `{ approvedBy, approvedAt }`, or `null` before operator approval |
| `categories` | A list of `{ id, name, dimension, definition, counterexamples, sourceIds }` |

### `rubric.json`

| Field | Content |
|---|---|
| `version` | The rubric version |
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

Each dimension entry holds these fields:

- `sampleSize`
- `confusion` as `{ truePositive, falsePositive, trueNegative, falseNegative }`
- `unknown` and `notApplicable` counts
- `precision`, `recall`, `f1`, `truePositiveRate`, `trueNegativeRate`,
  `coverage`, and `passRate`
- `status`, which is `calibrated` or `provisional`
- `reasons`, which maps each `null` metric to its reason

`passRate` excludes `unknown` and `not_applicable` from the denominator.

### `dataset-items.jsonl`

One record for each dataset item.

| Field | Content |
|---|---|
| `itemId` | Derived from project, source, rubric version, and dataset version |
| `split` | `regression`, `demonstrations`, or `holdout` |
| `groupId` | The task group id |
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
| `contentHash` | The SHA-256 of the item content |

### `publication-ledger.json`

| Field | Content |
|---|---|
| `projectId` | The Langfuse project id |
| `datasetPrefix` | For example `agro/behavior` |
| `datasetVersion` | The dataset version |
| `entries` | A list of completed writes |

Each entry holds `key`, `kind`, `dataset`, `remoteId`, `contentHash`, and
`writtenAt`. `kind` is `item` or `score`. `key` is the stable item id or the
stable score id.

### `report.json` and `report.md`

`report.json` holds these fields:

- `runId`, `window`, `filters`, and `project`
- `counts` and `denominators`
- `categories` as a list of `{ id, count, denominator, sessionIds, sourceLinks }`
- `captureGaps`
- `calibration` with the status of each dimension
- `datasets` with the dataset versions
- `errors` with the cause code and the redacted message of each error

`report.md` presents the content of `report.json`. Both files hold ids, counts,
and links only. Both files hold no message text.

### `compare-thresholds.json`

| Field | Content |
|---|---|
| `createdAt`, `createdBy` | Timestamp and author |
| `rubricVersion` | The rubric version |
| `dimensions` | `{ <dimension>: { minImprovement, maxRegression } }` |

The advisor writes this file before the advisor reads a holdout result. `compare`
refuses to read holdout results while this file does not exist.
