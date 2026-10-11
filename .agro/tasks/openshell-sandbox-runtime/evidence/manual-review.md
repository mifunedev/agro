# Manual review evidence: OpenShell sandbox runtime

This file holds the live run of 2026-09-28. The operator ran each step. The advisor copied each expected result from the observed output.

## Environment

- Host: `legion-laptop`, a WSL 2 distro with Docker Desktop. Upstream labels this platform Experimental.
- OpenShell: `openshell 0.1.2`. The gateway `openshell` at `https://127.0.0.1:17670` reported `"status": "connected"`.
- Image: `agro:openshell-review`, built from task branch commit `ebd714af`.
- CLI: `.agro/cli/dist/agro.js`, built from the same commit and copied to the host as `~/agro-review.js`.
- Registry: `AGRO_HOME=~/.agro-review`. `SANDBOX_NAME` was unset.

## A. Gateway check

Prerequisites: OpenShell 0.1.2 installed on the host. Runs on the host, local.

```bash
openshell --version
openshell status -o json
```

Output: `openshell 0.1.2`, then JSON with `"status": "connected"` and `"version": "0.1.2"`. Exit status: 0 for each command.

## B. Failure path: gateway stopped

Prerequisites: step A. Runs on the host, local.

```bash
systemctl --user stop openshell-gateway
node ~/agro-review.js sandbox install openshell --name os-review --image=agro:openshell-review --yes
```

Output:

```text
agro sandbox install: the OpenShell gateway is not connected; start the local gateway and register it:
  systemctl --user restart openshell-gateway
  openshell gateway add https://127.0.0.1:17670 --local --name openshell
then confirm with: openshell status
```

Exit status: 1. After `systemctl --user start openshell-gateway`, `openshell status -o json` reported `"status": "connected"` with exit status 0.

## C. Refusal: `--checkout`

Prerequisites: step A. Runs on the host, local.

```bash
node ~/agro-review.js sandbox install openshell --name os-review --checkout . --yes
```

Output: `agro sandbox install: --checkout is not supported on the openshell runtime`. Exit status: 1.

## D. Preview

Prerequisites: step A. Runs on the host, local.

```bash
node ~/agro-review.js sandbox install openshell --name os-review --image=agro:openshell-review --yes --print-argv
node ~/agro-review.js sandbox list
```

Output:

```text
openshell sandbox create --name os-review --from agro:openshell-review --policy /home/ryaneggz/.agro-review/sandboxes/os-review/openshell-policy.yaml --env AGRO_EXECUTION_TARGET=local --env SANDBOX_NAME=os-review --detach -- /usr/local/bin/openshell-main.sh
no sandbox is registered in /home/ryaneggz/.agro-review/sandboxes — create one with `agro sandbox install docker`
```

Exit status: 0 for each command. The preview wrote no registry entry.

## E. Install on WSL 2 with Docker Desktop

Prerequisites: step A. Runs on the host, local.

```bash
node ~/agro-review.js sandbox install openshell --name os-review --image=agro:openshell-review --yes
```

Output, trimmed:

```text
Created sandbox: os-review
[0.0s] Image already present
[0.2s] Starting sandbox Container created
Error:   × sandbox entered error phase while provisioning: ControlSupervisorStartFailed:
  │ Docker supervisor exited before becoming ready; log tail: openshell: log push
  │ connect failed: failed to connect to OpenShell server
  │ Error:   × Startup configuration fetch failed after 5 attempts: failed to
  │ connect to OpenShell server
agro sandbox install: openshell sandbox create os-review exited 1
```

Exit status: 1. The OpenShell supervisor runs with host networking. On Docker Desktop, that network is the Docker Desktop VM, not the WSL distro where the gateway listens on `127.0.0.1`.

Follow-up on the host:

```bash
openshell sandbox delete os-review
node ~/agro-review.js sandbox list
```

Output of the second command, with exit status 0:

```text
no sandbox is registered in /home/ryaneggz/.agro-review/sandboxes — create one with `agro sandbox install docker`
```

The CLI removed its registry entry after the failed create.

## F. Linux validation on exe.dev with `0.20.0-rc.2`

