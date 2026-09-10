# US-007a — Observed local lifecycle matrix

Raw command transcript: `local-lifecycle-transcript.log` (same directory).

This story could not be discharged by a unit suite, and it was not. Every
verdict below cites observed filesystem, process, unit or container state on a
real Linux host running systemd as PID 1 with its own Docker daemon. No mock,
fixture or status field is used as evidence of readiness anywhere in this
document.

---

## 0. Readiness oracle

`openharness-bootstrap.service` is `Type=oneshot` with `RemainAfterExit=yes`,
so `systemctl is-active` returning `active` is a COMPLETION proof and `failed`
is a FAILURE proof. Observed directly on the unit under test:

```
Type=oneshot
RemainAfterExit=yes
Result=success
ExecMainStatus=0
ActiveState=active
SubState=exited
```

The oracle was seen to distinguish all three states during this run —
`activating` while the entrypoint was still executing, then `active` on
success, and `failed` on the published image (section 8). Container liveness
was observed to prove nothing: the published image's container reported
`Up 5 seconds (health: starting)` at the same moment its bootstrap unit
reported `ActiveState=failed`.

---

## 1. Artifacts under test — ALL CANDIDATES

Every result in this document was produced with locally built artifacts. None
of them is a published release, and none of them repairs, supersedes or
substitutes for one.

| Artifact | Identity | Provenance |
| --- | --- | --- |
| **CANDIDATE sandbox image** | `agro-candidate:us007a`, `sha256:d963de3d2b25…`, built 2026-09-09T05:50:17Z | `docker build -f .devcontainer/Dockerfile .` from `/home/sandbox/harness`, branch `development`, commit `b10ecac3d17d21c7abb45a2e814617e6b9b5ae50`, `vitest ^4.1.11` |
| **CANDIDATE CLI** | `agro` 0.9.0 | `OH_ASSET_ROOT=<worktree> node build.mjs` in `.worktrees/bug/944-sandbox-install-idempotent` (branch `bug/944-sandbox-install-preserve-config`, commit `b10ecac3`, with the accepted `sandbox install` idempotency fix present as working-tree modifications to `.agro/cli/src/commands/sandbox.ts`) |
| **PUBLISHED image (contrast only)** | `ghcr.io/mifunedev/agro:latest`, `sha256:bbfdaf6bb8ca…`, created 2026-09-06T19:52:35Z | pulled; identical id to `ghcr.io/mifunedev/openharness:0.9.0` — the #1019 build |
| **PATH CLI (pre-existing, not used)** | `/usr/local/bin/oh` 0.7.0 | no `agro` binary on PATH; no `migrate` verb |

**Which results depend on candidate artifacts.** Sections 3, 4, 5, 6, 7 and 9
all ran against the candidate image and candidate CLI, and every PASS in them
must be re-run against the published patched image and published CLI before it
can be claimed of a released node. Section 8 is the only section that
exercises a published artifact, and it FAILS. Section 2 (bootstrap script
generation) and section 10 (the config-B defect) are structural findings in
accepted Cloud source and do not depend on the candidate substitution — see
the attribution note in section 10.

### The two candidate substitutions, stated plainly

1. **`install_agro()`** in the generated bootstrap script downloads
   `get-agro.sh` from the latest GitHub release. That function body — and only
   that body — was replaced with
   `install -D -m 0755 /opt/agro-candidate/agro.js "$HOME/.local/bin/agro"`.
   Every other line of the script is the generator's own output.
2. **`sandboxImage`** was passed as the candidate tag instead of the generator's
   default `ghcr.io/mifunedev/agro:latest`.

---

## 2. What was actually exercised, and how

The bootstrap script was **not** hand-written. It was emitted by the accepted
Cloud generator `buildWorkspaceBootstrapAssets()` from
`packages/shared/src/workspace-bootstrap-assets.ts` in
`projects/mifunedev/openharness-cloud/.worktrees/944-integrate2`, invoked with
`containerName: "oh-a"`, the cloud-config's git identity, and the two harness
configurations of section 9. The `ohmanage` and `ohproxy` SSH principals were
likewise emitted by `buildHostManagementAssets()` and `buildHostProxyAssets()`
from `packages/shared/src/host-management-assets.ts`, including the real
`MANAGEMENT_HELPER` used for the rebuild leg.

**The host.** A disposable Ubuntu 24.04 container, `--privileged
--cgroupns=host`, systemd as PID 1, its own `dockerd` on a dedicated ext4
volume, `sshd`, `tmux`, and a host-native code-server 4.129.0 (the pinned
version and sha256 from `code-server-assets.ts`). Observed on start:

```
systemctl is-system-running  ->  running
docker info                  ->  29.8.0 storage=overlayfs (later overlay2)
```

The node was then provisioned by replaying the accepted
`infra/cloud-init/cloud-config.yaml` — its `users:`, `write_files:`, `runcmd:`
and `codeServerRuncmd` blocks — verbatim, except that the package installation
and the code-server tarball download were pre-baked into the node image.

**Deviations from a real cloud node, disclosed.**

- The node is a privileged container, not a VM. cloud-init itself did not run;
  its blocks were replayed by a script.
- The node's `dockerd` was switched to the classic `overlay2` graph driver
  (`{"features":{"containerd-snapshotter":false}}`) because the containerd
  snapshotter could not extract the image inside this nesting:
  `failed to convert whiteout file "etc/alternatives/.wh.pager.1.gz":
  operation not permitted`. This is a nesting artifact of the test host, not a
  product behaviour.
- `openharness-register-runtime-settings` was not run — it posts to a live
  control plane that does not exist here.
- For the rebuild leg only, the candidate image was pushed to a
  `registry:2` on the node's loopback so that the helper's
  `AGRO_PULL_POLICY=always` had something genuine to pull. See section 5.

---

## 3. LEG 1 — FRESH — **PASS**

The bootstrap was launched exactly as the cloud-config `runcmd` line launches
it:

```
sudo -u sandbox -i tmux new-session -d -s docker-build-oh-sandbox \
  /usr/local/libexec/openharness-bootstrap-workspace
```

Observed result:

```
/home/sandbox/.openharness-bootstrap-status  ->  ok
/run/openharness-ready                       ->  -rw-r--r-- 1 root root 0
```

**Readiness asserted by the unit, not the container.** Inside `oh-a`:

```
Type=oneshot   RemainAfterExit=yes
Result=success ExecMainStatus=0
ActiveState=active  SubState=exited
ExecMainStartTimestamp = 2026-09-09 05:56:22 UTC
ExecMainExitTimestamp  = 2026-09-09 05:56:26 UTC
```

The boot was genuine, not a no-op — the journal shows the whole cold path:

```
[entrypoint] no checkout bind at /home/sandbox/harness — seeding from /opt/agro-seed
[entrypoint] seeded control plane into /home/sandbox/harness from /opt/agro-seed
[entrypoint] repairing sandbox home mount ownership as 1000:1000
[entrypoint] node_modules missing — running pnpm install at /home/sandbox/harness
[entrypoint] pnpm install completed (log: /tmp/pnpm-install.log)
Finished openharness-bootstrap.service - Open Harness sandbox bootstrap.
```

A second, independent FRESH run (section 9, config A control) reproduced
`status=ok`, the readiness marker, and `ActiveState=active Result=success`.

### FINDING 1 — the bootstrap's own `ok` is not a readiness proof

`status=ok` and `/run/openharness-ready` were written 0 seconds after
`agro sandbox install docker` returned, which is when Compose reported
`Container oh-a Started`. At that instant the container's bootstrap unit had
not finished. The script never consults `openharness-bootstrap.service`. The
node therefore signals ready on container *start*, not on sandbox *boot*. This
is benign for a config-A node only because nothing else in the script depends
on the boot having completed; section 10 shows what happens when something
does.

---

## 4. LEG 2 — LEGACY STATE — **PASS** (with one observed mutation)

