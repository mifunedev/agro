# Manual review: cli-credit-required

This transcript records the credit paths of `agro node create` and
`agro node check` against a local stub console. The stub source is
[`stub-console.mjs`](stub-console.mjs). The run date is 2026-11-15. The
branch is `e2/worker` at commit `c31f9fab`.

## Setup

1. Build the CLI:

   ```bash
   npm --prefix .agro/cli run build
   ```

   The build wrote `.agro/cli/dist/agro.js` (441.6 kB) and exited 0.

2. Make a new temp directory:

   ```bash
   mktemp -d /tmp/claude-1000/credit-review.XXXXXX
   ```

   The command printed `/tmp/claude-1000/credit-review.mZghtK`. The run copied
   the stub into that directory. The stub log files also went into that
   directory.

3. Confirm that no process listens on loopback port 3190:

   ```bash
   ss -ltnp | grep ':3190'
   ```

   The command printed nothing and `grep` exited 1. No process listened on
   the port.

4. For each case, start the stub in the background on `127.0.0.1:3190` with
   one scenario name, run one command, then stop the stub by its PID:

   ```bash
   node /tmp/claude-1000/credit-review.mZghtK/stub-console.mjs 3190 /tmp/claude-1000/credit-review.mZghtK/<scenario>.log <scenario> &
   ```

Each command passes `AGRO_CONSOLE_URL` and `AGRO_CONSOLE_TOKEN` inline. The
token `mfc_throwaway_review_token` is a throwaway value. `HOME` points to the
temp directory, so the CLI reads no real credentials file. The run wrote no env
file and no credentials file. `--ssh-key` names the key id that the stub lists,
so the CLI reads no `~/.ssh` file. The stub log shows the `Authorization`
header as `Bearer <redacted>`.

## Create: HTTP 402 CREDIT_REQUIRED, then eligible

Stub scenario: `402-eligible`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --spec n8 --ssh-key 00000000-0000-4000-8000-000000000001
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
agro node create: spec n8 is not in the free tier; creating n4
agro node create: node stub-node-1 queued
agro node create: node stub-node-1 running
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n8","sshKeyIds":["00000000-0000-4000-8000-000000000001"]} -> 402
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n4","sshKeyIds":["00000000-0000-4000-8000-000000000001"],"freeTier":true} -> 202
GET /api/nodes/stub-node-1 auth=Bearer <redacted> body=- -> 200
```

## Create: HTTP 402 CREDIT_REQUIRED, then not eligible

Stub scenario: `402-not-eligible`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --spec n8 --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 1.

stdout:

```text
(empty)
```

stderr:

```text
agro node create: top up credit at http://127.0.0.1:3190/billing
agro node create: HTTP 402 CREDIT_REQUIRED: Add credit to create a paid node.
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n8","sshKeyIds":["00000000-0000-4000-8000-000000000001"]} -> 402
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
```

## Create: HTTP 403 PAYMENTS_DISABLED, then eligible

Stub scenario: `403-eligible`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --spec n8 --ssh-key 00000000-0000-4000-8000-000000000001
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
agro node create: spec n8 is not in the free tier; creating n4
agro node create: node stub-node-1 queued
agro node create: node stub-node-1 running
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n8","sshKeyIds":["00000000-0000-4000-8000-000000000001"]} -> 403
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n4","sshKeyIds":["00000000-0000-4000-8000-000000000001"],"freeTier":true} -> 202
GET /api/nodes/stub-node-1 auth=Bearer <redacted> body=- -> 200
```

## Create: HTTP 402 CREDIT_REQUIRED, then a failed n4 retry

Stub scenario: `failed-retry`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node create --spec n8 --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 1.

stdout:

```text
(empty)
```

stderr:

```text
agro node create: spec n8 is not in the free tier; creating n4
agro node create: top up credit at http://127.0.0.1:3190/billing
agro node create: HTTP 403 FREE_TIER_INELIGIBLE: a free node is live
```

Requests that the stub received:

```text
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n8","sshKeyIds":["00000000-0000-4000-8000-000000000001"]} -> 402
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
POST /api/nodes auth=Bearer <redacted> body={"profile":"sandbox","spec":"n4","sshKeyIds":["00000000-0000-4000-8000-000000000001"],"freeTier":true} -> 403
```

## Check: payments are off

Stub scenario: `payments-off`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
ok credit: payments are off
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 200
```

## Check: balance above 0

Stub scenario: `balance-positive`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
ok credit: balance $12.35
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 200
```

## Check: balance above 0, auto top-up on

Stub scenario: `balance-positive-auto-topup`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
ok credit: balance $12.35, auto top-up on
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 200
```

## Check: balance 0, auto top-up off

Stub scenario: `balance-zero`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
warn credit: no credit (balance $0.00) — top up at http://127.0.0.1:3190/billing
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 200
```

## Check: balance below 0, auto top-up on