The advisor ran the `remote-sandbox` driver on 2026-10-10 with operator approval. The driver created a new exe.dev VM, ran `checks/openshell-journey.sh`, and destroyed the VM. The trimmed log is [`exedev-openshell-journey-0.20.0-rc.2.log`](exedev-openshell-journey-0.20.0-rc.2.log).

Prerequisites: an exe.dev account key on the driver host. Runs on the driver host. The check runs in the remote VM.

```bash
R=https://github.com/mifunedev/agro/releases/download/v0.20.0-rc.2
INSTALL_URL=$R/install.sh AGRO_JS_URL=$R/agro.js bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/openshell-journey.sh
```

Host: Ubuntu 24.04.5 LTS, kernel 6.12.93, LSM `capability,landlock,selinux`, Docker 29.1.3, OpenShell 0.1.2.

Observed results:

- Each of the 26 `RESULT` lines reports `PASS`: rows O01 to O17, the six O18 refusals, and O19 to O21.
- O07: `agro sandbox install openshell --name os-review --yes` exited 0 after 13 seconds and printed `next: agro shell os-review`.
- Workload environment: `HOME=/home/sandbox` in an exec session, a `--no-login-shell` session, `bash -l`, and `zsh -l`. `PATH` starts with `/home/sandbox/.local/bin`.
- O10: `agro shell os-review` printed `ID=sandbox DIR=/home/sandbox/harness` and showed no zsh first-run menu.
- O16: `zsh -lc 'claude --version'` printed `2.1.296 (Claude Code)`.
- O17: Claude Code printed `Invalid API key · Fix external API key`, and `openshell logs` showed no denial for `api.anthropic.com`.
- The log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.

Earlier exe.dev runs on the same day found the defects that commit `4bdbc1db` fixes. OpenShell set `HOME` to the image working directory and gave exec sessions no image environment. As a result, zsh opened its first-run menu and `claude` was not on `PATH`.

## G. Claude Code sign-in on exe.dev with `0.20.0-rc.2`

The advisor prepared the kept VM `agro-mx-1010-223139` on 2026-10-10 with operator approval. The VM held `agro` 0.20.0-rc.2, OpenShell 0.1.2, the sandbox `os-review` with status `ready`, and Claude Code 2.1.296. The operator signed in from `agro shell os-review`.

1. First attempt. The operator ran `claude` in the sandbox. Observed output:

   ```text
   Unable to connect to Anthropic services
   Failed to connect to platform.claude.com: ECONNREFUSED
   ```

   The OpenShell log on the VM showed:

   ```text
   /home/sandbox/.local/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe(0) -> platform.claude.com:443 [reason:transparent_tcp_policy_denied]
   ```

2. Fix. The advisor added a `platform.claude.com` endpoint to the live `anthropic` rule with `openshell policy set os-review --policy <file> --wait`. Observed output: `Policy version 2 loaded (active version: 2)`. Commit `a3bdac4a` adds the same endpoint to `.devcontainer/openshell-policy.yaml`.

3. Second attempt. The operator signed in, and Claude Code answered a prompt. The operator reported the result in the chat.

4. Other denied requests from `claude.exe` after the fix: `mcp-proxy.anthropic.com` (claude.ai connectors), `raw.githubusercontent.com`, and `http-intake.logs.us5.datadoghq.com`. The default policy denies these hosts by design.

5. Cleanup. The advisor deleted the VM with `ssh exe.dev rm agro-mx-1010-223139`. The count of `agro-matrix` VMs was 0.

## Not run

The failed create in step E stopped the run. The operator decided on 2026-09-28 to ship the runtime as experimental. Steps F and G cover each check below except an authenticated `git push`. The operator did not run the GitHub sign-in before the advisor deleted the VM:

- A successful `agro sandbox install openshell` and `agro sandbox list` status `ready`.
- `whoami` and `pwd` inside `agro shell <name>`.
- `git ls-remote`, `npm view`, and the denied `curl -sS https://example.com`.
- `gh auth login`, `git push --dry-run`, the Claude Code sign-in, and `claude -p 'reply with OK'`.
- The observed `<claude login hosts>`.
- The refusals of `stop`, `restart`, `logs`, `ps`, `compose config`, and `sandbox upgrade` against a live entry.
- `agro destroy <name>` and the empty lists after cleanup.
- The failed-create cleanup hint from commit `a00a9859`. The live run used the earlier build `ebd714af`.