Representative user state was seeded **first**, as the node's `sandbox` user,
into the persistent home mount (node `/home/sandbox/workspace`, which is the
sandbox container's `/home/sandbox`), and each item was verified by before /
after observation of sha256 + uid + gid + mode.

Seeded:

1. a real git checkout with an **uncommitted** modification and an untracked
   file (`projects/us007a-demo`);
2. a task folder (`.agro/tasks/us007a-user-task/notes.md`);
3. a `.env` at mode **0600**;
4. a gh-credential stand-in (`hosts.yml`, mode **0600**) under the workspace's
   gh configuration directory;
5. **OpenHarness-era `~/.openharness` checkout content** — `README.md` plus a
   `scripts/` subtree — which is the legacy checkout directory AGRO's compat
   layer probes as `LEGACY_CHECKOUT_DIR` (`.agro/cli/src/lib/compat.ts:40`);
6. a **legacy OpenHarness-era project**: a `.oh/` control directory and an
   `oh.json` beside it.

**Remains recoverable and operable.** After `agro restart oh-a` the container
rebooted and the unit re-ran on the new boot and completed:

```
container StartedAt = 2026-09-09T05:58:45Z   restartCount=0
ExecMainStartTimestamp = 2026-09-09 05:58:45 UTC
ExecMainExitTimestamp  = 2026-09-09 05:58:46 UTC
Result=success  ActiveState=active  SubState=exited
[entrypoint] dependencies current
```

The before/after diff of the state oracle was empty for every seeded item
except the one noted below, and the git working tree was intact:

```
 M tracked.txt
?? untracked.txt
86f48d1 us007a: baseline commit
```

**AGRO operates existing legacy project state.** Run against the seeded legacy
project, the candidate CLI read it and produced a plan:

```
agro migrate: plan for …/us007a-legacy-project
  rename  …/.oh      -> …/.agro
  rename  …/oh.json  -> …/agro.json
  noop    …/.claude/skills (link absent)
  …
status: ready
```

The `.openharness` content was also visible unchanged from inside the
container.

### FINDING 2 — the gh-credential stand-in is rewritten, but not lost

`hosts.yml` was the one seeded path whose sha256 changed across the first boot
(`ac438dc1…` → `fe64ca26…`). Investigated rather than assumed:

- mode preserved at **0600**, owner preserved at 1000:1000;
- the file gained gh's canonical `users:` sub-map — it was normalised by the
  `gh` CLI, not corrupted;
- the credential **value** was proved unchanged without printing it: the
  sha256 of every token value in the file equals the sha256 of the seeded
  value (`da5358c5…`, `match=YES` twice).

After that one normalisation the file was byte-stable across the restart, both
rebuilds and every later observation. Verdict: preserved, with a one-time
canonicalisation.

---

## 5. LEG 3 — REBUILD — **PASS**, with an important semantic caveat

The recycle was driven through the accepted path, not a re-implementation: the
real `MANAGEMENT_HELPER` installed as
`/usr/local/libexec/openharness-code-server-apply`, reached over the pinned
`ohmanage` forced-command SSH principal whose `authorized_keys` line was
emitted by `buildHostManagementAssets()`:

```
from="172.18.0.3/32",restrict,command="sudo -n /usr/local/libexec/openharness-code-server-apply" ssh-ed25519 … openharness-management
```

### Rebuild attempt 1 — install failure, correctly reported

```
$ ssh -i mgmt_key ohmanage@node 'sandbox rebuild --name oh-a'
version=1 mode=sandbox action=rebuild name=oh-a state=failed step=install
exit=65
```

Cause: the helper runs
`AGRO_PULL_POLICY=always … agro sandbox install docker --name oh-a --yes --image`,
and at that point the sandbox's configured image ref was a local-only tag that
no registry could serve. This is an artifact of the candidate substitution, not
a product defect — but two real observations came out of it:

- the helper's failure reporting is accurate and specific (`step=install`);
- **a failed rebuild leaves the node's sandbox stopped** (`oh-a Exited (0)`).
  There is no rollback; the node is left without a running sandbox.

Note also that the bare trailing `--image` is *correct*: `--image` is parsed as
a boolean meaning "image mode, keep the configured ref"
(`.agro/cli/src/commands/sandbox.ts:183-192`), which is what a rebuild wants.

### Rebuild attempt 2 — success, with observed state survival

The candidate image was pushed to a loopback `registry:2` on the node so the
`always` pull was genuine, and the sandbox was repointed at
`127.0.0.1:5000/agro-candidate:us007a`. Then:

```
version=1 mode=sandbox action=rebuild name=oh-a state=complete step=ready
exit=0
```

`step=ready` means the helper's own loop observed
`docker exec oh-a systemctl is-active openharness-bootstrap.service` return
`active` — the same oracle this story requires.

**Persistence proved by observation, not by the absence of `down -v`.**

| Observation | Before rebuild | After rebuild |
| --- | --- | --- |
| mount type/source/dest | `bind /home/sandbox/workspace -> /home/sandbox rw=true` | identical |
| durable root identity | `dev=bc inode=1486974 uid=1000 gid=1000 mode=755` | identical |
| all 9 seeded paths (sha256 + uid + gid + mode) | — | **`diff` produced no output** |
| git working tree | ` M tracked.txt` / `?? untracked.txt` / `86f48d1` | identical |
| container id | `6b749b6673ee…` | `6a82719b33c4…` (**changed**) |
| bootstrap unit on the new container | — | `active`, `Result=success`, started 06:06:05 |

The `.env` stayed at 0600 and the credential stand-in stayed at 0600 with its
value intact. Configuration also survived the recycle — `storage.homePath`,
`image.ref`, git identity and every other field were still present in
`agro.json` afterwards, which is the behaviour the accepted `sandbox install`
idempotency fix exists to provide.

### FINDING 3 — `sandbox rebuild` does not always recreate the container

A **second** rebuild, run with nothing changed, also reported
`state=complete step=ready` — but the container id was **unchanged**
(`6a82719b33c4…` both before and after), with only a new `StartedAt`
(06:08:12) and a fresh unit run. Compose started the existing stopped container
rather than recreating it, because the spec had not changed.

This matters for how the first rebuild's evidence should be read: the container
id changed there because the **image ref** changed as part of the setup, not
because `sandbox rebuild` guarantees recreation. `sandbox rebuild` is
"stop, pull, up" — it recreates only when the resolved Compose spec differs.
A rebuild intended to pick up a moved `:latest` tag will recreate; a rebuild
intended to reset a wedged container will not. Both report
`state=complete step=ready`.

---

## 6. LEG 4 — ATTACH, three surfaces, after a restart and after a rebuild

### (a) ssh + `tmux attach -t docker-build-oh-sandbox` — **FAIL**

| When | Observed |
| --- | --- |
| during bootstrap (t=1 of a polled run) | `docker-build-oh-sandbox: 1 windows (created Wed Sep 9 06:16:39 2026)` |
| after bootstrap finished (t=2) | `no server running on /tmp/tmux-1000/default` |
| after a restart | `tmux ls` → `no server running`; `tmux attach -t docker-build-oh-sandbox` → `no sessions`, exit 1 |
| after a rebuild | `tmux ls` → `no server running`; `tmux attach -t docker-build-oh-sandbox` → `no sessions`, exit 1 |

SSH itself works — the same command over the same connection returns the tmux
error, not a connection error.

### FINDING 4 — the `docker-build-oh-sandbox` session is not durable

`tmux new-session -d -s docker-build-oh-sandbox <script>` terminates the
session when the script exits, success or failure. The session exists only for
the few seconds the bootstrap is in flight. Nothing recreates it: a restart
does not, and the rebuild helper does not use tmux at all — it drives
`agro stop` / `agro sandbox install` through `runuser -l` directly.

The criterion for this leg is that a **re-attach lands on preserved state**.
Surface (a) cannot satisfy it, because after the bootstrap window there is
nothing to re-attach to. This is not a revoked-session case; `node.rebuild`'s
deliberate browser revocation does not apply here.

### (b) container attach / re-attach — **PASS** after restart and after rebuild

State was written from inside the container **before** each transition and read
back after it.

After the **restart**, `agro shell oh-a` on a real pty:

```
sandbox@6b749b6673ee:~/harness$ echo MARKER-READ=$(cat /home/sandbox/us007a-preattach.txt)
MARKER-READ=2026-09-09T05:58:16Z
WHOAMI=sandbox HOST=6b749b6673ee UID=1000
 M tracked.txt
?? untracked.txt
```

After the **rebuild**, the same script against the new container:

```
sandbox@6a82719b33c4:~/harness$ echo MARKER-READ=$(cat /home/sandbox/us007a-preattach.txt)
MARKER-READ=2026-09-09T05:58:16Z
WROTE=2026-09-09T06:06:42Z
WHOAMI=sandbox HOST=6a82719b33c4 UID=1000
 M tracked.txt
?? untracked.txt
```

A different container id, the same preserved state. `docker exec` re-attach
confirmed the same.

### FINDING 5 — `agro shell` needs a pty, and misreports why it failed

With piped stdin:

```
cannot attach stdin to a TTY-enabled container because stdin is not a terminal
container `oh-a` not running? start it with `oh sandbox install docker`
```

The container was running and healthy at that moment. The fallback message
names the wrong cause, and it still says `oh`, not `agro`.

### (c) real loopback code-server over a pinned SSH forward — **PASS** after restart and after rebuild

code-server 4.129.0 runs host-native on the node under
`openharness-code-server.service` as user `sandbox`, bound to loopback:

```
systemctl is-active openharness-code-server.service   ->  active
ss -H -ltn 'sport = :8080'  ->  LISTEN 0 511 127.0.0.1:8080 0.0.0.0:*
curl 127.0.0.1:8080/        ->  http=302
```

It was reached from a separate machine over the forward-only `ohproxy`
principal emitted by `buildHostProxyAssets()`:

```
from="172.18.0.3/32",restrict,port-forwarding,permitopen="127.0.0.1:8080" ssh-ed25519 … openharness-browser-gateway
ssh -N -L 18080:127.0.0.1:8080 ohproxy@node
curl 127.0.0.1:18080/  ->  http=302  redirect=…/?workspace=/home/sandbox/oh.code-workspace
curl 127.0.0.1:18080/healthz -> 200 {"status":"alive",…}
```

**The pin is real**, not merely configured: a forward to a different port on
the same principal was refused by sshd —
`channel 2: open failed: administratively prohibited: open failed`.

**The workspace root resolves to the path that holds durable user state.** The
`oh.code-workspace` the editor opens has exactly one folder,
`/home/sandbox/workspace`, whose identity is `dev=bc inode=1486974` — the same
device and inode as the bind **source** of the sandbox container's
`/home/sandbox`. Proved end to end by reading durable state *through* the
editor's own HTTP surface:

```
GET /vscode-remote-resource?path=/home/sandbox/workspace/us007a-attach-marker.txt
-> 2026-09-09T06:06:42Z          (written inside the POST-REBUILD container)

GET /vscode-remote-resource?path=…/us007a-demo/tracked.txt
-> committed line
   UNCOMMITTED EDIT do-not-lose  (the seeded uncommitted change)
```

The same forward and the same unit served this before and after the rebuild;
the unit was untouched by the container recycle (`NRestarts=0`,
`ExecMainStartTimestamp = 05:54:22`, still `active running` afterwards). The
node-side surface is what was tested — the control-plane session revocation
that `node.rebuild` performs first (`revokeNodeBrowserAccess`) was not in scope
and was not simulated.

---

## 7. LEG 5 — UID ALIGNMENT — **observed, and the flagged risk is REAL**

### The numbers, under the accepted cloud-config

```
node-host  id -u sandbox  ->  1000      node-host  id -g sandbox  ->  1000
container  id -u sandbox  ->  1000      container  id -g sandbox  ->  1000
```

They **align**. The cloud-config's `users:` list contains no `- default`, so
the distro default user is not created and `sandbox` takes uid 1000; the image
bakes `useradd -m -u 1000 … sandbox`. So on a node provisioned by this exact
cloud-config, attach surface (c) is not broken by the entrypoint's chown.

### FINDING 6 — the alignment is load-bearing, and nothing enforces it

The risk was tested directly rather than reasoned about. A second node-host
user at uid **1500** was given its own workspace directory, and a sandbox was
installed with that directory as its home mount:

```
BEFORE  /home/sandbox2/ws                 uid=1500 gid=1500 mode=755
        /home/sandbox2/ws/host-owned.txt  uid=1500 gid=1500 mode=644

readiness: attempt 1 (empty) -> attempt 2 activating -> attempt 3 active
[entrypoint] repairing sandbox home mount ownership as 1000:1000

AFTER   /home/sandbox2/ws                 uid=1000 gid=1000 mode=755
        /home/sandbox2/ws/host-owned.txt  uid=1000 gid=1000 mode=644

node-host uid 1500 append  -> Permission denied      HOST-WRITE=DENIED
node-host uid 1500 create  -> Permission denied      HOST-CREATE=DENIED
```

The container entrypoint chowns the whole host bind directory to the
container's uid, and the host-native user loses write access to its own
directory. On a real node that host-native user is `sandbox` — the user
`openharness-code-server.service` runs as — so attach surface (c) would be
broken outright: the editor could read the tree but not save into it.

The entrypoint does have a UID-sync path, but it is gated on a *checkout bind*
at `$OH_PROJECT_ROOT` (`.devcontainer/entrypoint.sh:168-197`). Cloud nodes run
image-only, with no checkout bind, so that path never fires and the
unconditional chown is what runs. The alignment holds today only because two
independent constants happen to both be 1000. Any node image where uid 1000 is
already taken — for example, any cloud-config that keeps `- default` and lets
the distro user hold 1000 — pushes `sandbox` to 1001 and breaks surface (c) on
first boot.

---

## 8. Contrast — the PUBLISHED image, same node, same oracle — **FAIL**

Run on the same node, with the same CLI and the same readiness oracle:

```
ref=ghcr.io/mifunedev/agro:latest  id=sha256:bbfdaf6bb8ca…  created=2026-09-06T19:52:35Z
ref=agro-candidate:us007a         id=sha256:d963de3d2b25…  created=2026-09-09T05:50:17Z

readiness: attempt 1 (empty) -> attempt 2 failed
Result=exit-code  ExecMainStatus=1  ActiveState=failed  SubState=failed

container liveness at that same moment:  oh-pub  Up 5 seconds (health: starting)

[entrypoint] node_modules missing — running pnpm install at /home/sandbox/harness
[entrypoint] pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot
openharness-bootstrap.service: Main process exited, code=exited, status=1/FAILURE
Failed to start openharness-bootstrap.service - Open Harness sandbox bootstrap.
```

This reproduces mifunedev/agro#1019 on the image the accepted Cloud generator
names by default (`DEFAULT_AGRO_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest"`),
and it is a live demonstration of why container liveness is not a readiness
proof: the container was up and "health: starting" while the boot inside it had
already failed. It is also the reason every PASS above needed a candidate
image, and the reason every PASS above must be re-run against the published
patched image before it can be claimed of a released node.

---

## 9. The default-harness parameter — a TEST INPUT, not a product decision

Whether new Cloud nodes install `claude-code`, `codex` and `pi` by default is
an **open operator decision**. Nothing here decides it and no product default
was changed. It was parameterised as a test input and both configurations were
run and are reported separately.

Note on ids: the correct AGRO catalog id is **`pi`**. Confirmed from the
catalog (`claude-code, codex, pi, opencode, grok-build, hermes, muse-code,
t3code`) and by the CLI rejecting the wrong one:

```
$ agro harness install pi-coding-agent
oh harness: unknown harness "pi-coding-agent"
```

(The npm package behind it is `@earendil-works/pi-coding-agent`, which is where
the confusion comes from; the catalog id is `pi`.)

### Configuration A — no default harnesses

Generated with `harnesses: []`. The generator emitted **no** install lines and
no `cd` — byte-identical to a bare node.

- FRESH bootstrap: `status=ok`, `/run/openharness-ready` present, unit
  `active` / `Result=success`. Reproduced twice.
- Installed harness state on the resulting node — none:
  `claude-code no · codex no · pi no · opencode no · grok-build no · hermes no ·
  muse-code no · t3code no`.
- Everything in sections 3-7 was run in this configuration.

### Configuration B — one default harness, plus explicit installs

Generated with `harnesses: ["opencode"]`. The generator appended exactly:

```
cd "$AGRO_HOME/sandboxes/$sandbox_name" || fail "$?"
run_step agro harness install opencode
```

- **FRESH bootstrap FAILS.** See section 10. Two independent runs both gave
  `status=failed:243` and **no** `/run/openharness-ready`.
- **The explicit install path itself works**, when run against an already-ready
  sandbox. Both were installed and observed:
  `agro harness install pi` → `pi: installed`;
  `agro harness install opencode` → `opencode: installed`;
  `agro harness list` → `pi yes · opencode yes`.
- Both binaries land on the durable mount
  (`/home/sandbox/.local/bin/pi`, `/home/sandbox/.local/bin/opencode`) and
  **survived a subsequent rebuild** through the `ohmanage` path
  (`state=complete step=ready`, `agro harness list` still `pi yes · opencode
  yes`).

---

## 10. FINDING 7 (principal) — any node with a default harness fails to bootstrap

This is the most consequential observation of the run.

```
config B, run 1:  t=1 status=<no status yet>   t=2 status=failed:243
config B, run 2:  t=1 status=<none>            t=2 status=failed:243
config A control: t=1 status=<none>            t=2 status=ok
```

The only difference between the control and the failing runs is the presence of
the `run_step agro harness install opencode` line. Observed failure:

```
installing OpenCode into the sandbox…
npm error code EACCES
npm error syscall mkdir
npm error path /home/sandbox/.local/lib
npm error Error: EACCES: permission denied, mkdir '/home/sandbox/.local/lib'
oh harness: installing opencode failed (exit 243).
```

**Root cause — a race, proved, not inferred.** The bootstrap script runs
`agro sandbox install docker`, which returns as soon as Compose reports
`Container oh-a Started`, and then immediately runs `agro harness install`. At
that instant the container's bootstrap unit is still `activating` and the
entrypoint has not yet seeded `/home/sandbox` or repaired its ownership, so
`/home/sandbox/.local` is not yet writable by the container's `sandbox` user.

Timeline from the container journal and the npm log path, same run:

```
06:16:40  Starting openharness-bootstrap.service
06:16:40  [entrypoint] seeding from /opt/agro-seed
06:16:40  npm EACCES on /home/sandbox/.local/lib   <-- the harness install
06:16:40  [entrypoint] repairing sandbox home mount ownership as 1000:1000
06:16:44  Finished openharness-bootstrap.service
```

The identical command, run at 06:17:10 once `is-active` returned `active` and
`/home/sandbox/workspace/.local` was `uid=1000 gid=1000 mode=755`, **succeeded**:
`opencode: installed`. So the install path is sound; the ordering is not.

**Consequences observed.** `run_step` calls `fail 243`, so the script writes
`failed:243` and exits before `sudo touch /run/openharness-ready` — the marker
the control plane waits on is never created. Meanwhile the sandbox itself is
fine: `is-active` reached `active` with `Result=success` seconds later. A
config-B node therefore ends up with a healthy sandbox that the control plane
can never see as ready.

**Attribution.** This defect is **not** an artifact of the candidate
substitution. The ordering comes from accepted Cloud source —
`buildBootstrapInstallCommands()` appends the install lines straight after the
config steps with no readiness wait
(`packages/shared/src/workspace-bootstrap-assets.ts`). The failing write is
inside the sandbox image entrypoint's seed/ownership sequence, which is the
published lineage's own code. The published CLI would hit the same race; with
the published image it would never get that far, because the boot fails first
(section 8).

**The fix this suggests** (recorded as an observation, not implemented here):
the bootstrap script should wait on the same oracle the rebuild helper already
uses — poll `docker exec "$sandbox_name" systemctl is-active
openharness-bootstrap.service` until `active` — between
`agro sandbox install docker` and the first `agro harness install`. The helper
in `host-management-assets.ts` already contains exactly that loop, with budgets
(`readyProbe 10 · readyInterval 5 · readyAttempts 20`). The bootstrap script
has no equivalent.

---

## 11. Secondary observations

- **`agro`-naming drift in the candidate CLI and image.** `agro config set`
  reports `oh.json: set image.ref=…` while writing `agro.json`; the attach
  banner is headed `openharness: oh-a` and recommends `oh harness install …`
  and `oh tool install herdr`; `agro harness install <bad-id>` errors with the
  prefix `oh harness:`. The files on disk are correctly `agro.json` and
  `~/.agro/sandboxes/<name>/`; only the messages lag.
- **The PATH CLI on this host is 0.7.0** and has no `migrate` verb; the
  `migrate --check` result in section 4 depends on the 0.9.0 candidate.
- **A failed rebuild leaves the sandbox stopped**, with no rollback
  (section 5).
- **`agro sandbox install docker` returns before the sandbox is usable**
  (findings 1 and 7 are the same underlying gap seen from two angles).

---

## 12. Verdict table

| Leg | Verdict | Proof |
| --- | --- | --- |
| 1 FRESH | **PASS** | `openharness-bootstrap.service` `ActiveState=active SubState=exited Result=success ExecMainStatus=0`, full cold-boot journal, reproduced twice |
| 2 LEGACY STATE | **PASS** | empty before/after diff of sha256+uid+gid+mode across 9 seeded paths (one documented gh canonicalisation, credential value proved unchanged by hash); git working tree intact; `agro migrate --check` → `status: ready` on the seeded `.oh`/`oh.json` project; `~/.openharness` content intact and visible from inside the container |
| 3 REBUILD | **PASS** (caveat) | `ohmanage` forced command → `state=complete step=ready`; identical bind, identical `dev=bc inode=1486974`, empty state diff, container id changed; caveat: a no-change rebuild reports the same success without recreating the container (finding 3) |
| 4a tmux attach | **FAIL** | session present only during bootstrap; `no sessions` / exit 1 after restart and after rebuild (finding 4) |
| 4b container re-attach | **PASS** | after restart and after rebuild, `agro shell` on a pty and `docker exec` both read state written before the transition, across a changed container id |
| 4c code-server over pinned forward | **PASS** | unit `active`, `127.0.0.1:8080` loopback listener, reached over `permitopen`-pinned `ohproxy` forward (non-permitted port `administratively prohibited`); workspace root `/home/sandbox/workspace` = `dev=bc inode=1486974` = the container's bind source; durable state read through the editor's own HTTP surface |
| 5 UID alignment | **PASS as configured; latent risk CONFIRMED** | node 1000 / container 1000 today; at node uid 1500 the entrypoint chowns the host bind directory to 1000 and the host user gets `HOST-WRITE=DENIED HOST-CREATE=DENIED` (finding 6) |
| Harness config A | **PASS** | `status=ok`, marker present, unit active, zero harnesses installed |
| Harness config B | **FAIL** | `status=failed:243`, no readiness marker, reproduced twice, root-caused to a race and proved by a succeeding re-run (finding 7) |
| Published image (contrast) | **FAIL** | `ActiveState=failed Result=exit-code ExecMainStatus=1` while the container reported `Up 5 seconds (health: starting)` |

### Nothing was BLOCKED

Every leg ran. Systemd-in-container, nested Docker, sshd, tmux and a real
loopback code-server all worked on the disposable node. The only environmental
obstacle encountered was the containerd snapshotter's whiteout extraction under
nesting, which was worked around by switching the node's daemon to `overlay2`
and is disclosed in section 2.

### What was NOT verified

- Nothing was run against a **published patched image or a published CLI** —
  none exists yet. Every PASS is provisional on that re-run.
- **cloud-init itself** did not execute; its blocks were replayed by a script.
  A real `#cloud-config` parse, `defer:`, and module ordering are unverified.
- The **control-plane side** of the lifecycle — `provision.ts`'s state machine,
  `revokeNodeBrowserAccess`, node token registration,
  `openharness-register-runtime-settings` — was not exercised. Only the
  node-side verbs the provisioner drives were.
- The node is a **privileged container, not a VM**; kernel-level differences
  (nested virtualisation, cgroup delegation on a real cloud kernel) are
  untested.
- The **browser-gateway session lifecycle** (revoke-then-rebuild) was not
  simulated; a revoked session after a rebuild is correct by design and was
  deliberately not preserved.
- `ohproxy` was verified to be forward-only by the `permitopen` refusal, but
  the check that the `ohproxy` principal **cannot obtain a shell** never
  executed — it was queued behind a blocked `wait` in the step described in
  section 14.1 and was not re-run. It is **NOT VERIFIED**. A full
  negative-authorisation sweep of the `ohmanage` helper's `reject` paths was
  also not attempted.

---

## 13. Cleanup — verified

Everything this run created was removed:

- containers: `us007a-node` (and, inside it, `oh-a`, `oh-pub`,
  `oh-uidtest`, `us007a-registry`) — removed with the node;
- volume: `us007a-node-docker` — removed;
- images: `agro-candidate:us007a`, `oh-node-host:us007a`, the `ubuntu:24.04`
  base this run pulled, and the intermediate `home` build stage
  (`df5b78d94942`, created 05:49:57Z, inside this run's 05:49:04-05:50:17Z
  build window) — all removed;
- the `ssh -N -L 18080` forward — killed.

Verification after cleanup:

```
docker ps -a       ->  oh-sbx-local, pgadmin   (both pre-existing)
docker volume ls   ->  oh-sbx-local_workspace, pgadmin-data   (both pre-existing)
docker images      ->  the exact pre-run list, no new entries
docker system df   ->  Images 22 / 7.18GB — identical to the pre-run baseline
stray forwards     ->  0
```

No live clone's working state, no other worktree and no published artifact was
modified. The only files written by this worker are this document and
`local-lifecycle-transcript.log`.

---

# 14. Addendum — coordinator acceptance gate

Two items were raised after the run. Both are answered below from evidence
already captured, plus one controlled experiment run specifically to identify
the exit code. The matrix was **not** re-run, and nothing about the product
under test was changed, repaired or re-configured to produce these answers.

## 14.1 The `exit 144` step — determined, not guessed

### What the failing step was

One Bash invocation labelled "Editor reads durable state; verify pin",
containing three sub-checks:

1. read durable state through the code-server HTTP surface;
2. prove the `ohproxy` `permitopen` pin refuses a non-permitted forward;
3. prove the `ohproxy` principal cannot obtain a shell.

### What 144 actually is — determined empirically

144 is **not** an application exit code, and it is **not** `128 + SIGTERM`
under the usual arithmetic. On this kernel and architecture the signal table is
authoritative and was read directly:

```
kill -l TERM  ->  15          (so 128+SIGTERM would be 143)
kill -l 16    ->  STKFLT      (so 128+16 would be SIGSTKFLT, which nothing sends)
```

So the arithmetic had to be tested rather than assumed. Two controlled
experiments were run in this exact harness:

**Control — deliver SIGTERM to the tool's own shell explicitly:**

```
$ echo "control: this shell terminates itself with an explicit SIGTERM"; kill -s TERM $$; echo "NOT REACHED"
Exit code 144
control: this shell terminates itself with an explicit SIGTERM
```

**Exact reproduction — a self-matching `pkill -f`:**

```
$ MARKER=us007a144probe7f3c; echo "repro: this command line contains the marker and pkill -f will match its own shell"; pkill -f "us007a144probe7f3c"; echo "NOT REACHED"
Exit code 144
repro: this command line contains the marker and pkill -f will match its own shell
```

In both cases the trailing `echo "NOT REACHED"` did not run, and the reported
code was 144.

**Conclusion, established by experiment:** in this harness, a tool shell
terminated by **SIGTERM** is reported as **exit 144**. The `128 + N`
convention does not describe this harness's reported number (a SIGTERM'd shell
here reports 144, not the 143 that convention predicts), so 144 must be read
as "the shell was signalled", not decoded as signal 16.

