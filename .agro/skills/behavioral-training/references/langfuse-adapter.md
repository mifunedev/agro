# Langfuse adapter contract

This file is the contract of the Langfuse adapter. The adapter is
`.agro/skills/behavioral-training/scripts/lib/langfuse.mjs`. Each stage reads
Langfuse only through `ctx.langfuse()`, which returns the adapter client. The
stage code never starts the Langfuse CLI directly.

## Transport

The adapter runs the pinned official CLI `@langfuse/cli@1.2.4` through `npx`.
The adapter does not install the CLI globally.

```bash
npx -y @langfuse/cli@1.2.4 --env <configRoot>/.env --host <baseUrl> --api-version <version> api <resource> <action> [flags] --json
```

- The adapter starts the CLI with an argument list. The adapter never starts a shell.
- The adapter adds `--json` to each API call. The CLI then prints one envelope
  `{ status, headers, body }` on stdout.
- The adapter reads `body` from the envelope. The adapter reads `status` from
  the envelope when the CLI exits with code 5.
- Tests inject a fake runner through `createClient(ctx, { runner, sleep })`.
  The runner receives `(command, args, { env, input })` and returns
  `{ exitCode, stdout, stderr }`. `input` is the request body of a write, or
  is absent on a read.

## Configuration

The adapter reuses the AGRO Langfuse configuration. The adapter adds no second
configuration store.

### Configuration root

The configuration root is the directory that holds `agro.json` and `.env`. The
adapter selects the first directory in this order:

1. `AGRO_PROJECT_ROOT` from the process environment, when the directory holds
   `agro.json`. The sandbox sets `AGRO_PROJECT_ROOT` to the main project
   checkout. `.agro/scripts/link-providers.sh` uses the same variable.
2. `ctx.repoRoot`. The dispatcher derives this directory from the script
   location.

A git worktree under `.worktrees/` holds no `.env` and no local `agro.json`
settings of the operator. Run a stage from a worktree only when
`AGRO_PROJECT_ROOT` names the main checkout. If `AGRO_PROJECT_ROOT` names a
directory without `agro.json`, the adapter ignores the variable.

`preflight()` returns the selected directory in `configRoot`. The client also
exposes `client.configRoot` and `client.envFile`. Both values are paths and
hold no credential.

### Base URL

The adapter selects the first value in this order:

1. `langfuse.baseUrl` in `<configRoot>/agro.json`.
2. `LANGFUSE_BASE_URL` in the process environment.
3. `https://cloud.langfuse.com`. This default is equal to the default of
   `resolveLangfuse` in `.agro/cli/src/commands/langfuse.ts`.

The adapter removes a trailing `/` from the value. The adapter always passes
the value through `--host`. A `LANGFUSE_BASE_URL` in the root `.env` file
cannot change the host, because `--host` has precedence in the CLI.

### Keys

- The root `.env` file holds `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`.
  The same file is the source of `loadLangfuseCredentials`.
- If `<configRoot>/.env` exists, the adapter passes the path through `--env`. The
  CLI reads the keys from the file.
- If `<configRoot>/.env` does not exist, the adapter omits `--env`. The CLI then
  reads the keys from the process environment.
- The adapter never reads the `.env` file. The adapter checks only that the
  file exists.
- The adapter never puts a key in an argument, a run file, or an error message.

## Read operations

The adapter calls only the read operations in this list:

| Operation | Endpoint | Use |
|---|---|---|
| `projects list` | `GET /api/public/projects` | The project of the key |
| `observations list` | `GET /api/public/v2/observations` | Observation metadata |
| `scores list` | `GET /api/public/v3/scores` | Existing scores, when the contract has the operation |

A call to each other operation fails with `unsupported-operation`, and the
adapter starts no process. The adapter never calls a `legacy-*` resource. The
adapter never calls `traces list` or `traces get`. `client.call()` never
writes to Langfuse. Only the write client writes.

## Write operations

The write client is the only path to a write. `client.writer({ apply: true })`
returns the write client. `publish --apply` is the only caller.

- `client.writer()` without `apply: true` fails with `unsupported-operation`.
- `client.writer({ apply: true })` before `preflight()` fails with
  `unsupported-operation`. The preflight confirms the project of the key.
- `client.call()` refuses each write operation. A read stage therefore cannot
  write through `call()`.

The write client calls only the operations in `WRITE_OPERATIONS`:

| Operation | Endpoint | Method |
|---|---|---|
| `datasets get` | `GET /api/public/v2/datasets/{datasetName}` | `getDataset(name)` |
| `datasets create` | `POST /api/public/v2/datasets` | `createDataset(body)` |
| `dataset-items get` | `GET /api/public/dataset-items/{id}` | `getItem(id)` |
| `dataset-items create` | `POST /api/public/dataset-items` | `upsertItem(body)` |
| `dataset-items delete` | `DELETE /api/public/dataset-items/{id}` | `deleteItem(id)` |
| `scores create` | `POST /api/public/scores` | `upsertScore(body)` |
| `scores delete` | `DELETE /api/public/scores/{scoreId}` | `deleteScore(id)` |

The list holds no `traces` operation and no `observations` operation. The
write client therefore cannot change trace content.

### Write transport

```bash
npx -y @langfuse/cli@1.2.4 --env <configRoot>/.env --host <baseUrl> --api-version <version> api <resource> <action> [<path id>] [--body-file -] --json
```

- The adapter passes a path id, for example a dataset name or an item id, as
  a positional argument. The CLI encodes the path id.
- The adapter writes the JSON request body to the standard input of the CLI
  and passes `--body-file -`. The body never appears in the argument list.

### Ids and retries

- `upsertItem` needs a caller-supplied `id` and `datasetName`. Langfuse
  upserts a dataset item on its `id`.
- `upsertScore` needs a caller-supplied `id` and `name`. Langfuse upserts a
  score on its `id`.
- `createDataset` needs a `name`.
- If a required field is missing, the call fails with `unsupported-operation`,
  and the adapter starts no process.

Each write carries its id, so a repeated write changes no data. The adapter
retries HTTP 429 and 5xx on a write with the read rules. The adapter does
not retry HTTP 422 on a write. A write error uses the read causes and the read
redaction. `error.status` holds the HTTP status, or `null`.

### Absent records

- `getDataset` and `getItem` return `null` on HTTP 404.
- `deleteItem` and `deleteScore` return `true` after a delete. They return
  `false` on HTTP 404.
- Langfuse has no dataset delete endpoint. The write client cannot delete a
  dataset.

## Publish stage

`lib/publish.mjs` is the only stage that writes to Langfuse.

| Flag | Effect |
|---|---|
| `--apply` | Writes the planned datasets, items, and scores |
| `--retract` | Plans the deletion of each item and score in the ledger |
| `--dataset-prefix <prefix>` | Sets the dataset namespace. Default: the manifest prefix, else `agro/behavior` |
| `--require-calibrated` | Refuses each automated label of a provisional dimension |

### Dry run

Without `--apply`, the stage makes zero Langfuse calls.

1. The stage reads `dataset-items.jsonl`. A record with `itemId`, `split`, and
   `contentHash` is a frozen item. Each other record is a candidate.
2. The stage curates the candidates and the frozen items with
   `curateDatasetItems`. A frozen item keeps its split and its group.
3. The stage writes the curated items to `dataset-items.jsonl` atomically.
4. The stage prints one `plan:` line for each planned write. A line holds ids,
   the dataset name, the content hash, and counts. A line holds no item
   content.
5. The stage reports `complete` and exits 0.

### Datasets and items

The stage ensures three datasets:

- `<prefix>/regression-<version>`
- `<prefix>/demonstrations-<version>`
- `<prefix>/holdout-<version>`

`<version>` is `manifest.datasets.version`, else `v1`. The stage writes the
prefix and the version to `manifest.datasets`.

Each item write holds these fields:

| Field | Content |
|---|---|
| `id` | The `itemId` from `dataset-items.jsonl` |
| `datasetName` | The dataset of the item split |
| `input` | `input` |
| `expectedOutput` | `{ expectedBehavior, acceptanceOracle, correction }` |
| `metadata` | The session linkage, the provenance, `split`, `groupId`, `contentHash`, `rubricVersion`, and `datasetVersion` |
| `sourceTraceId` | The trace id, when the item has exactly one trace |
| `sourceObservationId` | The observation id, when the item also has exactly one observation |
| `status` | `ACTIVE` |

### Scores

The stage publishes each label as a session score with `dataType`
`CATEGORICAL`. The value is `pass`, `fail`, `unknown`, or `not_applicable`.

| Label | Source | Score name | `source` | Metadata |
|---|---|---|---|---|
| Human | The first non-rejected human label of each session and dimension in `annotations.jsonl` | `behavior.<dimension>.human` | `ANNOTATION` | `labelKind: human`, `reviewStatus` |
| Automated | The first label of each session, dimension, and annotator type in `calibration.json` `judgeLabels` | `behavior.<dimension>.<agent or judge>` | `API` | `labelKind: automated`, `calibrationStatus` |

