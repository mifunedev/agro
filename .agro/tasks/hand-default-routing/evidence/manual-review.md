# US-004 manual review — live routing transcript

Run on 2026-11-14 between 22:06:56Z and 22:09:12Z with the installed `agro` 0.37.0.
Every command ran on the host, brain VM `agro-supervisor` (`hands.provider=exedev`, Docker enabled), from
`/home/exedev/.agro/workspaces/harness` unless a step names another directory.
The project `ryaneggz/microsandbox-ubuntu-dind` is at `c19cb73` on the hand and on the brain.
The check covers `ensure-sandbox.sh`, `entrypoint.sh`, `install-host.sh`, and `sandbox.sh`.
The run created, forked, destroyed, and tagged no VM. The operator approved the pause and the resume of `agro-sbx-dev-001`.

**Setup**

Prerequisites: `agro` 0.37.0 on the brain, an exe.dev SSH key, and the hand `agro-sbx-dev-001` on exe.dev.
Location: host (brain), remote exe.dev API.

0. Record the VM list before the run:

   ```bash
   ssh exe.dev ls --json   # reduced with python3 -I to vm_name, status, tags
   ```

   Output:

   ```json
   [{"vm_name": "agro-sbx-dev-001", "status": "running", "tags": ["agro-hand"]}, {"vm_name": "agro-supervisor", "status": "running", "tags": null}]
   ```

   Exit status: 0.

**A. Gate**

1. Confirm that the hand runs before any write:

   ```bash
   agro hands list --json
   ```

   Output: `[{"name":"agro-sbx-dev-001","status":"running","sshHost":"agro-sbx-dev-001.exe.xyz"}]`. Exit status: 0.

**B. Running hand: the hand branch**

Prerequisites: the gate in step A1 shows `running`. Location: remote, hand `agro-sbx-dev-001`.

1. Run the committed check through `agro run` on the hand:

   ```bash
   agro hands exec agro-sbx-dev-001 --project ryaneggz/microsandbox-ubuntu-dind -- agro run -- sh -c 'for f in *.sh; do bash -n "$f" || exit 1; done'
   ```

   Output at 22:07:00Z (the first run on the hand pulled the sandbox image):

   ```text
   b001f2794f4a: Pull complete
   Digest: sha256:25a438b1b9fa9a52635a1d8e50176bf97035ec7f8a5f68f9fb1c530cf417233f
   Status: Downloaded newer image for ghcr.io/mifunedev/agro:0.37.0
   ```

   Exit status: 0. The second run at 22:08:01Z printed no output. Exit status: 0.

**C. Paused hand: the local branch**

1. Pause the hand:

   ```bash
   agro hands pause agro-sbx-dev-001
   ```

   Output: `paused agro-sbx-dev-001`. Exit status: 0.

2. Confirm the paused status:

   ```bash
   agro hands list --json
   ```

   Output: `[{"name":"agro-sbx-dev-001","status":"paused","sshHost":"agro-sbx-dev-001.exe.xyz"}]`. Exit status: 0.

3. Run the same check through local Docker in the brain project.
   Location: host (brain), `/home/exedev/.agro/workspaces/harness/projects/ryaneggz/microsandbox-ubuntu-dind` at `c19cb73`.

   ```bash
   agro run -- sh -c 'for f in *.sh; do bash -n "$f" || exit 1; done'
   ```

   Output at 22:08:15Z: none. Exit status: 0.

4. Resume the hand at 22:08:20Z:

   ```bash
   agro hands resume agro-sbx-dev-001
   ```

   Output: `resumed agro-sbx-dev-001`. Exit status: 0.

5. Poll until the hand runs and accepts a command:

   ```bash
   agro hands list --json
   agro hands exec agro-sbx-dev-001 -- true
   ```

   Output at +5 s: `[{"name":"agro-sbx-dev-001","status":"running","sshHost":"agro-sbx-dev-001.exe.xyz"}]`.
   `agro hands exec agro-sbx-dev-001 -- true` at +6 s: exit status 0.

**D. Console tunnel reconnect**

Prerequisites: the tmux session `agro-console-tunnel` runs on the brain. Nobody restarted or killed it.
`tmux ls` shows `agro-console-tunnel: 1 windows (created Sat Nov 14 19:10:50 2026)`, before the run started.

1. Poll the console sign-in status every 5 s after the resume:

   ```bash
   agro auth status
   ```

   Output from 22:08:26Z to 22:08:50Z (six attempts): `agro auth status: request failed: fetch failed`. Exit status: 1.
   Output at 22:08:55Z, about 35 s after the resume:

   ```text
   url: http://127.0.0.1:3005
   login: dev
   role: admin
   source: file
   ```

   Exit status: 0.

**E. Failure path**

1. Run a command on a VM that does not exist:

   ```bash
   agro hands exec no-such-vm -- true
   ```

   Output: `agro hands exec: no exe.dev VM named no-such-vm`. Exit status: 1.

**F. Cleanup and final state**

The run created no resource. Step C4 resumed the hand that step C1 paused.

1. Record the VM list after the run:

   ```bash
   ssh exe.dev ls --json   # reduced with python3 -I to vm_name, status, tags
   ```

   Output:

   ```json
   [{"vm_name": "agro-sbx-dev-001", "status": "running", "tags": ["agro-hand"]}, {"vm_name": "agro-supervisor", "status": "running", "tags": null}]
   ```

   Exit status: 0. `cmp` of the reduced lists from step 0 and step F1 reports no difference.