### What sent the SIGTERM, and why

I sent it, to myself. The sequence:

1. Inside sub-check 2 I backgrounded `ssh -N -L 18099:127.0.0.1:22 ohproxy@node`.
   `ssh -N` never exits by design. I then called `wait`. **My harness bug:** the
   step's shell blocked forever *after* it had already produced and printed its
   observation.
2. The blocked step hit the 180s tool timeout and was moved to background as
   task `bcde3wn97`.
3. My very next command began
   `pkill -f "ssh .*18099"; pkill -f "…-N -L 18099"; echo killed`.
   `pkill -f` matches its pattern against every process's **full command line**
   — including the command lines of the invoking shell and of the backgrounded
   task, both of which contained the literal string `18099`. **My second
   harness bug:** the pattern was too broad and matched its own callers.
4. `pkill`'s default signal is SIGTERM. Both shells were terminated. The
   foreground call reported 144 and never printed `killed`; the background task
   `bcde3wn97` was simultaneously reported failed with 144. Two processes, one
   cause, the same code.

This is fully consistent with the reproduction above: no `killed` echo, code
144.

### Whether the underlying assertion holds — **PASS**, and the PASS does not
### depend on any repair

The step's output was preserved and was read **before** the kill. Sub-checks 1
and 2 had already completed and were recorded with `-- exit=0`:

```
marker via editor resource API:
2026-09-09T06:00:24Z

task notes via editor resource API:
user task notes that must survive restart and rebuild
-- exit=0

channel 2: open failed: administratively prohibited: open failed
forward-to-22 http=000
forward-to-22 refused (expected)
```

So the assertion was **not lost, not retried until green, and not relabelled**.
It was captured, and it passed, inside the very run that was later killed.

It was then independently reproduced in a **separate, clean tool call** at
06:07:03 that completed normally with `-- exit=0` — the post-rebuild leg-4c
observation already recorded in section 6(c):

```
root http=302  redirect=…/?workspace=/home/sandbox/oh.code-workspace
marker written inside the post-rebuild container, read via the editor surface:
2026-09-09T06:06:42Z
seeded uncommitted file, read via the editor surface:
committed line
UNCOMMITTED EDIT do-not-lose
```

**What changed between the failing run and the passing run:** only my harness.
The later step did not background a non-terminating `ssh -N` inside the
measured command and did not call `wait`; the long-lived `-L 18080` forward was
started in its own earlier tool call and left alone. **Nothing about the
product under test changed** — same node, same container, same code-server
unit, same `ohproxy` principal, same `oh.code-workspace`. No product default,
config, mount or path was altered to make this pass.

Answering the three-way question explicitly: this is the **PASS** branch — the
editor genuinely reads durable state and my harness was faulty. It is **not**
the FAIL branch: the `storage.homePath` / `AGRO_HOME_MOUNT` decision did **not**
repoint the editor root away from durable user state. The editor root
`/home/sandbox/workspace` was observed to be `dev=bc inode=1486974`, the exact
device and inode of the bind **source** of the sandbox container's
`/home/sandbox`, and durable state written *inside* the container was read back
*through the editor's own HTTP surface* on the far side of both a restart and a
rebuild.