- The score id is `bt-score-<32 hex>`. The hex is the SHA-256 of the project
  id, the session id, the dimension, the annotator type, the rubric version,
  and the dataset version.
- The stage skips each automated label with a `reason`, for example
  `budget-exhausted`.
- A score holds no `comment`, no `traceId`, and no `observationId`.
- `--require-calibrated` refuses a provisional automated label with the cause
  `provisional-label`. Without the flag, the stage publishes the label with
  `calibrationStatus: provisional`.

### Refusals

Each refusal happens before the first write.

| Cause | Condition |
|---|---|
| `unreviewed-demonstration` | A `demonstrations` item lacks `reviewStatus: "approved"` |
| `provisional-label` | The operator gives `--require-calibrated`, and an automated label is provisional |
| `missing-calibration` | `annotations.jsonl` holds an automated label, and `calibration.json` does not exist |
| `missing-project` | `manifest.json` holds no project id |
| `missing-rubric-version` | `manifest.json` and `rubric.json` hold no rubric version |
| `ledger-mismatch` | The ledger records another project, prefix, dataset version, or rubric version |
| `conflict` | A ledger entry holds another content hash than the planned write |
| `project-mismatch` | The key sees another project than the run records |

### Ledger

`publication-ledger.json` holds `projectId`, `datasetPrefix`,
`datasetVersion`, `rubricVersion`, and `entries`. The stage writes the ledger
atomically after each completed write.

Each entry holds `key`, `kind`, `dataset`, `remoteId`, `contentHash`,
`outcome`, `writtenAt`, and `retractedAt`. `kind` is `dataset`, `item`, or
`score`. `outcome` is `created` or `adopted`.

`--apply` runs the planned writes in this order: datasets, items, scores.

1. The stage skips each write with a live ledger entry.
2. For a dataset, the stage calls `getDataset`. If the dataset exists, the
   stage records the entry as `adopted`. Otherwise, the stage creates the
   dataset.
3. For an item, the stage calls `getItem`.
   - If the item is absent, the stage upserts the item.
   - If `metadata.contentHash` and the dataset name are equal, the stage
     records the entry as `adopted`, and writes nothing.
   - Otherwise, the stage stops with the cause `conflict` and exits 1. The
     message names the item id.
4. For a score, the stage upserts the score.

An interrupted `--apply` keeps each completed entry. A later
`publish --apply --resume` skips each entry and writes zero duplicates.

### Retraction

`--retract` is for a synthetic test publication.

- Without `--apply`, the stage prints one `plan:` line for each live item and
  score entry, and exits 0.
- With `--apply`, the stage deletes each live score entry, then each live item
  entry. The stage deletes no other record.
- The stage sets `retractedAt` on each deleted entry, and writes the ledger
  after each delete.
- The stage prints `dataset remains <name>` for each dataset. Langfuse has no
  dataset delete endpoint.
- Without `publication-ledger.json`, the stage reports `empty` with the cause
  `no-ledger`.

## Preflight

`client.preflight()` runs three steps in this order:

1. `npx -y @langfuse/cli@1.2.4 --version` gives the CLI version.
2. `api schema --json` with `--api-version auto` gives the API contract. The
   CLI reads `/api/public/health` and selects the newest bundled contract that
   the deployment supports. Later calls pass the selected version through
   `--api-version`.
3. `projects list` gives the project identity.

### Capability discovery

The adapter reads the resources of the API contract. The adapter ignores each
`legacy-*` resource and each deprecated action.

- `projects list` and `observations list` are required. If one is missing,
  preflight fails with `incompatible-endpoint`.
- `scores list` is optional. If the operation is missing,
  `capabilities.scores` is `null`, and each inventory record holds
  `scores: null`.
- `capabilities.sessions` is `observations`. The CLI offers sessions only
  through the deprecated `legacy-sessions` resource. The adapter therefore
  groups observations by the `sessionId` field.

### Project identity

A project-scoped key sees one project. The adapter reads the top-level `data`
list of the response. The adapter takes `id` and `name` from the one entry.
The adapter ignores the nested `organization` object.

- An empty `data` list fails with `bad-response`.
- A `data` list with more than one entry fails with `ambiguous-project`.

`preflight()` returns `{ baseUrl, configRoot, cliVersion, apiVersion, project, capabilities }`.
The result holds no credential.

## Pagination

