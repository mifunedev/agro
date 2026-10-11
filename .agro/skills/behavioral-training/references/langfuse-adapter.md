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
  The runner receives `(command, args, { env })` and returns
  `{ exitCode, stdout, stderr }`.

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
adapter never calls `traces list` or `traces get`. The adapter never writes to
Langfuse. US-008 adds the write operations of `publish --apply`.

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
`client.listSessionObservations(sessionId, { cursor })`, and
`client.listScores(query, { cursor })` read one page. Each method returns
`{ items, cursor }`. `cursor` is `null` on the last page. Each method uses the
same retries and the same redaction.

- `listObservations` requests the field groups `core`, `basic`, `model`,
  `usage`, and `trace_context`. The method never requests `io` or `metadata`.
- `listObservations` sends `--from-start-time`, `--to-start-time`, and
  `--environment` from the query. The page size is 1000.
- `listSessionObservations` sends `--session-id` and requests the field groups
  in `CONTENT_FIELDS`: `core`, `basic`, `time`, `io`, `metadata`, `model`,
  `usage`, `metrics`, and `trace_context`. The page size is 100. The method
  sends no window filter.
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
- The adapter does not send `--expand-metadata`. The API truncates each
  metadata value above 200 characters and documents no truncation marker.
  `normalize` therefore never treats a metadata value as complete.

## Errors

Each failure is a `LangfuseError`. `error.cause` is one cause code.
`error.message` is a short redacted message.

| Cause | Condition |
|---|---|
| `missing-credentials` | The CLI exits with code 3 on an API call |
| `forbidden` | HTTP 401 or HTTP 403 |
| `incompatible-endpoint` | HTTP 404, a required operation is missing, or `api schema` finds no compatible contract |
| `unreachable` | The CLI exits with code 4 |
| `http-error` | Another HTTP status, or HTTP 429 or 5xx after the last retry |
| `bad-response` | The output is not JSON, has no envelope, or has an unexpected shape |
| `ambiguous-project` | The key sees more than one project |
| `unsupported-operation` | The call names an operation outside the read list, or a content read has no session id |
| `cli-unavailable` | `npx` cannot start the CLI |
| `cli-failed` | The CLI exits with another code |
| `bad-config` | `agro.json` is not valid JSON |

## Retries

- The adapter retries HTTP 429 and HTTP 500 to 599.
- The adapter retries one call at most 3 times. The waits are 1000 ms,
  2000 ms, and 4000 ms.
- The adapter never retries HTTP 401, HTTP 403, or CLI exit code 3.
- The adapter does not retry exit code 4. The stage saves the cursor, so
  `--resume` continues after a network failure.

## Redaction

The adapter applies `redact()` to each message before the message leaves the
adapter. `redact()` replaces these values with `<redacted>`:

- each substring that starts with `pk-lf-` or `sk-lf-`;
- the value after `Basic` or `Bearer`;
- the value after `LANGFUSE_PUBLIC_KEY=` or `LANGFUSE_SECRET_KEY=`.

An error message holds the operation, the cause, the HTTP status or the CLI
exit code, and at most 300 characters of redacted CLI output. An error message
never holds a response body.

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