### One casualty, reported rather than hidden

**Sub-check 3 — "the `ohproxy` principal cannot obtain a shell" — never
executed.** It was queued behind the `wait` that blocked, and it was never
re-run. It is therefore **NOT VERIFIED** and is listed as such in section 12's
"What was NOT verified". Its absence does not affect surface (c)'s verdict: it
is a negative-authorisation hardening check on the proxy principal, not an
attach-surface assertion. What *was* verified about that principal is that its
`permitopen` pin is enforced by sshd (`administratively prohibited` on a
non-permitted port) and that the account's configured login shell is
`/usr/sbin/nologin`.

## 14.2 Surface 4a — stated as a product finding

**The coordinator's reading is confirmed, with one correction.**

Confirmed: the `docker-build-oh-sandbox` session exists only while the
bootstrap script runs, nothing recreates it, and it is therefore gone by the
time any user would attach. Observed, in a single polled run:

```
t=1  status=<no status yet>  tmux: docker-build-oh-sandbox: 1 windows (created Wed Sep 9 06:16:39 2026)
t=2  status=failed:243       tmux: no server running on /tmp/tmux-1000/default
```

and after each transition:

```
after restart:  tmux ls -> no server running;  tmux attach -t docker-build-oh-sandbox -> no sessions (exit 1)
after rebuild:  tmux ls -> no server running;  tmux attach -t docker-build-oh-sandbox -> no sessions (exit 1)
```

The mechanism is deterministic, not incidental: `index.ts:1142` launches
`tmux new-session -d -s <session> <script>` with no `remain-on-exit`, so tmux
destroys the session when the script exits — on success or failure alike. The
rebuild path never involves tmux at all; `MANAGEMENT_HELPER` drives
`agro stop` / `agro sandbox install` through `runuser -l` directly. Nothing in
the cloud-config runs the launch line a second time.

Confirmed also: this is **not** the deliberate-revocation case. `node.rebuild`'s
`revokeNodeBrowserAccess` governs browser sessions; it has nothing to do with
this tmux session, which is equally absent after a plain restart and after a
bootstrap that never rebuilt anything.

**The correction.** Access to the node is *not* lost, and no persistent user
state is disconnected. SSH to the node works — the same connection that returns
`no sessions` also successfully ran `agro shell` and `docker exec`, both of
which reached every durable path (section 6(b)). What fails is one specific
documented incantation, not the operator's ability to reach their work. So the
#944 criterion is violated in the narrow sense that a documented attach surface
silently stops working, not in the broad sense that state becomes unreachable.

### Which of the three it is

**It is (ii), a docs/contract problem — with a self-contradiction inside the
accepted source that an operator must resolve one way or the other.**

The runtime is behaving exactly as `tmux new-session -d -s NAME <cmd>` is
specified to behave. Nothing is malfunctioning. What is wrong is that the
accepted source documents two mutually incompatible contracts for the same
session:

*Unbounded — describes it as the node's access model (wrong as written):*

- `packages/shared/src/index.ts:786-791` — "…inside a detached tmux session
  (`docker-build-oh-sandbox`) **the node owner can attach to**. … **Access
  model**: `ssh <sshUser>@<ipv4>` then `tmux attach -t docker-build-oh-sandbox`."
- `packages/shared/src/workspace-bootstrap-assets.ts` header — "…inside a
  detached tmux session **the node owner can attach to from the editor
  terminal**."
- `infra/cloud-init/README.md:78` — an acceptance statement that
  "`… docker-build-oh-sandbox` works."

*Bounded — describes it as a build-watching window (accurate):*

- `infra/cloud-init/README.md:363` and `docs/quickstart.md:591` —
  `tmux attach -t docker-build-oh-sandbox   # watch the agro install + sandbox provision`
