## Manual review

Paths are relative to `.agro/tasks/h-claim-performance-spike/evidence/`. The observed results come from the run on 2026-11-05 (run log `runs/e1-h-agro-20261105T005514Z.log`).

**A. Recompute the verdict from the run records**

Prerequisites: a checkout of the task branch. Runs on the host or in the sandbox, local. Needs no console and no network.

1. Print the E1, E2, and E3 lines:

   ```bash
   python3 -I .agro/tasks/h-claim-performance-spike/evidence/verdict.py | grep -E '^E1|^E2|^E3'
   ```

   Expected output:

   ```text
   E1: FAIL H (h agro FAIL median=33.4 p90=39.4 n=10; h sandbox PENDING) | reference nprime agro FAIL median=15.0 p90=19.1 n=5
   E2: PASS (H extra entries=2 allowed=gh,libatomic1, H agro files beyond floor=0, noise floor=14)
   E3: PASS (H agro parity holds in every run)
   ```

   Expected exit status: 0. The N′ line shows FAIL only because the reference has n=5, below the minimum of 10. Its median is the reference value.

2. Print the step tables:

   ```bash
   python3 -I .agro/tasks/h-claim-performance-spike/evidence/verdict.py --steps
   ```

   Expected output contains `runs levers stream:1,apt:0,archive:A1: n=10 usable_median=33.4 usable_p90=39.4` and the row `stream 11.2 10`. Expected exit status: 0.

**B. One H claim with the final lever set**

Prerequisites:

- The local dev console at `http://127.0.0.1:3006` runs agro-console branch `task/1559-h-sandbox-pool-packages` (mifunedev/agro-console#680). `AGRO_CONSOLE_CONFIG` names a file with `features.sandboxPoolPackages: true` and a `sandbox` n4 pool of 1. The provisioner runs with `PROVISIONER_EGRESS_IP` set to the current egress IP.
- The operator signs in `agro` to that console. `agro node list --json` shows 0 live nodes, and one `sandbox` n4 node has the status `pooled`.
- `archives.json` pins A1, and `<scratchpad>/h-url-A1` holds a presigned GET URL for the A1 object (mode 0600). The task deleted its R2 objects at cleanup. Cut and upload A1 again with `l2a/cut-variants.sh` before this step.

Runs in the sandbox, local, against a free-tier node.

1. Run one claim:

   ```bash
   cd .agro/tasks/h-claim-performance-spike/evidence
   H_STREAM=1 H_ARCHIVE=A1 PIN_AGRO_VERSION=0.28.0 AGRO_CONSOLE_URL=http://127.0.0.1:3006 bash driver.sh e1 h agro --docker --label review
   ```

   Observed output, trimmed (node `5aa7a2bb`):

   ```text
   CLAIM_START 1793840116290 (+0.386s)
   SSH ip=40.160.98.197 +6.822s
   local start ... bytes=272625840 docker=on levers=stream:1,apt:0,archive:A1
   remote step=fetch elapsed_ms=9689 result=ok mode=stream bytes=272625840
   remote step=verify elapsed_ms=9693 result=ok mode=stream sha256=a03b96e8...
   remote step=extract elapsed_ms=10366 result=ok mode=stream kept_existing=/usr/local/bin/zmx,...
   remote step=install elapsed_ms=10863 result=ok apt_added=none apt=skipped apt_ms=3
   remote step=docker elapsed_ms=16081 result=ok docker=on
   remote step=apps-up elapsed_ms=23128 result=ok workspace_harness=yes code_server=200 t3=200
   USABLE +32.178s
   DELETED 5aa7a2bb-4eca-4ec2-b637-d0b9f20e14e8 status=destroyed
   RESULT {... "levers":"stream:1,apt:0,archive:A1", ... "usable_s":32.178,"valid":true,"invalid_reason":null,"failed":false}
   ```

   Expected exit status: 0. The run record `runs/e1-h-agro-<UTC stamp>.json` has `"parity":{"usable":true,"claim_ack":true,"docker_on":true}`.

2. Failure path. Run the driver with the unknown archive variant `A2`:

   ```bash
   H_ARCHIVE=A2 PIN_AGRO_VERSION=0.28.0 bash driver.sh e1 h agro --docker
   ```

   Expected output: `driver: H_STREAM and H_PARALLEL_APT must be 0 or 1, H_ARCHIVE must be A0 or A1`. Expected exit status: 2. The driver creates no node.

**C. Cleanup**

1. The driver deletes its node on exit. Confirm:

   ```bash
   AGRO_CONSOLE_URL=http://127.0.0.1:3006 agro node list --json | jq '[.[] | select(.status != "destroyed")] | length'
   ```

   Expected output: `0`. Expected exit status: 0.

2. Delete the A1 object that the prerequisites of scenario B uploaded.
3. Delete `<scratchpad>/h-url-A1`.
