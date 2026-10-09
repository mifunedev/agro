# OpenClaw manual review transcript

- Task: `openclaw-harness-support`, story US-005
- Issue: https://github.com/mifunedev/agro/issues/1362
- Branch: `feat/1362-openclaw-harness-support-us-005` at `9ceadc7b`
- Date: 2026-10-09
- Image: `agro-oc-us005:test`, built from this branch with `docker build --file .devcontainer/Dockerfile --tag agro-oc-us005:test .` (exit 0)
- Compose project: `agro-oc-us005`, file `.devcontainer/docker-compose.image-only.yml`, empty env file, named volume `agro-oc-us005_workspace`, no host bind mount
- Node `v24.21.0`, npm `11.19.0` in the image
- Every command ran as user `sandbox` in `/home/sandbox/harness` through `docker exec -u sandbox -w /home/sandbox/harness <container> bash -lc '<command>'`.
- The container was ready when `agro-bootstrap.service` and `agro-cron.service` were both active.

The run used no provider credential, no API key, and no messaging channel. The run did not start `openclaw onboard`. No gateway token value appeared in any output, so this file redacts nothing.

## 0. Confirm the branch CLI and the workspace

The image builds `agro` from this branch's `.agro/cli/`. The harness list shows `openclaw`, so the container runs the branch CLI.

```text
$ whoami; pwd; echo $PATH; node --version; npm --version; command -v agro; readlink -f "$(command -v agro)"
sandbox
/home/sandbox/harness
/home/sandbox/.local/bin:/home/sandbox/.local/share/pnpm:/home/sandbox/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
v24.21.0
11.19.0
/usr/local/bin/agro
/opt/agro/dist/agro.js
exit=0
```

```text
$ agro harness list
HARNESS          KIND         INSTALLED
claude-code      installable  no
codex            installable  no
pi               installable  no
opencode         installable  no
openclaw         installable  no
grok-build       installable  no
hermes           installable  no
muse-code        installable  no
antigravity-cli  installable  no
fx               installable  no
t3code           on-demand    no
exit=0
```

The image-only workspace is a copy of the image seed. `.dockerignore` excludes `.git/`, so the workspace is not a git repository:

```text
$ git -C /home/sandbox/harness rev-parse --is-inside-work-tree; git -C /home/sandbox/harness log --oneline -2
fatal: not a git repository (or any parent up to mount point /home)
Stopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).
fatal: not a git repository (or any parent up to mount point /home)
Stopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).
exit=128
```

The closest equivalent is a baseline commit of the seed before the install. Section 4 then runs `git status --porcelain` against this baseline.

```text
$ grep -n "openclaw" /home/sandbox/harness/.gitignore; command -v openclaw; ls -d /home/sandbox/harness/.openclaw 2>&1
75:/.openclaw/
ls: cannot access '/home/sandbox/harness/.openclaw': No such file or directory
exit=2
```

```text
$ git init -q -b main /home/sandbox/harness && git -C /home/sandbox/harness add -A && git -C /home/sandbox/harness -c user.name=us005-review -c user.email=us005@example.invalid commit -q -m "baseline: image seed before openclaw install" && git -C /home/sandbox/harness rev-parse --short HEAD && git -C /home/sandbox/harness status --porcelain; echo porcelain_lines=$(git -C /home/sandbox/harness status --porcelain | wc -l)
ca266f6
porcelain_lines=0
exit=0
```

```text
$ git -C /home/sandbox/harness status --porcelain --ignored | tee /tmp/us005-ignored-before.txt
!! .agro/.image-seeded
!! .agro/tasks/agent-browser-clipboard-read/evidence/
!! .agro/tasks/fx-harness/checks/
!! .agro/tasks/fx-harness/evidence/
!! .agro/tasks/hermes-host-install-home/evidence/
!! .agro/tasks/hermes-workspace-binding/evidence/
!! .agro/tasks/openclaw-harness-support/evidence/
!! .agro/tasks/pi-extension-issues/evidence/
!! .agro/tasks/remote-sandbox-branch-workspace/evidence/
!! .agro/tasks/remote-sandbox-skill/evidence/
!! .agro/tasks/sandbox-marker-detection/evidence/
!! crons/.cron.log
!! crons/.pid
!! node_modules/
exit=0
```

