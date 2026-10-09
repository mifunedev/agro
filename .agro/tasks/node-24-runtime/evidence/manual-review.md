# Manual review: Node 24 runtime

Task: `.agro/tasks/node-24-runtime/`. Issue: #1361. Branch: `task/1361-node-24-runtime`.
The advisor ran each command below on 2026-10-09 against the integrated task branch.
The operator authorized local Docker builds and an exe.dev run for installation checks.

## 1. Image build and image check

```text
$ docker build -f .devcontainer/Dockerfile -t agro-node24-accept:test .
exit=0
$ bash .agro/scripts/verify-sandbox-image.sh agro-node24-accept:test
ok: no harness is baked into the image (claude-code codex pi opencode grok-build hermes muse-code antigravity-cli fx t3code )
ok: no installable tool is baked into the image (agent-browser herdr cloudflared microsandbox tailscale code-server docker-engine desktop )
ok: every baked-in tool is present (docker-cli gh )
verify-sandbox-image: all checks passed for agro-node24-accept:test
exit=0
```

Failure path. The published Node 22 image fails the check:

```text
$ bash .agro/scripts/verify-sandbox-image.sh ghcr.io/mifunedev/agro:latest
FAIL: node major is not 24: v22.23.3
exit=1
```

## 2. pnpm parity on both Debian suites

```text
$ bash .agro/scripts/node-pnpm-parity.sh
node:24-bookworm-slim    node v24.21.0  pnpm 10.33.0
node:24-trixie-slim      node v24.21.0  pnpm 10.33.0
PARITY: node:24-bookworm-slim and node:24-trixie-slim report identical node and pnpm versions
exit=0
```

## 3. Full suite inside the rebuilt sandbox image

The advisor streamed a fresh clone of the task branch at `48e7581a` into the image as user `sandbox`.

```text
$ node --version
v24.21.0
$ pnpm install --frozen-lockfile
install=0
$ npm --prefix .agro/cli run typecheck
typecheck=0
$ pnpm test
test=0
 Test Files  89 passed (89)
      Tests  1928 passed (1928)
```

The first run of this step failed 6 tests in `.agro/scripts/__tests__/verify-sandbox-image.test.ts`. The fixtures still expected Node 22. The advisor reopened US-001. Commit `48e7581a` fixed the fixtures, and the rerun above passed.

## 4. Upgrade smoke: Node 22 volume to Node 24 image

```text
$ bash .agro/scripts/sandbox-upgrade-smoke.sh
step 1/7: pull ghcr.io/mifunedev/agro:latest (extraction source only — its entrypoint is never run; see the header comment for why)
step 2/7: seed workspace volume agro-upgrade-415722_workspace from ghcr.io/mifunedev/agro:latest's real /opt/agro-seed, plus synthetic canary state
step 3/7: assert the seeded volume's preconditions, before any boot
step 4/7: install the npm harnesses into agro-upgrade-415722_workspace with ghcr.io/mifunedev/agro:latest's node
installing claude-code with ghcr.io/mifunedev/agro:latest's node v22.23.3: npm --prefix /home/sandbox/.local install -g @anthropic-ai/claude-code
installing codex with ghcr.io/mifunedev/agro:latest's node v22.23.3: npm --prefix /home/sandbox/.local install -g @openai/codex
installing pi with ghcr.io/mifunedev/agro:latest's node v22.23.3: npm --prefix /home/sandbox/.local install -g --ignore-scripts @earendil-works/pi-coding-agent
installing opencode with ghcr.io/mifunedev/agro:latest's node v22.23.3: npm --prefix /home/sandbox/.local install -g opencode-ai
step 5/7: docker build -f .devcontainer/Dockerfile -t agro-upgrade-smoke:415722 /home/sandbox/harness/.worktrees/task/1361-node-24-runtime
step 6/7: boot agro-upgrade-smoke:415722 against the seeded volume agro-upgrade-415722_workspace — the only boot this smoke performs
step 7/7: assert state survived
npm harnesses after upgrade on agro-upgrade-smoke:415722's node v24.21.0
HARNESS claude-code exit=0 2.1.295 (Claude Code)
HARNESS codex exit=0 codex-cli 0.162.0
HARNESS pi exit=0 1.1.0
HARNESS opencode exit=0 1.18.35
tearing down compose project agro-upgrade-415722 (down -v)
PASS: a workspace volume seeded from ghcr.io/mifunedev/agro:latest's .agro layout survived the upgrade to agro-upgrade-smoke:415722
smoke=0
```