`client.listObservations(query, { cursor })`,
`client.listSessionObservations(sessionId, { cursor, fromStartTime, toStartTime })`, and
`client.listScores(query, { cursor })` read one page. Each method returns
`{ items, cursor }`. `cursor` is `null` on the last page. Each method uses the
same retries and the same redaction.

- `listObservations` requests the field groups `core`, `basic`, `model`,
  `usage`, and `trace_context`. The method never requests `io` or `metadata`.
- `listObservations` sends `--from-start-time`, `--to-start-time`, and
  `--environment` from the query. The page size is 1000.
- `listSessionObservations` sends `--session-id` and requests the field groups
  in `CONTENT_FIELDS`: `core`, `basic`, `time`, `io`, `metadata`, `model`,
  `usage`, `metrics`, and `trace_context`. The page size is 50, the API
  default, because one page of `io` can hold many full message histories.
- If the caller gives `fromStartTime` and `toStartTime`,
  `listSessionObservations` sends `--from-start-time` and `--to-start-time`.
- `listSessionObservations` sends `--expand-metadata` with the keys in
  `EXPANDED_METADATA_KEYS`: `input_meta`, `output_meta`, `user_text`, and
  `assistant_text`.
- `listScores` requests the field group `subject` and the data types
  `NUMERIC`, `BOOLEAN`, and `CATEGORICAL`. The method never requests `TEXT`,
  `CORRECTION`, or the `details` group, because these hold free text. The page
  size is 100.
- The adapter does not use the CLI flag `--all`. The stage reads one page at a
  time, and saves the cursor after each page.

## Content reads

The field groups `io` and `metadata` hold transcript content. A content read is
an `observations list` call that requests one of these groups.

- Only the `normalize` stage requests content.
- `normalize` reads content only for the sessions in `sample.json`.
- `normalize` reads content only through `listSessionObservations`.
- The adapter refuses a content read without `--session-id`. The cause is
  `unsupported-operation`, and the adapter starts no process.
- `listObservations` never requests `io` or `metadata`. The `inventory` stage
  stays metadata-only.
- The Claude Code plugin records its truncation flag `truncated: true` in the
  metadata keys `input_meta`, `output_meta`, `user_text`, and
  `assistant_text`. The adapter expands these keys, so the API never cuts the
  flag.
- The API truncates each other metadata value above 200 characters and
  documents no truncation marker. `normalize` therefore never treats another
  metadata value as complete.

### Session windows

A content read without a time window failed on the dev deployment. Langfuse
returned HTTP 422 with the message "Please narrow your request by adding more
specific filters (e.g., a shorter date range)." `normalize` therefore sends a
window on each content read.

1. The window starts 1 hour before `firstSeenAt` and ends 1 hour after
   `lastSeenAt` of the inventory record of the session.
2. If the inventory record has no `firstSeenAt` or no `lastSeenAt`, the window
   is the run window.
3. `isNarrowRequest(error)` is `true` for an HTTP 422 whose message asks for a
   narrower request. Each other HTTP 422 keeps the normal error rules.
4. On a narrow-request HTTP 422, `normalize` splits the window into two halves
   and reads each half. The stage merges the observations by id.
5. The stage splits a window again until the window is 10 minutes or shorter.
   A narrow-request HTTP 422 on such a window fails the stage with
   `http-error`.
6. `capture.window` in `normalized-sessions.jsonl` records `from`, `to`,
   `source` (`inventory` or `run`), and `splits`. The value holds metadata
   only.

## Errors

Each failure is a `LangfuseError`. `error.cause` is one cause code.
`error.message` is a short redacted message.

| Cause | Condition |
|---|---|
| `missing-credentials` | The CLI exits with code 3 on an API call |
| `forbidden` | HTTP 401 or HTTP 403 |
| `incompatible-endpoint` | HTTP 404, a required operation is missing, or `api schema` finds no compatible contract |
| `unreachable` | The CLI exits with code 4 |
| `http-error` | Another HTTP status, or HTTP 422, 429, or 5xx after the last retry |
| `bad-response` | The output is not JSON, has no envelope, or has an unexpected shape |
| `ambiguous-project` | The key sees more than one project |
| `unsupported-operation` | The call names an operation outside the read list or the write list. Or a content read has no session id. Or a write has no id |
| `cli-unavailable` | `npx` cannot start the CLI |
| `cli-failed` | The CLI exits with another code |
| `bad-config` | `agro.json` is not valid JSON |

## Retries

- The adapter retries HTTP 429 and HTTP 500 to 599.
- The adapter retries one call at most 3 times. The waits are 1000 ms,
  2000 ms, and 4000 ms.