## 1. Install OpenClaw

```text
$ agro harness install openclaw
installing OpenClaw into the sandbox…
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 343 packages in 25s

112 packages are looking for funding
  run `npm fund` for details
npm warn install-scripts 4 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @google/genai@2.23.0 (preinstall: echo 'preinstall: no-op')
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts   koffi@3.3.1 (install: node ./cnoke.cjs -P . -D src/koffi --prebuild --release)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts
npm warn install-scripts Run `npm install -g --allow-scripts=@google/genai,esbuild,koffi,protobufjs` to allow these scripts once, or `npm config set allow-scripts=@google/genai,esbuild,koffi,protobufjs --location=user` to allow them for all global installs.
Updated agents.defaults.workspace. Change will apply without restarting the gateway.
Updated agents.defaults.skipBootstrap. Change will apply without restarting the gateway.
Updated gateway.mode. Restart the gateway to apply.
openclaw: installed — see https://github.com/mifunedev/agro/blob/main/docs/harnesses/openclaw.md for authentication
Run OpenClaw in the AGRO workspace: OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw
exit=0
```

## 2. Check the OpenClaw version

```text
$ command -v openclaw; openclaw --version
/home/sandbox/.local/bin/openclaw
OpenClaw 2026.9.9 (bcfc888)
exit=0
```

## 3. Check the workspace configuration

```text
$ OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw config get agents.defaults.workspace
/home/sandbox/harness
exit=0
```

```text
$ OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw config get agents.defaults.skipBootstrap
true
exit=0
```

```text
$ OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw config get gateway.mode
local
exit=0
```

```text
$ ls -A /home/sandbox/harness/.openclaw
config-journal-fingerprint.key
openclaw.json
openclaw.json.bak
openclaw.json.bak.1
state
exit=0
```

## 4. Check the git status after the install

The install added no tracked or untracked file. The ignored-path list gained only `.openclaw/`. `diff` returns exit 1 because the lists differ by that one line.

```text
$ git -C /home/sandbox/harness status --porcelain; echo porcelain_lines=$(git -C /home/sandbox/harness status --porcelain | wc -l)
porcelain_lines=0
exit=0
```

```text
$ git -C /home/sandbox/harness status --porcelain --ignored | diff /tmp/us005-ignored-before.txt -
11a12
> !! .openclaw/
exit=1
```

## 5. Start, inspect, and stop the gateway

```text
$ agro gateway openclaw
[gateway] starting client-openclaw …
[gateway] client-openclaw started
[gateway] attach with:  tmux attach -t client-openclaw
exit=0
```

```text
$ for i in $(seq 1 120); do grep -q "\[gateway\] ready" /tmp/client-openclaw.log 2>/dev/null && break; sleep 1; done; echo waited=${i}s; grep -m1 "\[gateway\] ready" /tmp/client-openclaw.log
waited=9s
00:53:47 [gateway] ready
exit=0
```

```text
$ agro gateway status
  · client-slack-pi  stopped   (gateway pi)
  · client-slack-hermes  stopped   (gateway hermes)
  ✓ client-openclaw  healthy   (tmux attach -t client-openclaw)
exit=0
```

```text
$ tmux ls
client-openclaw: 1 windows (created Fri Oct  9 00:53:39 2026)
exit=0
```

The gateway listens on loopback only:

```text
$ ss -ltnp | grep 18789
LISTEN 0      511        127.0.0.1:18789      0.0.0.0:*    users:(("openclaw-gatewa",pid=1261,fd=50))
LISTEN 0      511            [::1]:18789         [::]:*    users:(("openclaw-gatewa",pid=1261,fd=51))
exit=0
```