Stub scenario: `balance-negative-auto-topup`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
ok credit: balance -$0.04, auto top-up on
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 200
```

## Check: a console without the balance route

Stub scenario: `balance-404`.

```bash
HOME=/tmp/claude-1000/credit-review.mZghtK AGRO_CONSOLE_URL=http://127.0.0.1:3190 AGRO_CONSOLE_TOKEN=mfc_throwaway_review_token node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-4000-8000-000000000001
```

Exit status: 0.

stdout:

```text
ok ssh-key 00000000-0000-4000-8000-000000000001
ok free-tier
warn credit: HTTP 404 NOT_FOUND: Not found
```

stderr:

```text
(empty)
```

Requests that the stub received:

```text
GET /api/ssh-keys auth=Bearer <redacted> body=- -> 200
GET /api/free-tier auth=Bearer <redacted> body=- -> 200
GET /api/billing/balance auth=Bearer <redacted> body=- -> 404
```

## Cleanup

After the last case, `ss -ltnp | grep ':3190'` printed nothing and `grep`
exited 1. The run stopped only the stub PIDs that it started. The run deleted
`/tmp/claude-1000/credit-review.mZghtK` after it copied the transcript here.

## Live run against agro-console (external criterion)

Date: 2026-11-15 (UTC). CLI: `@mifune/agro@0.39.0` from npm, installed with
`npm install --prefix <throwaway dir>` on `agro-sbx-dev-001`. The harness
checkout did not change. Console: the operator dev stack of agro-console on
`http://127.0.0.1:3005`, at `development` `a1f08900`, with `payments: false`.
The operator approved live spend on 2026-11-15, with at most one live node at
a time. This run created no node.

Setup:

1. Sign in to the dev console as `dev@agro.local` with the dev credentials
   provider over loopback.
2. Create two throwaway API tokens with `POST /api/tokens`, one in each org
   context: `proof-p-cli-acme-inc` (`mfc_NCvp6EOF…`, org `Acme, Inc`, a team
   org without billing exemption and without free-tier eligibility) and
   `proof-p-cli-admin` (`mfc_CvkBz79Y…`, the billing-exempt org `Admin`).
3. Register one throwaway public key in each org: `40a55449-…` in Acme and
   `11a917f4-…` in Admin.

Each command passes `HOME=<throwaway dir>/home`,
`AGRO_CONSOLE_URL=http://127.0.0.1:3005`, and `AGRO_CONSOLE_TOKEN=<redacted>`
inline. The run wrote no env file and no credentials file.

Transcript (the bracket names the org of the token):

```text
2026-11-15T18:04:32Z
$ agro node check  [org token: acme-inc]
fail ssh-key: no --ssh-key given and ~/.ssh/id_ed25519.pub not found — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>
warn free-tier: not eligible — the n4 fallback needs free tier eligibility; run agro auth login in the personal context
ok credit: payments are off
exit: 1

$ agro node check --ssh-key 11a917f4-de23-44dd-9e3f-5b689a980bb2  [org token: admin]
ok ssh-key 11a917f4-de23-44dd-9e3f-5b689a980bb2
warn free-tier: not eligible — the n4 fallback needs free tier eligibility; run agro auth login in the personal context
ok credit: payments are off
exit: 0

2026-11-15T18:04:53Z
$ agro node create --spec n8 --ssh-key 40a55449-cdaf-4273-9d85-7738359e6498  [org token: acme-inc]
agro node create: top up credit at http://127.0.0.1:3005/billing
agro node create: HTTP 403 PAYMENTS_DISABLED: Payments are not available yet. Use the free tier.
exit: 1

$ agro node list  [org token: acme-inc]
no nodes
exit: 0

$ agro node check --ssh-key 40a55449-cdaf-4273-9d85-7738359e6498  [org token: acme-inc]
ok ssh-key 40a55449-cdaf-4273-9d85-7738359e6498
warn free-tier: not eligible — the n4 fallback needs free tier eligibility; run agro auth login in the personal context
ok credit: payments are off
exit: 0
```

The first `node check` failed only on the SSH key line, because the throwaway
`HOME` has no `~/.ssh/id_ed25519.pub`. An earlier `node create --spec n8`
without `--ssh-key` stopped on the same local key check before any request.
The run then registered the Acme key and ran the create again.

Result:

- `agro node check` prints the credit line `ok credit: payments are off` in
  both orgs and sends only GET requests.
- `agro node create --spec n8` gets HTTP 403 `PAYMENTS_DISABLED`, reads the
  free tier as not eligible, prints the top-up line, and exits 1. `agro node
  list` shows no node, so the refusal created nothing.

Cleanup: see the cleanup section of
[`../../cli-disposable-hands/evidence/manual-review.md`](../../cli-disposable-hands/evidence/manual-review.md#live-run-cleanup).
The two runs share the tokens, the keys, and the throwaway directory.