- `docs/runtime-settings-runbook.md:157` — "…`tmux attach -t
  docker-build-oh-sandbox` **watches** the node's `agro` …"

The bounded framing is truthful and matches the implementation. The unbounded
framing — in particular the words "Access model" at `index.ts:791` — is false
for every moment after the bootstrap finishes, which is essentially all of a
node's life.

It is **not (iii), a test limitation**. The session was observed *present* at
t=1 and *absent* at t=2 within one polled run on the same host, and absent
again after two further transitions. That is positive evidence of the
behaviour, not an inability to observe it.

It is arguably **(i)** if the operator decides the intended contract is the one
at `index.ts:791` — in which case the fix is a product change (a persistent
session with the script run inside it, or `set remain-on-exit on`), not a docs
edit. **I am not making that call and have changed nothing.** What the evidence
establishes is that the current implementation cannot satisfy the unbounded
contract, and that the two contracts cannot both stand.

**Secondary UX observation:** the failure is silent and uninformative. After a
*successful* bootstrap, the documented command returns a bare `no sessions` and
exit 1, with nothing to distinguish "the build finished successfully an hour
ago" from "the build never started" or "you typed the wrong session name". A
user following `docs/quickstart.md:591` on a healthy node gets an error that
reads like a broken node.

---

# 15. Acceptance criteria, checked one at a time

Stated per criterion, as requested, rather than crediting the story because the
run finished. **The story does not pass.**

| # | Criterion | Verdict | The observed state that decides it |
| --- | --- | --- | --- |
| 1 | Fresh provisioning, readiness by the bootstrap unit reaching `active` (NOT container liveness) | **PASS** | `Type=oneshot RemainAfterExit=yes`, `ActiveState=active SubState=exited Result=success ExecMainStatus=0`, `ExecMainStart 05:56:22 → ExecMainExit 05:56:26`; full cold-boot journal (seed → ownership repair → `pnpm install completed` → `Finished`); reproduced in a second independent fresh run. Container liveness explicitly **not** used — and shown worthless in criterion 8. |
| 2 | Legacy `~/.openharness` state recoverable and operable, each seeded item verified before/after | **PASS** (one documented mutation) | 6 seeded classes, 9 tracked paths; `diff` of the sha256+uid+gid+mode oracle across the restart was empty except `hosts.yml`; git tree intact (` M tracked.txt` / `?? untracked.txt` / `86f48d1`); `.env` and the credential stand-in both still 0600; `~/.openharness` content intact and visible from inside the container; `agro migrate --check` on the seeded `.oh`/`oh.json` project → `status: ready`. The one mutation was investigated, not waved through: `hosts.yml` was canonicalised by the `gh` CLI (gained a `users:` sub-map) and the credential **value** was proved unchanged by hash comparison (`da5358c5…`, `match=YES`) without printing it. |
| 3 | Rebuild preserving persistent user state, proven by OBSERVED volume identity and contents | **PASS** (with finding 3) | Driven through the real `MANAGEMENT_HELPER` over the pinned `ohmanage` forced command → `state=complete step=ready`. Identity observed on both sides, not inferred from the absence of `down -v`: mount `bind /home/sandbox/workspace -> /home/sandbox rw=true` identical; durable root `dev=bc inode=1486974 uid=1000 gid=1000 mode=755` identical; the 9-path content/mode `diff` **produced no output**; container id changed `6b749b6673ee…` → `6a82719b33c4…`; config (`storage.homePath`, `image.ref`) survived. Caveat recorded as finding 3: a no-change rebuild reports the same success **without** recreating the container. |
| 4a | Attach — ssh + `tmux attach -t docker-build-oh-sandbox` | **FAIL** | Session present at t=1 during bootstrap, `no server running` at t=2; `no sessions` / exit 1 after restart and after rebuild. SSH itself works on the same connection. Classified in section 14.2 as a docs/contract defect with a self-contradiction in accepted source. |
| 4b | Attach — container re-attach | **PASS** | State written inside the container before each transition, read back after: after restart `MARKER-READ=2026-09-09T05:58:16Z` on `6b749b6673ee`; after rebuild the same marker on the **different** container `6a82719b33c4`, plus the seeded uncommitted git change. Both via `agro shell` on a real pty and via `docker exec`. |
| 4c | Attach — real loopback code-server over a pinned SSH forward | **PASS** | Host-native unit `active`; `LISTEN 0 511 127.0.0.1:8080`; reached from another machine over the `permitopen`-pinned `ohproxy` forward; pin proved real (`administratively prohibited` on a non-permitted port); root redirects to `?workspace=/home/sandbox/oh.code-workspace` whose single folder `/home/sandbox/workspace` is `dev=bc inode=1486974` — the container's bind source; durable state read **through the editor's own HTTP surface** on both sides of the rebuild. The `exit 144` incident is fully accounted for in section 14.1: harness fault, assertion already captured with `exit=0`, independently reproduced in a clean run, nothing in the product changed. |
| 5 | Each attach surface re-exercised AFTER a restart and AFTER a rebuild | **PARTIAL** | (a) exercised after both — **failed** after both. (b) exercised after both — passed after both. (c) exercised after both — passed after both. So the *exercise* requirement is met for all three; the *outcome* is a fail for (a). |
| 6 | UID alignment numbers | **PASS as configured; latent risk CONFIRMED** | Stated explicitly: node-host `id -u sandbox` = **1000**, container `id -u sandbox` = **1000**; gids **1000** and **1000**. They do **not** diverge under the accepted cloud-config, because its `users:` list has no `- default` so the distro user never takes 1000. They are equal by coincidence of two independent constants, and nothing enforces it: at node uid **1500** the entrypoint's `repairing sandbox home mount ownership as 1000:1000` chowned the host bind directory `1500:1500 → 1000:1000` and the host-native user got `HOST-WRITE=DENIED HOST-CREATE=DENIED`. The entrypoint's UID-sync path is gated on a checkout bind that image-only cloud nodes never have. Reported as a finding about the Cloud bootstrap, not worked around. |
| 7 | Both default-harness configurations, as a test parameter only | **A PASS / B FAIL** | Config A (no default harnesses): `status=ok`, readiness marker present, unit `active`, zero harnesses installed; reproduced twice. Config B (one default harness): `status=failed:243`, **no** readiness marker, reproduced twice, root-caused to a race and proved by the identical command succeeding once the unit reached `active`. No product default was changed and the operator decision is untouched. |

**Overall:** the matrix does not pass. Criterion 4a fails, criterion 7 fails for
config B, criterion 5 is partial, and every PASS above is provisional on being
re-run against a published patched image and CLI, because no published artifact
can currently cold-boot (section 8).

---

# 16. Addendum 2 — resumed invocation: one deliverable, two blockers

Three items were requested. **Item 2 is delivered below.** **Items 1 and 3 are
BLOCKED** by an environment change that happened between invocations, with the
exact blocker recorded. Nothing was silently skipped, retried until green, or
substituted with a mock.

## 16.0 The blocker — Docker is unreachable in this container

The previous run executed in container `e73e5123a864` with the host Docker
socket mounted. This invocation is running in a **different container**,
`395299dff1d9`, which has **no Docker socket at all**. Observed:

```
$ hostname
395299dff1d9                     (previous run: e73e5123a864)

$ echo $DOCKER_HOST
DOCKER_HOST=[unset]

$ command -v docker
/usr/bin/docker                  (client present, 29.8.0)

$ docker info
... failed to connect to the docker API at unix:///var/run/docker.sock;
    check if the path is correct and if the daemon is running:
    dial unix /var/run/docker.sock: connect: no such file or directory

$ ls -la /var/run/docker.sock /run/docker.sock /run/user/1000/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
ls: cannot access '/run/docker.sock': No such file or directory
ls: cannot access '/run/user/1000/docker.sock': No such file or directory

$ find / -maxdepth 5 -name docker.sock
(no results)

$ getent group docker
docker:x:1001:sandbox            (previous run: gid 117 — a different container)