The gateway log follows. This file omits the ASCII banner, the ANSI color codes, and four diagnostic lines (`shutdown budget`, `native runtime`, `worker startup state`, and a blank line). The log names the auth token event but prints no token value. No channel connected. OpenClaw downloaded its public model catalog without a credential.

```text
$ wc -l /tmp/client-openclaw.log; cat /tmp/client-openclaw.log | head -60
46 /tmp/client-openclaw.log
[bridge-supervisor] launching openclaw bridge (2026-10-09T06:53:39Z)

OpenClaw 2026.9.9 (bcfc888)
...
00:53:44 [gateway] loading configuration…
00:53:44 [gateway] resolving authentication…
00:53:44 [gateway] starting...
00:53:44 [gateway] spawn broker ready pid=1394
00:53:45 [gateway] auth token was missing. Generated a runtime token for this startup without changing config; restart will generate a different token. Persist one with `openclaw config set gateway.auth.mode token` and `openclaw config set gateway.auth.token <token>`.
00:53:46 [gateway] runtime-only gateway auth paired the local CLI device before readiness
00:53:46 [gateway] starting HTTP server...
00:53:46 [health-monitor] started (interval: 300s, startup-grace: 60s, channel-connect-grace: 120s)
00:53:46 [gateway] agent model: openai/gpt-6-astra (thinking=medium, fast=off)
00:53:46 [gateway] http server listening (14 plugins: anthropic, browser, canvas, cua-computer, device-pair, file-transfer, geolocation, github, linux-node, memory-core, ollama, openai, talk-voice, xai; 2.2s)
00:53:46 [gateway] log file: /tmp/openclaw/openclaw-2026-10-09.log
00:53:46 [gateway] starting channels and sidecars...
00:53:47 [plugins] memory-core: created managed dreaming cron job.
00:53:47 [gateway] startup outcomes: internal-hooks=skipped (not-configured); internal-startup-hook=skipped (no-handlers-loaded); gateway-start-hooks=scheduled; gmail-watcher=skipped (hooks-disabled); gmail-model=skipped (not-configured)
00:53:47 [gateway] ready
00:53:47 [heartbeat] started
00:53:48 [gateway] remote model catalog downloaded; restart the Gateway to apply it
exit=0
```

```text
$ agro gateway openclaw --stop
[gateway] stopped client-openclaw
exit=0
```

```text
$ agro gateway status
  · client-slack-pi  stopped   (gateway pi)
  · client-slack-hermes  stopped   (gateway hermes)
  · client-openclaw  stopped   (gateway openclaw)
exit=0
```

```text
$ tmux ls
no server running on /tmp/tmux-1000/default
exit=1
```

```text
$ for i in $(seq 1 30); do ss -ltn | grep -q 18789 || break; sleep 1; done; ss -ltnp | grep 18789; echo listeners_18789=$(ss -ltn | grep -c 18789)
listeners_18789=0
exit=0
```

## 6. Refuse a conflicting `OPENCLAW_STATE_DIR`

The install refuses the foreign state directory. The diagnostic names both paths. The command creates no foreign directory.

```text
$ OPENCLAW_STATE_DIR=/tmp/foreign agro harness install openclaw
[openclaw] conflicting OPENCLAW_STATE_DIR=/tmp/foreign; selected workspace state directory is /home/sandbox/harness/.openclaw.
[openclaw] select the workspace state directory before retrying: OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw
[openclaw] No state is migrated.
exit=1
```

```text
$ ls -d /tmp/foreign 2>&1
ls: cannot access '/tmp/foreign': No such file or directory
exit=2
```

The gateway refuses the same directory and starts no tmux session.

```text
$ OPENCLAW_STATE_DIR=/tmp/foreign agro gateway openclaw
[gateway] starting client-openclaw …
[openclaw] conflicting OPENCLAW_STATE_DIR=/tmp/foreign; selected workspace state directory is /home/sandbox/harness/.openclaw.
[openclaw] select the workspace state directory before retrying: OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw
[openclaw] No state is migrated.
exit=1
```

