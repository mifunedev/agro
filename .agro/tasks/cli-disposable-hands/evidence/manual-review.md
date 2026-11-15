# Manual review: cli-disposable-hands

This transcript records the disposable paths of `agro node create` and
`agro hands` against a local stub console. The stub source is
[`stub-console.mjs`](stub-console.mjs). The run date is 2026-11-15. The
branch is `e3/worker` at commit `484984ab`.

## Setup

1. Build the CLI:

   ```bash
   npm --prefix .agro/cli run build
   ```

   The build wrote `.agro/cli/dist/agro.js` (443.9 kB) and exited 0.

2. Make a new temp directory:

   ```bash
   mktemp -d /tmp/claude-1000/disposable-review.XXXXXX
   ```

   The command printed `/tmp/claude-1000/disposable-review.7e02OZ`. The run
   copied the stub into that directory. The stub log also went into that
   directory.

3. Confirm that no process listens on loopback port 3191:

   ```bash
   ss -ltnp | grep ':3191'
   ```

   The command printed nothing and `grep` exited 1. No process listened on
   the port.

4. Start the stub in the background on `127.0.0.1:3191`:

   ```bash
   node /tmp/claude-1000/disposable-review.7e02OZ/stub-console.mjs 3191 /tmp/claude-1000/disposable-review.7e02OZ/stub.log &
   ```

   The stub answers `POST /api/nodes` with HTTP 202 and a queued node. When
   the body has `"profile": "agro"` and `"disposable": true`, the stub
   answers HTTP 422 `DISPOSABLE_PROFILE_UNSUPPORTED`. The stub answers
   `POST /api/nodes/<id>/pause`, `resume`, and `fork` with HTTP 409
   `NODE_DISPOSABLE`. The stub knows the node by the id `stub-node-1` and by
   the index `7`.

Each command passes `HOME`, `AGRO_CONSOLE_URL`, and `AGRO_CONSOLE_TOKEN`
inline. The `agro node` token `mfc_throwaway_review_token` and the
`agro hands` token `brn_throwaway_review_token` are throwaway values.
`agro hands` reads `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL` before the brain
token file and the brain URL file, so the run wrote no brain token file and no
brain URL file. `HOME` points to the temp directory. The temp directory has no
host config, so `hands.provider` resolves to the default `console`. The CLI
reads no real credentials file. The run wrote no env file and no credentials
file. `--ssh-key` names the key id that the stub lists, so the CLI reads no
`~/.ssh` file. The stub log shows the `Authorization` header as
`Bearer <redacted>`.

## node create --disposable

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --disposable --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
id: stub-node-1
status: running
spec: n4
ssh sandbox@192.0.2.10
```

stderr:

```text
agro node create: node stub-node-1 queued
agro node create: node stub-node-1 running
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n4","sshKeyIds":["00000000-0000-4000-8000-000000000001"],"disposable":true} -> 202
GET /api/nodes/stub-node-1 auth=Bearer <redacted> body=- -> 200
```

## node create --profile agro --disposable

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --profile agro --disposable --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 1.

stdout: empty.

stderr:

```text
agro node create: only a sandbox node can be disposable: drop --disposable, or use --profile sandbox
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"agro","spec":"n4","sshKeyIds":["00000000-0000-4000-8000-000000000001"],"disposable":true} -> 422
```

The CLI sent the request. The stub console refused the request.

## hands create --disposable

This command creates the disposable hand that the next three commands use.

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=brn_throwaway_review_token node .agro/cli/dist/agro.js hands create --name worker --disposable
```

Exit status: 0.

stdout:

```text
index: 7
alias: calm-lynx
ssh host: hand-7.example
```

stderr:

```text
agro hands create: hand stub-node-1 queued
agro hands create: hand stub-node-1 running
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","name":"worker","disposable":true} -> 202
GET /api/nodes/stub-node-1 auth=Bearer <redacted> body=- -> 200
```

## hands pause

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=brn_throwaway_review_token node .agro/cli/dist/agro.js hands pause 7
```

Exit status: 1.

stdout: empty.

stderr:

```text
agro hands pause: hand 7 is disposable and cannot pause: delete it with agro hands destroy 7
```

Requests that the stub received:

```text
POST /api/nodes/7/pause auth=Bearer <redacted> body=- -> 409
```

## hands resume

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=brn_throwaway_review_token node .agro/cli/dist/agro.js hands resume 7
```

Exit status: 1.

stdout: empty.

stderr:

```text
agro hands resume: hand 7 is disposable and cannot resume: delete it with agro hands destroy 7
```

Requests that the stub received:

```text
POST /api/nodes/7/resume auth=Bearer <redacted> body=- -> 409
```

An earlier run of `hands resume calm-lynx` got HTTP 404 `NOT_FOUND`, because
the stub routes only `stub-node-1` and `7`. That run printed
`agro hands resume: HTTP 404 NOT_FOUND: Not found` and exited 1. The run above
uses the index `7` and keeps the stub source unchanged.

## hands fork

```bash
HOME=/tmp/claude-1000/disposable-review.7e02OZ AGRO_CONSOLE_URL=http://127.0.0.1:3191 AGRO_CONSOLE_TOKEN=brn_throwaway_review_token node .agro/cli/dist/agro.js hands fork 7
```

Exit status: 1.

stdout: empty.

stderr:

```text
agro hands fork: hand 7 is disposable and cannot fork: delete it with agro hands destroy 7
```

Requests that the stub received:

```text
GET /api/nodes/7 auth=Bearer <redacted> body=- -> 200
POST /api/nodes/7/fork auth=Bearer <redacted> body={"spec":"n4"} -> 409
```

The fork request has no `disposable` field. The stub console refused the fork
of the disposable hand.

## Cleanup

The run stopped only the stub process that it started. After the stop,
`ss -ltnp | grep ':3191'` printed nothing and `grep` exited 1. The run deleted
`/tmp/claude-1000/disposable-review.7e02OZ` with `rm -r` on that exact path.
The temp directory held no file other than the stub copy, the stub log, and
the captured output.