$ curl http://host.docker.internal:2375/_ping
curl: (7) Failed to connect to host.docker.internal port 2375 ...
```

**Missing capability:** access to a container runtime. Both remaining items
require creating containers — item 1 needs an `sshd` host carrying the
`ohproxy` principal, item 3 needs the disposable systemd node host with its own
nested `dockerd`. Neither can run without a Docker daemon.

**What would be needed:** this sandbox started with the host Docker socket bound
(as `oh-sbx-local` was), or an equivalent reachable daemon via `DOCKER_HOST`.

**Also lost:** the previous run's scratchpad
(`…/scratchpad/w13`) no longer exists, so the generated `ohmanage`/`ohproxy`
key material and the generator-emitted SSH assets are gone. They are cheap to
regenerate from the accepted Cloud builders — that is not the blocker; the
absent runtime is.

## 16.1 Item 1 — `ohproxy` cannot obtain a shell — **BLOCKED**

Still **NOT VERIFIED**, for the reason above, not for the original reason. The
original cause (my blocked `wait` plus an over-broad `pkill -f`) is fully
explained in section 14.1 and is not what stops it now.

**The exact procedure, ready to run**, incorporating the PID-scoped cleanup the
coordinator specified — recorded here so the leg is unambiguous when a runtime
is available:

```bash
# positive control FIRST: the same key must successfully forward, so that a
# later refusal proves "no shell", not "bad key".
ssh -i "$KEYS/proxy_key" -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile="$SP/known_hosts" -o ExitOnForwardFailure=yes \
    -N -L 18080:127.0.0.1:8080 ohproxy@"$NODEIP" &
FWD_PID=$!                                  # PID captured explicitly
sleep 5
curl -sS -o /dev/null -w 'forward http=%{http_code}\n' http://127.0.0.1:18080/

# THE ASSERTION — three shapes, all must be refused:
ssh -i "$KEYS/proxy_key" … ohproxy@"$NODEIP" 'id; echo SHELL-OBTAINED'
ssh -i "$KEYS/proxy_key" … -T ohproxy@"$NODEIP"      # no command, no pty
ssh -i "$KEYS/proxy_key" … -tt ohproxy@"$NODEIP"     # force a pty
sftp -i "$KEYS/proxy_key" … ohproxy@"$NODEIP"        # subsystem

# cleanup: kill the captured PID only. No pattern matching, ever, and no
# `wait` on a non-terminating process inside the measured step.
kill "$FWD_PID" 2>/dev/null
```

**Why this shape avoids the earlier trap:** cleanup targets a numeric PID
recorded at launch. Nothing matches a string, so nothing can match the
invoking shell's own command line — which is precisely how the previous attempt
killed itself and its own background task (section 14.1). The forward is never
`wait`ed on.

**What the refusal is expected to come from, and why it is worth observing
rather than assuming.** The `ohproxy` principal is deliberately built *without*
a forced command — `buildHostProxyAssets()`'s own comment states "there is NO
`command=` — the gateway dials with `ssh -N` direct-tcpip and never runs a
shell (the account's login shell is `/usr/sbin/nologin`)". So confinement rests
on three independent mechanisms, none of which is a forced command:

1. the account's login shell `/usr/sbin/nologin`;
2. `PermitTTY no` in the generated `Match User ohproxy` block;
3. `restrict` in the authorized_keys line, re-enabling only `port-forwarding`
   and pinning `permitopen="127.0.0.1:8080"`.

Note that OpenSSH's `restrict` does **not** by itself block command execution —
it disables pty, agent/X11 forwarding, port forwarding and user-rc. Command
execution is blocked by `nologin`, not by `restrict`. That is exactly why this
check is worth running rather than reasoning about: the confinement depends on
a user-account property (`nologin`) that lives outside the generated
authorized_keys line and outside the sshd Match block, and nothing in the
accepted generator asserts it. `buildHostProxyAssets()` emits the key line and
the sshd block; the `nologin` shell is set by whatever creates the `ohproxy`
account.

**What IS already verified about this principal** (section 6(c)): its
`permitopen` pin is enforced by sshd — a forward to a non-permitted port on the
same key was refused with `channel 2: open failed: administratively
prohibited: open failed`. So the key is confined in the forwarding dimension.
The shell dimension remains unverified.

## 16.2 Item 2 — the UID/GID contract — **DELIVERED (assessment only)**

Nothing was implemented, remapped, or chowned. This section is analysis.

> **Citation note.** All line numbers below are pinned to **HEAD `b10ecac3`**,
> which is the tree the candidate image was built from and the tree the matrix
> ran against. The live checkout's *working tree* currently reverts
> `.devcontainer/` to the pre-AGRO `.oh` generation (see 16.3), so working-tree
> line numbers do not match. Cite via `git show HEAD:<path>` to reproduce.

### A. The required contract, as a checkable condition

Three identities decide whether attach surface (c) works on an image-only node:

| Symbol | Meaning | Where it comes from |
| --- | --- | --- |
| **H** | the uid:gid that `openharness-code-server.service` runs as on the node | the unit's `User=sandbox` / `Group=sandbox` (`packages/shared/src/index.ts`, code-server unit block) |
| **P** | the node-host path bound to the container's `/home/sandbox` | `storage.homePath` / `AGRO_HOME_MOUNT`, default `/home/sandbox/workspace`; bound by `docker-compose.image-only.yml:9` — `${AGRO_HOME_MOUNT:-${OH_HOME_MOUNT:-workspace}}:/home/sandbox` |
| **C** | the uid:gid the container chowns P to on every boot | `sandbox_ownership()` = `id -u sandbox`:`id -g sandbox` *inside the container* (`entrypoint.sh:37`), applied at `entrypoint.sh:70-71` |

**The condition, checkable before first boot:**

```
uid(sandbox @ node) == uid(sandbox @ container image)
        AND
gid(sandbox @ node) == gid(sandbox @ container image)
```

**A stronger and more honest form of the same condition** — because the real
requirement is about the owner of the path, not about a name:

```
owner(P) as the node sees it  ==  C
        AND