- The adapter retries HTTP 422 on a read operation at most 1 time. This
  budget is separate from the budget of HTTP 429 and 5xx. A second HTTP 422
  fails with `http-error` and the server detail.
- The wait before a retry is 1000 ms times 2 to the power of the earlier
  retries of the same call.
- The adapter never retries HTTP 401, HTTP 403, or CLI exit code 3.
- The adapter does not retry exit code 4. The stage saves the cursor, so
  `--resume` continues after a network failure.

The HTTP 422 retry has a reason. Langfuse 4.41.0 on the dev deployment
returned HTTP 422 on `observations list` with a cursor two times in about 37
pages. The same request with the same cursor succeeded on the next attempt. A
read operation changes no data, so one more attempt is safe. A repeated HTTP 422
is a real error, and the adapter stops.

## Redaction

The adapter applies `redact()` to each message before the message leaves the
adapter. `redact()` replaces these values with `<redacted>`:

- each substring that starts with `pk-lf-` or `sk-lf-`;
- the value after `Basic` or `Bearer`;
- the value after `LANGFUSE_PUBLIC_KEY=` or `LANGFUSE_SECRET_KEY=`.

An error message holds the operation, the cause, the HTTP status or the CLI
exit code, and one server detail. The adapter selects the server detail in
this order:

1. The `message` field of the response body in the CLI `--json` envelope.
2. The `error` field of the response body.
3. The first non-empty line of the CLI output on stderr.

The adapter applies `redact()` to the server detail and keeps at most 300
characters. An error message holds no other part of a response body.

## Inventory stage

`lib/inventory.mjs` is the first stage that uses the adapter.

1. The stage runs `preflight()`. The stage writes `endpoint`, `project`,
   `versions.cli`, and `versions.api` to `manifest.json`. `endpoint` holds
   `baseUrl`, `configRoot`, and `capabilities`, and holds no credential.
2. The stage reads observation pages in the run window. After each page, the
   stage appends the page to `inventory-pages.jsonl` and saves the cursors with
   `ctx.saveProgress`.
3. If the contract has `scores list`, the stage reads score pages in the run
   window in the same way.
4. The stage groups the observations by `sessionId` and writes
   `inventory.jsonl`.
5. The stage writes the summary to `manifest.completeness.inventory`.

### Privacy

`inventory-pages.jsonl` and `inventory.jsonl` hold metadata only. The stage
keeps ids, types, timestamps, the environment, the level, the model name, the
harness tag, token counts, and the cost. The stage keeps no `statusMessage`,
no input, no output, and no metadata value.

### Resume

`ctx.saveProgress` stores `{ projectId, pages, observations, scores }`.
`observations` and `scores` each hold `{ cursor, done }`.

- `--resume` reads `inventory-pages.jsonl` and continues from the saved cursor.
- The stage removes a repeated row by its id. A repeated page then adds no
  count.
- If the project id changed or `inventory-pages.jsonl` does not exist, the
  stage starts from the first page.

### Derived fields

- `harness` is the most frequent tag that names a harness id from the AGRO
  harness catalog, for example `claude-code`, `codex`, or `pi`.
- `toolErrorCount` counts the `TOOL` observations with the level `ERROR`. If
  the session has no `TOOL` observation, the value is `null`.
- `latencyMs` is `lastSeenAt` minus `firstSeenAt`.
- `scores` holds the session scores. The list also holds the scores of the
  traces and the observations of the session.
- `sourceLink` is `<baseUrl>/project/<projectId>/sessions/<sessionId>`.

The stage counts the observations without a `sessionId` in
`sessionlessObservations` and `sessionlessTraces`. The stage creates no session
for these observations.

### Filters and budgets

- `--environment` is a server filter.
- `--harness` is a local filter on the derived `harness`.
  `excludedByHarness` counts the sessions that the filter removes.
- `--max-sessions` stops the read when the pages hold more sessions than the
  budget. The stage keeps the first sessions in page order. The stage then
  reports `partial` with the cause `max-sessions` and exits 4.

### Outcomes

| Status | Exit | Condition |
|---|---|---|
| `complete` | 0 | The stage read each page, and at least one session remains |
| `partial` | 4 | `--max-sessions` stopped the read |
| `empty` | 3 | The stage read each page, and no session remains |
| `failed` | 1 | A read failed; the checkpoint cause is the adapter cause |

On a failure, the stage writes no `inventory.jsonl`, and
`completeness.inventory` holds `{ status, cause, message }` with no session
count. An empty corpus and a failed read never share one exit code.