```text
$ tmux has-session -t client-openclaw; echo has_session=$?; tmux ls
no server running on /tmp/tmux-1000/default
has_session=1
no server running on /tmp/tmux-1000/default
exit=1
```

## 7. Uninstall OpenClaw

```text
$ agro harness uninstall openclaw
removing OpenClaw from /home/sandbox/.local…

removed 489 packages in 914ms
openclaw: removed from /home/sandbox/.local
exit=0
```

```text
$ command -v openclaw; echo command_v_exit=$?; ls /home/sandbox/.local/bin/openclaw 2>&1
command_v_exit=1
ls: cannot access '/home/sandbox/.local/bin/openclaw': No such file or directory
exit=2
```

```text
$ agro harness list | grep -E "HARNESS|openclaw"
HARNESS          KIND         INSTALLED
openclaw         installable  no
exit=0
```

The uninstall keeps the state directory `.openclaw/`:

```text
$ ls -d /home/sandbox/harness/.openclaw 2>&1; git -C /home/sandbox/harness status --porcelain; echo porcelain_lines=$(git -C /home/sandbox/harness status --porcelain | wc -l)
/home/sandbox/harness/.openclaw
porcelain_lines=0
exit=0
```

## 8. Remove each created resource

The run created these resources in the sandbox: the state directory, the OpenClaw log directory, the gateway log, the baseline `.git`, and the ignored-path list. The run removed each one.

```text
$ rm -rf /home/sandbox/harness/.openclaw /tmp/openclaw /tmp/client-openclaw.log /home/sandbox/harness/.git /tmp/us005-ignored-before.txt; ls -d /home/sandbox/harness/.openclaw /tmp/openclaw /tmp/client-openclaw.log /home/sandbox/harness/.git 2>&1
ls: cannot access '/home/sandbox/harness/.openclaw': No such file or directory
ls: cannot access '/tmp/openclaw': No such file or directory
ls: cannot access '/tmp/client-openclaw.log': No such file or directory
ls: cannot access '/home/sandbox/harness/.git': No such file or directory
exit=2
```

The host then removed the compose project and the image. The commands below ran from the host, not in the sandbox.

```text
$ env -u GH_TOKEN SANDBOX_NAME=agro-oc-us005 AGRO_SANDBOX_IMAGE=agro-oc-us005:test AGRO_PULL_POLICY=missing AGRO_HOME_MOUNT=workspace docker compose --project-name agro-oc-us005 --env-file <empty file> -f .devcontainer/docker-compose.image-only.yml down -v --remove-orphans
 Container agro-oc-us005 Stopping
 Container agro-oc-us005 Stopped
 Container agro-oc-us005 Removing
 Container agro-oc-us005 Removed
 Volume agro-oc-us005_workspace Removing
 Network agro-oc-us005_default Removing
 Volume agro-oc-us005_workspace Removed
 Network agro-oc-us005_default Removed
exit=0
```

The driver shell did not capture the exit status of `docker rmi`. The next command proves that the image is gone.

```text
$ docker rmi agro-oc-us005:test
Untagged: agro-oc-us005:test
Deleted: sha256:5be30275fb5b4b2851dcb8701bc873131e59f9d95dbbac11e841dddd95c0d9e4
Deleted: sha256:057e6f65e53478da2f6017465f7bca8af838b05c4ab1d3f55ffe0d3b5fc263b3
exit=<not captured>
```

```text
$ docker image ls agro-oc-us005 -q
exit=0
$ docker ps -a --filter name=agro-oc-us005 -q
exit=0
$ docker volume ls --filter name=agro-oc-us005 -q
exit=0
$ docker network ls --filter name=agro-oc-us005 -q
exit=0
```

## Criteria map

| Criterion | Section |
| --- | --- |
| Each command records its output and exit status | 0 to 8 |
| `agro harness install openclaw`, `openclaw --version`, `openclaw config get agents.defaults.workspace`, `git status --porcelain` | 1, 2, 3, 4 |
| `agro gateway openclaw`, `agro gateway status`, `agro gateway openclaw --stop` | 5 |
| Conflicting `OPENCLAW_STATE_DIR` refusal | 6 |
| No provider credential, no messaging channel | header, 5 |
| `agro harness uninstall openclaw` and removal of each created resource | 7, 8 |