H can write P
```

The second form catches a case the first misses: a node whose
`storage.homePath` points at a directory owned by some *other* user fails
identically even when the two `sandbox` uids match.

Observed values this run: node `1000:1000`, container `1000:1000` — condition
**holds**. Forced to node `1500:1500` — condition **violated**, and the observed
consequence was `HOST-WRITE=DENIED` / `HOST-CREATE=DENIED` for the host-native
user after the entrypoint rewrote P to `1000:1000` (section 7).

### B. Where the contract is established, and where it is merely assumed

**Established — genuinely pinned in code:**

- **Container uid/gid.** `Dockerfile:60` — `useradd -m -u 1000 -s /bin/zsh
  sandbox`. A hard-coded constant baked into the image. This half of the
  contract is real.
- **The mutation itself.** `entrypoint.sh:70-71` —
  `find /home/sandbox -path "$OH_PROJECT_ROOT" -prune -o -exec chown -h "$owner" {} +`,
  where `$owner` is `sandbox_ownership()` (`entrypoint.sh:37`). Unconditional,
  every boot, called at `entrypoint.sh:207`.
- **The bind.** `docker-compose.image-only.yml:9`.
- **code-server's identity.** `User=sandbox` / `Group=sandbox` in the unit.

**Merely assumed — nothing pins it:**

- **The node-side uid.** The cloud-config `users:` block creates `sandbox` with
  **no `uid:` field** and the list contains **no `- default` entry**. The value
  1000 is an *emergent* property of the base image's existing passwd entries
  plus `useradd`'s first-free-uid policy. Nothing in the cloud-config, the
  provisioner, or AGRO asserts it. A base image that already occupies 1000 — or
  restoring `- default` so the distro user takes it — silently yields 1001.
- **The equality itself.** No code anywhere compares H, C or `owner(P)`. There
  is no assertion, no probe, no test, and no runtime check. The two constants
  are set in two repositories that never consult each other.

**The one mechanism that could adapt is structurally unreachable here.** The
entrypoint *does* contain UID reconciliation — `entrypoint.sh:169-185` reads
`HOST_UID=$(stat -c '%u' "$HARNESS_DIR")`, compares with `SANDBOX_UID=$(id -u
sandbox)`, and calls `usermod -u "$HOST_UID" sandbox`. But it is gated at
`entrypoint.sh:161` on `mountpoint -q "$HARNESS_DIR"` with a control directory
present — a **checkout bind** at `/home/sandbox/harness`. Image-only cloud
nodes have no checkout bind; the observed journal line on every boot in this
run was `[entrypoint] no checkout bind at /home/sandbox/harness — seeding from
/opt/agro-seed` (`entrypoint.sh:193`). Control falls straight through to
`repair_home_mount_ownership` at `entrypoint.sh:207`.

So the adaptive path exists and is disabled on exactly the deployment that
needs it, while the destructive path runs unconditionally.

### C. Assessment of a fail-before-mutation guard

**Could the bootstrap detect divergence and fail loudly before anything is
chowned? Yes — cleanly, under the existing spec, using pieces the spec already
has.**

**Where it must go.** In the generated bootstrap script, after
`install_agro`/`activate_node` and **before**
`run_step agro sandbox install docker …`. That is the only safe window: the
chown happens on the first boot of the container that mounts P, and that boot
is inside `agro sandbox install docker`. A guard placed after the install has
already lost.

**What it would check.**

1. Node side — the owner of the path that will actually be bound:
   `stat -c '%u %g' "$sandbox_home"`. Preferred over `id -u sandbox`, per the
   stronger condition in A.
2. Image side — the baked identity, obtained **without mounting anything**:
   `docker run --rm "$sandbox_image" id -u sandbox` (and `-g`). No bind, no
   volume, no systemd, therefore no chown; a throwaway container that cannot
   touch user state. This is exactly the probe already run during this matrix:
   `docker run --rm agro-candidate:us007a id sandbox` →
   `uid=1000(sandbox) gid=1000(sandbox)`.
3. Compare both uid and gid; on mismatch, call the existing `fail` with a
   distinct code.

**What it would cost.**

- **Network: zero additional.** The image must be resolved for the guard, but
  it must be pulled for the install regardless. Hoisting an explicit
  `docker pull "$sandbox_image"` ahead of the guard makes it free in transfer
  terms; the install then finds the image present.
- **Time: ~1 second.** One short-lived container start of an already-present
  image. Comparable probes in this run returned immediately.
- **Code: it fits the existing idiom exactly.** It is a `run_step`-shaped
  function in the same mould as the newly added `wait_sandbox_ready`, using the
  same `fail` path, producing the same observable `failed:<code>` in the status
  file the control plane already reads, and — because `fail` exits — leaving
  the `ok` write and the `/run/openharness-ready` touch unreachable. Same
  fail-closed shape the readiness gate now uses. A distinct code (e.g.
  `failed:3`, alongside `failed:1` unit-failed and `failed:2` deadline) keeps it
  diagnosable.
- **Risk: low, and deliberately detection-only.** It must not `usermod`, must
  not remap, must not chown. That restraint is the point: the alternative —
  opportunistic remediation — would silently rewrite the ownership of a user's
  workspace, which is the class of action this epic forbids. A node that fails
  this guard should stop and surface a decision to a human.

**Limits, stated honestly.**

- It protects **new provisioning only**. A node already provisioned with
  divergent uids has already had P rewritten. A guard cannot undo that, and
  undoing it is an operator decision, not an automatic one.
- It does **not** cover the rebuild path. `MANAGEMENT_HELPER` never runs the
  bootstrap script; it calls `agro stop` / `agro sandbox install` directly. If
  the guard is wanted there too it needs a second placement before the helper's
  install step.
- It reads the image's **baked** uid. If a future image resolved its uid at
  runtime instead of baking it at `Dockerfile:60`, the probe would need to
  change with it.
- A guard is a detector, not the contract. The durable fix is to make one side
  authoritative — for example pinning `uid: 1000` explicitly in the
  cloud-config `users:` entry so the node-side value stops being emergent. That
  is an operator/owner decision and is **not** proposed here as an action.

## 16.3 Item 3 — A+B re-run against the fixed bootstrap — **BLOCKED**

Cannot run: no container runtime (16.0).

**The fix was verified present by reading**, which is all that was possible:

- `infra/cloud-init/cloud-config.yaml` — `wait_sandbox_ready()` polls
  `docker exec "$sandbox_name" systemctl is-active "$ready_unit"`, `active`
  → `return 0`, `failed` → `return 1`, loop exhaustion → `return 2`; wired as
  `run_step wait_sandbox_ready` immediately after
  `run_step agro sandbox install docker …` and before
  `agro config set storage.homePath`, `echo ok`, and
  `sudo touch /run/openharness-ready`.
- `packages/shared/src/workspace-bootstrap-assets.ts:215-219` — the constants
  are taken from `SANDBOX_READY_UNIT` and `SANDBOX_REBUILD_BUDGET_SECONDS`
  (the rebuild helper's own), with `ready_deadline` from
  `WORKSPACE_READY_DEADLINE_SECONDS`; the gate is emitted at line 290.

That is a source reading, **not** an observation, and it discharges nothing. In
particular the two gaps the bootstrap owner raised remain **unanswered**, and
both are exactly the kind of claim that cannot be settled by reading:

- **(a) Is `openharness-bootstrap.service` the completion signal on a
  container's FIRST boot, or only post-recreate?** Partially informed by prior
  observation but **not** answered. In the previous run the unit *was* observed
  reaching `active` with `Result=success` on first boots of freshly created
  containers, and the probe sequence `(empty) → activating → active` was
  observed directly. The `(empty)` first sample is `docker exec` failing while
  the container is not yet accepting exec — which the gate treats as
  "not ready, keep polling", i.e. fail-closed. That is consistent with the gate
  working on first boot, but it was observed against the *pre-fix* script and
  must be re-observed against the gate itself.
- **(b) Does the 300s deadline survive a cold published-lineage pull plus
  first-boot seeding?** **Unanswered.** Prior timings are suggestive but were
  measured with the image already present in the node's daemon: first boot
  seed-to-`active` ran 05:56:22 → 05:56:26 (~4s) and 06:16:40 → 06:16:44 (~4s).
  The pull component was never inside the measured window, so the sum against
  300s is unknown. If config A ever fails `failed:2`, the answer is a larger
  attempt count, not removing the gate.

**A reproducibility warning that must be settled before the re-run.** The live
checkout `/home/sandbox/harness` now has a **dirty working tree** in which
`.devcontainer/` has been reverted to the pre-AGRO `.oh` generation:

```
$ git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD
development
b10ecac3

$ git status --short | grep devcontainer
 M .devcontainer/Dockerfile
 M .devcontainer/docker-compose.image-only.yml
 M .devcontainer/docker-compose.yml
 M .devcontainer/entrypoint.sh

$ git diff --stat HEAD -- .devcontainer/
 4 files changed, 129 insertions(+), 132 deletions(-)

# HEAD (what the matrix was built from):     /opt/agro-seed, AGRO_HOME_MOUNT, compat_control_dir
# working tree (what a build would use now): /opt/oh-seed,  OH_HOME_MOUNT,  no compat_control_dir
```

`docker build -f .devcontainer/Dockerfile .` against the working tree **today
would produce a legacy `.oh`-generation image, not the AGRO candidate the matrix
tested.** The re-run must build from HEAD or from a clean worktree, or its
results will not be comparable to anything in this document. I have **not**
touched the live checkout's working state.

## 16.4 Cleanup integrity — one item I can no longer verify

The previous invocation ended with cleanup verified against the pre-run
baseline (section 13): 22 images / 7.18GB, 2 pre-existing containers, 2
pre-existing volumes, no stray forwards. That verification stands as of the
moment it was taken.

**One caveat, disclosed rather than assumed away.** At the start of this
invocation — before discovering the runtime was gone — I issued two
`docker build` commands for `agro-candidate:us007a` and `oh-node-host:us007a`.
Their output redirects targeted the scratchpad directory, and those log files
do not exist, which indicates the redirects failed because the directory was
already gone and therefore that the builds never started. I cannot confirm this
by inspection, because no Docker daemon is reachable from this container.

**Requested of the operator/coordinator:** on the host, confirm that
`agro-candidate:us007a` and `oh-node-host:us007a` are absent and that no
`us007a-*` container or volume exists. If any are present they are mine and
should be removed:

```
docker rm -f us007a-node 2>/dev/null; docker volume rm us007a-node-docker 2>/dev/null
docker rmi -f agro-candidate:us007a oh-node-host:us007a 2>/dev/null
```

No live clone's working state, no other worktree and no published artifact was
modified in this invocation. The only files written remain this evidence
document and `local-lifecycle-transcript.log`.

## 16.5 Status of the three items

| Item | Status | Basis |
| --- | --- | --- |
| 1 — `ohproxy` cannot obtain a shell | **BLOCKED** (still NOT VERIFIED) | no container runtime: `dial unix /var/run/docker.sock: connect: no such file or directory`, no socket on disk, `DOCKER_HOST` unset, no TCP daemon. Procedure with PID-scoped cleanup recorded in 16.1, ready to run. |
| 2 — UID/GID contract | **DELIVERED** | 16.2 — checkable condition, established-vs-assumed with HEAD-pinned citations, fail-before-mutation guard assessed. Assessment only; nothing implemented, remapped or chowned. |
| 3 — A+B re-run | **BLOCKED** | same missing runtime. Fix confirmed present by source reading only, which discharges nothing; gaps (a) and (b) remain unanswered. Reproducibility warning in 16.3 must be settled first. |

Surface 4a is untouched and remains unresolved, as instructed. No product
default was changed anywhere in this invocation.