## 5. Fresh host install offers Node 24

exe.dev VM, Ubuntu 24.04.5 LTS, `INSTALL_URL` at commit `2b668b66`:

```text
$ bash .agro/skills/remote-sandbox/scripts/run.sh exedev
== exedev agro-mx-1009-003441 check=fresh-install.sh image=default date=2026-10-09T06:34:41Z
TIMING create_return_s=1.5 first_shell_s=2.2
build under test: install=https://raw.githubusercontent.com/mifunedev/agro/2b668b66dd42aa388ff81b1145afea730595a525/.agro/scripts/install.sh agro_js=release sandbox_image=cli default agro_ref=default branch vm_image=provider default
started
== fresh install from https://raw.githubusercontent.com/mifunedev/agro/2b668b66dd42aa388ff81b1145afea730595a525/.agro/scripts/install.sh on Ubuntu 24.04.5 LTS, node before: none
install exit=0
WARN: Node.js not found (need >= 20 to run 'agro')
 ✓  Pinned the 'agro' shebang to /home/exedev/.local/share/agro/node -> /home/exedev/.nvm/versions/node/v24.21.0/bin/node
 ✓  Installed /home/exedev/.local/bin/agro
 ✓  agro 0.18.1
RESULT F1-new-login-shell PASS rc=0 0.18.1
RESULT F2-new-interactive-shell PASS rc=0 0.18.1
RESULT F3-absolute-path PASS rc=0 0.18.1
RESULT F4-empty-environment PASS rc=0 0.18.1
shebang: #!/home/exedev/.local/share/agro/node
SUMMARY
== destroy agro-mx-1009-003441
1 VM deleted successfully
remaining agro-matrix resources on exedev: 0
RUN DONE
```

The first exe.dev run did not create a VM, because the account had no plan:

```text
== exedev agro-mx-1009-001416 check=fresh-install.sh image=default date=2026-10-09T06:14:16Z
{"error":"Choose a plan to start creating VMs.\nGet started at https://exe.dev/billing/update"}
RESULT R13-time-to-shell FAIL no shell
== destroy agro-mx-1009-001416
VM "agro-mx-1009-001416" not found
remaining agro-matrix resources on exedev: 0
RUN DONE
```

The advisor ran the same check script, `.agro/skills/remote-sandbox/checks/fresh-install.sh`, in a clean `debian:trixie-slim` container with no Node. `INSTALL_URL` pointed at `install.sh` at commit `3a127330`:

```text
== fresh install from https://raw.githubusercontent.com/mifunedev/agro/3a127330a9269b51e812570957ad4a79aa91734b/.agro/scripts/install.sh on Debian GNU/Linux 13 (trixie), node before: none
install exit=0
WARN: Node.js not found (need >= 20 to run 'agro')
 ✓  Pinned the 'agro' shebang to /home/probe/.local/share/agro/node -> /home/probe/.nvm/versions/node/v24.21.0/bin/node
 ✓  Installed /home/probe/.local/bin/agro
 ✓  agro 0.18.1
RESULT F1-new-login-shell PASS rc=0 0.18.1
RESULT F2-new-interactive-shell FAIL rc=127 
RESULT F3-absolute-path PASS rc=0 0.18.1
RESULT F4-empty-environment PASS rc=0 0.18.1
shebang: #!/home/probe/.local/share/agro/node
WARN: Node.js not found (need >= 20 to run 'agro')
  Install nvm + Node 24 now? [Y/n]: main: line 45: /dev/tty: No such device or address
==> Installing nvm + Node 24
Downloading and installing node v24.21.0...
v24.21.0
```

`F2-new-interactive-shell` fails only in the container. The released installer fails the same way there. F2 passes on the exe.dev VM:

```text
 ✓  Pinned the 'agro' shebang to /home/probe/.local/share/agro/node -> /home/probe/.nvm/versions/node/v22.23.3/bin/node
RESULT F2-new-interactive-shell FAIL rc=127 
bash: agro: command not found
```

## 6. Cleanup

```text
$ docker rmi agro-node24-accept:test
rmi-ok
$ docker ps -a --filter name=agro-upgrade -q | wc -l
0
$ docker volume ls --filter name=agro-upgrade -q | wc -l
0
$ docker ps -a --filter name=agro-fresh-install -q | wc -l
0
remaining agro-matrix resources on exedev: 0
```

The pulled base images `node:24-bookworm-slim`, `node:24-trixie-slim`, `debian:trixie-slim`, and `ghcr.io/mifunedev/agro:latest` stay in the Docker host cache.