## 9. Real AGRO workspace on an exe.dev VM

Sections 0 to 8 ran in an image-only sandbox. The image seed holds no `.git`, so those sections cannot prove alignment with a real checkout. This section closes that gap.

The advisor ran `exedev-workspace-check.sh` on 2026-10-09 with the `/remote-sandbox` driver on the operator host:

```bash
AGRO_REF=feat/1362-openclaw-harness-support bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/openclaw-harness-support/evidence/exedev-workspace-check.sh
```

The check installs the AGRO CLI on a fresh Ubuntu VM and runs `agro workspace create --ref feat/1362-openclaw-harness-support`. Then `agro sandbox install docker --checkout <workspace>` builds the sandbox from the branch Dockerfile with the real git checkout mounted at `/home/sandbox/harness`. The run used no provider credential and no messaging channel. The log below omits the VM connection record and the bundled OpenClaw skill rows.

An earlier run omitted `--checkout`. That run booted the published Node 22 image without the checkout, and this file does not count it.

```text
== exedev agro-mx-1009-013612 check=openclaw-workspace-check.sh image=default date=2026-10-09T07:36:12Z
TIMING create_return_s=1.4 first_shell_s=2.0
build under test: install=release agro_js=release sandbox_image=cli default agro_ref=feat/1362-openclaw-harness-support vm_image=provider default
started
== A host and sandbox
host: Ubuntu 24.04.5 LTS user=exedev
RESULT A1-host-cli PASS agro 0.18.1
RESULT A2-workspace PASS ref=feat/1362-openclaw-harness-support@9d843b89
RESULT A3-docker PASS server=29.1.3
sandbox install exit=0
RESULT A4-sandbox-boot PASS 78s, built from the workspace Dockerfile
== B sandbox identity
 Container oc-mx  Creating
 Container oc-mx  Created
 Container oc-mx  Starting
 Container oc-mx  Started
next: agro shell oc-mx
RESULT B1-checkout-mounted PASS feat/1362-openclaw-harness-support@9d843b89
RESULT B2-node24 PASS v24.21.0
$ node --version; npm --version; agro --version; readlink -f "$(command -v agro)"; git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD; mount | grep " /home/sandbox/harness " | cut -d" " -f1-5
v24.21.0
11.19.0
0.18.1
/opt/agro/dist/agro.js
feat/1362-openclaw-harness-support
9d843b89
/dev/vda on /home/sandbox/harness type ext4
exit=0
$ git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l)
porcelain_lines=0
exit=0
$ agro harness list | grep -E "HARNESS|openclaw"
HARNESS          KIND         INSTALLED
openclaw         installable  no
exit=0
== C install
$ agro harness install openclaw
installing OpenClaw into the sandbox…
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 343 packages in 28s

112 packages are looking for funding
  run `npm fund` for details
npm warn install-scripts 4 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @google/genai@2.23.0 (preinstall: echo 'preinstall: no-op')
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts   koffi@3.3.1 (install: node ./cnoke.cjs -P . -D src/koffi --prebuild --release)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts
npm warn install-scripts Run `npm install -g --allow-scripts=@google/genai,esbuild,koffi,protobufjs` to allow these scripts once, or `npm config set allow-scripts=@google/genai,esbuild,koffi,protobufjs --location=user` to allow them for all global installs.
Updated agents.defaults.workspace. Change will apply without restarting the gateway.
Updated agents.defaults.skipBootstrap. Change will apply without restarting the gateway.
Updated gateway.mode. Restart the gateway to apply.
openclaw: installed — see https://github.com/mifunedev/agro/blob/main/docs/harnesses/openclaw.md for authentication
Run OpenClaw in the AGRO workspace: OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw openclaw
exit=0
RESULT C1-install PASS 
$ openclaw --version
OpenClaw 2026.9.9 (bcfc888)
exit=0
== D workspace alignment
RESULT D1-workspace-is-checkout PASS /home/sandbox/harness
$ export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw; openclaw config get agents.defaults.skipBootstrap; openclaw config get gateway.mode; openclaw config file
true
local
/home/sandbox/harness/.openclaw/openclaw.json
exit=0
$ ls -A /home/sandbox/harness/.openclaw; if test -e /home/sandbox/.openclaw; then echo "default ~/.openclaw: present"; else echo "default ~/.openclaw: absent"; fi
config-journal-fingerprint.key
openclaw.json
openclaw.json.bak
openclaw.json.bak.1
state
default ~/.openclaw: absent
exit=0
$ git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l); git check-ignore -v .openclaw/
porcelain_lines=0
.gitignore:75:/.openclaw/	.openclaw/
exit=0
RESULT D2-checkout-clean-after-install PASS 
$ export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw; openclaw skills list 2>/dev/null | grep agents-skills-project
│ ✓ ready       │ agent-browser            │ Open a URL in the headless agent-browser, with a  │ agents-skills-project │
│ ✓ ready       │ architect                │ Decide what the system should become before /prd  │ agents-skills-project │
│ ✓ ready       │ audit                    │ Explicit eight-target audit dispatcher for        │ agents-skills-project │
│ ✓ ready       │ builder                  │ Author and refine reference skills, task-style    │ agents-skills-project │
│ ✓ ready       │ ci-status                │ Check the CI pipeline status for the current      │ agents-skills-project │
│ ✓ ready       │ cloudflared              │ Start or explain a Cloudflared tunnel for a       │ agents-skills-project │
│ ✓ ready       │ compact-handoff          │ Generate exactly two ready-to-paste prompts from  │ agents-skills-project │
│ ✓ ready       │ council                  │ Compare independent perspectives on a bounded     │ agents-skills-project │
│ ✓ ready       │ delegate                 │ TRIGGER when: asked to "delegate this", "run      │ agents-skills-project │
│ ✓ ready       │ escalate                 │ Deliver a human-addressed escalation from an      │ agents-skills-project │
│ ✓ ready       │ git                      │ AGRO git workflow: issues, branches, commits, PR  │ agents-skills-project │
│ ✓ ready       │ health-check             │ Triage memory, swap, disk and CPU where you are   │ agents-skills-project │
│ ✓ ready       │ herdr                    │ Drive the Herdr terminal workspace manager from   │ agents-skills-project │
│ ✓ ready       │ prd                      │ Write or revise a repository-grounded plan for    │ agents-skills-project │
│ ✓ ready       │ prompt-miner             │ Rank past prompts by session outcome and mine     │ agents-skills-project │
│ ✓ ready       │ release                  │ Release a validated AGRO commit by pushing it to  │ agents-skills-project │
│ ✓ ready       │ remote-sandbox           │ Test AGRO on a new provider VM with one command.  │ agents-skills-project │
│ ✓ ready       │ ste                      │ Write and rewrite technical prose in Simplified   │ agents-skills-project │
│ ✓ ready       │ supervisor               │ Supervise, babysit, watch, or drive advisor       │ agents-skills-project │
│ ✓ ready       │ t3                       │ Start, inspect, pair, or stop T3 Code in the      │ agents-skills-project │
│ ✓ ready       │ typesafe-ai              │ Build AI-powered software with TypeSafe: small    │ agents-skills-project │
│ ✓ ready       │ worktrees                │ Manage .worktrees/ lifecycle: create worktree,    │ agents-skills-project │
exit=0
RESULT D3-agro-skills-visible PASS 22 of 22 .agro/skills through .agents/skills
$ export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw; openclaw agents list 2>&1 | head -20
Agents:
- main (default)
  Workspace: ~/harness
  Agent dir: ~/harness/.openclaw/agents/main/agent
  Routing rules: 0
  Routing: default (no explicit rules)
Routing rules map channel/account/peer to an agent. Use --bindings for full rules.
Channel status reflects local config/creds. For live health: openclaw channels status --probe.
exit=0
$ export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw; timeout 90 openclaw doctor --non-interactive </dev/null 2>&1 | grep -i -E 'workspace|agents.md|bootstrap|skill|context' | head -25
◇  Skills ─────────────────────────────────────────────────────────────────╮
│  28 allowed skills are not usable in this environment (missing           │
│  Disable unused skills: openclaw doctor --fix                            │
│  Inspect details: openclaw skills check --agent <id> or openclaw skills  │
◇  Workspace ────────────────────────────────────────────────────────────────────────────╮
│  Memory system not found in workspace.                                                 │
exit=0
== E onboard without credentials
$ export OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw; timeout 180 openclaw onboard --non-interactive --accept-risk --mode local --auth-choice skip --workspace /home/sandbox/harness --no-install-daemon --skip-channels --skip-health --skip-ui --skip-search --skip-skills --skip-hooks --gateway-bind loopback </dev/null 2>&1 | tail -6
Workspace OK: ~/harness
Sessions OK: ~/harness/.openclaw/agents/main/sessions
Updated config: ~/harness/.openclaw/openclaw.json
  Backup: ~/harness/.openclaw/openclaw.json.bak
Tip: run `openclaw configure --section web` to store your Brave API key for web_search. Docs: https://docs.openclaw.ai/tools/web
exit=0
$ git status --porcelain; echo porcelain_lines=$(git status --porcelain | wc -l); ls SOUL.md IDENTITY.md USER.md BOOTSTRAP.md 2>&1
porcelain_lines=0
ls: cannot access 'SOUL.md': No such file or directory
ls: cannot access 'IDENTITY.md': No such file or directory
ls: cannot access 'USER.md': No such file or directory
ls: cannot access 'BOOTSTRAP.md': No such file or directory
exit=2
RESULT E1-checkout-clean-after-onboard PASS 
== F gateway
$ agro gateway openclaw
[gateway] starting client-openclaw …
[gateway] client-openclaw started
[gateway] attach with:  tmux attach -t client-openclaw
exit=0
00:38:57 [gateway] ready
RESULT F1-gateway-ready PASS 
$ agro gateway status
  · client-slack-pi  stopped   (gateway pi)
  · client-slack-hermes  stopped   (gateway hermes)
  ✓ client-openclaw  healthy   (tmux attach -t client-openclaw)
exit=0
$ ss -ltn | grep 18789
LISTEN 0      0          127.0.0.1:18789      0.0.0.0:*   
LISTEN 0      0              [::1]:18789            *:*   
exit=0
$ agro gateway openclaw --stop; tmux ls 2>&1 | head -1
[gateway] stopped client-openclaw
no server running on /tmp/tmux-1000/default
exit=0
== G host view of the same checkout
$ git -C /home/exedev/.agro/workspaces/harness status --porcelain
exit=0 lines=0
$ ls -A /home/exedev/.agro/workspaces/harness/.openclaw
agents
cache
config-journal-fingerprint.key
migration
openclaw.json
openclaw.json.bak
openclaw.json.bak.1
openclaw.json.bak.2
openclaw.json.bak.3
plugin-skills
== H conflict refusal
$ OPENCLAW_STATE_DIR=/tmp/foreign agro harness install openclaw
[openclaw] conflicting OPENCLAW_STATE_DIR=/tmp/foreign; selected workspace state directory is /home/sandbox/harness/.openclaw.
[openclaw] select the workspace state directory before retrying: OPENCLAW_STATE_DIR=/home/sandbox/harness/.openclaw
[openclaw] No state is migrated.
exit=1
RESULT H1-conflict-refused PASS 
== I uninstall
$ agro harness uninstall openclaw; command -v openclaw || echo openclaw-absent
removing OpenClaw from /home/sandbox/.local…

removed 489 packages in 1s
openclaw: removed from /home/sandbox/.local
openclaw-absent
exit=0
fails=0
SUMMARY
== destroy agro-mx-1009-013612
1 VM deleted successfully
remaining agro-matrix resources on exedev: 1
RUN DONE
```
