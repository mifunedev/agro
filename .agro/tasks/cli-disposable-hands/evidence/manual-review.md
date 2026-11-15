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

## Live run against agro-console (external criterion)

Date: 2026-11-15 (UTC). CLI: `@mifune/agro@0.39.0` from npm, installed with
`npm install --prefix <throwaway dir>` on `agro-sbx-dev-001`. The harness
checkout did not change. Console: the operator dev stack of agro-console on
`http://127.0.0.1:3005`, at `development` `a1f08900`, with `payments: false`.
The operator approved live spend on 2026-11-15, with at most one live node at
a time and each node deleted after its proof. This run created one node.

The token is the throwaway API token `proof-p-cli-admin` (`mfc_CvkBz79Y…`).
It belongs to the dev account in the billing-exempt org `Admin`. The SSH key
`11a917f4-…` is a throwaway public key registered in that org. Each command
passes `HOME=<throwaway dir>/home`, `AGRO_CONSOLE_URL=http://127.0.0.1:3005`,
and `AGRO_CONSOLE_TOKEN=<redacted>` inline. The run wrote no env file and no
credentials file. The CLI read no brain token file.

Transcript:

```text
2026-11-15T18:05:06Z
$ agro node create --profile sandbox --disposable --ssh-key 11a917f4-de23-44dd-9e3f-5b689a980bb2 --name proof-p-cli5-disposable --json
agro node create: node 04869d43-4e72-475b-94b1-5b05f2e8aa62 queued
agro node create: node 04869d43-4e72-475b-94b1-5b05f2e8aa62 bootstrapping
agro node create: node 04869d43-4e72-475b-94b1-5b05f2e8aa62 running
{"id":"04869d43-4e72-475b-94b1-5b05f2e8aa62","status":"running","spec":"n4","ssh":"ssh sandbox@135.148.235.38"}
exit: 0
2026-11-15T18:05:13Z

2026-11-15T18:05:19Z
$ agro hands pause 04869d43-4e72-475b-94b1-5b05f2e8aa62
agro hands pause: hand 04869d43-4e72-475b-94b1-5b05f2e8aa62 is disposable and cannot pause: delete it with agro hands destroy 04869d43-4e72-475b-94b1-5b05f2e8aa62
exit: 1

$ agro hands list
INDEX  ALIAS                  STATUS     SPEC  SSH HOST
#2     civil-moss-nma7wz      destroyed  n2    -
#1     curious-meadow-lnkg90  destroyed  n2    -
#3     placid-mesa-u22vdm     running    n4    ssh-placid-mesa-u22vdm.mifune.io
exit: 0

2026-11-15T18:05:38Z
$ agro node delete 04869d43-4e72-475b-94b1-5b05f2e8aa62 --yes
deleted 04869d43-4e72-475b-94b1-5b05f2e8aa62
exit: 0
```

`GET /api/nodes/04869d43-…` after the create returned `profile: sandbox` and
`disposable: true`. The create bound the warm `n4` pool VM `04869d43` in 7 s.
The `#1` and `#2` rows of `hands list` are the destroyed `n2` hands of the
agro-console US-008 timing run, not of this run.

The pause line comes only from an HTTP 409 `NODE_DISPOSABLE` reply:
`.agro/cli/src/lib/hands/console-provider.ts` (v0.39.0, line 30) maps
`result.status === 409 && result.code === "NODE_DISPOSABLE"` to that line.

OVH listing (untracked read-only script, `GET` instance and volume lists only):

| Time (UTC) | Observation |
|---|---|
| 18:05:25 | instance `abc66dd2` `ACTIVE`; boot volume `dfd36472` 12 GB `in-use`; the pool data volume `4be2fea4` 50 GB `available`, detached. The provisioner logged `volume 4be2fea4-… delete deferred: disposable node 04869d43-… keeps no data volume of its pool VM`. |
| 18:05:55 | node `destroyed` |
| 18:06:02 | instance and boot volume gone; `4be2fea4` still `available` (deferred delete, 5 min retry) |
| 18:11:30 | no instance and no volume of `04869d43` |

## Live run cleanup

This cleanup also covers the live run of `cli-credit-required`.

1. At 18:11:45Z, `DELETE /api/tokens/<id>` revoked `proof-p-cli-acme-inc`
   and `proof-p-cli-admin` (HTTP 200 each). The token list shows each with
   `revokedAt` set.
2. `DELETE /api/ssh-keys/<id>` removed the throwaway keys from Admin and Acme
   (HTTP 200 each). Both orgs then listed no SSH key.
3. `GET /api/admin/nodes` listed no live node outside the pool.
4. At 18:12:03Z, the full OVH listing held no resource of either run. The
   listing held two pool VMs, `48e60a4b` (`n4`) and `6970aef3` (`n2`), plus golden volumes
   and two unattached data volumes that map to no dev node. Dev and production
   share one OVH project.
5. The run deleted its throwaway directory: the npm prefix, the temp `HOME`,
   the token files, and the throwaway key pair.
