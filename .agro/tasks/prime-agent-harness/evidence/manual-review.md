# Prime Agent manual review

Story US-004, task prime-agent-harness, issue #1500.

## A. exe.dev branch run

Prerequisites: the operator approved the run. The remote branch `feat/1500-prime-agent-harness` holds US-001 at `59bb8618`. The task branch holds the check as `18ac334c` and `0eaadeae`. Runs on the host of this sandbox, remote VM.

- Provider: exedev
- VM name: agro-mx-1021-222542
- Date: 2026-10-22T04:25:42Z (run log header, UTC)
- Build under test: `install=release agro_js=release sandbox_image=cli default agro_ref=feat/1500-prime-agent-harness vm_image=provider default`
- VM environment: `Ubuntu 24.04.5 LTS kernel=6.12.113 arch=x86_64 user=exedev`, Docker 29.1.3. The check ran in host mode.
- Log path: `/tmp/claude-1000/-home-sandbox-harness/c599b61c-ea1d-4d5b-ba7e-df673f363980/scratchpad/rs/exedev-prime-agent-branch-20261021-222542.log`

1. Start the driver detached in the tmux session `rs-prime-branch`:

   ```bash
   AGRO_REF=feat/1500-prime-agent-harness bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/prime-agent-harness/checks/prime-agent-branch.sh
   ```

   Output:

   ```text
   RESULT M1-branch-cli PASS ref=feat/1500-prime-agent-harness@59bb861 agro=/home/exedev/.agro-branch/bin/agro version=0.25.0
   RESULT M2-sandbox PASS rc=0 health=healthy bootstrap=ready secs=87
   RESULT M3-install PASS before: command -v rc=1; ran 'agro harness install prime-agent' as sandbox rc=0
   RESULT M4-version PASS 0.10.0
   RESULT M5-discovery PASS prompt rc=0 names /home/sandbox/harness/AGENTS.md and /home/sandbox/harness/.agents/skills/prd/SKILL.md
   RESULT M6-clean PASS git status --porcelain unchanged (0 lines)
   RESULT M7-uninstall PASS 'agro harness uninstall prime-agent' rc=0; command -v rc=1
   RESULT M8-state-kept PASS /home/sandbox/.prime/agent present after uninstall
   SUMMARY fails=0
   ```

   The `prime-agent prompt` command exited 0 and printed 58332 bytes. Row M3 ran the plain verb. The check did not use `AGRO_EXECUTION_TARGET=local`.

2. Cleanup. The check destroyed the sandbox, and the driver destroyed the VM:

   ```text
   == destroy
       |  Network agro-prime_default  Removed
       |  Volume agro-prime_workspace  Removed
       | removed the sandbox entry /home/exedev/.agro/sandboxes/agro-prime
   SUMMARY fails=0
   == destroy agro-mx-1021-222542
   1 VM deleted successfully
   remaining agro-matrix resources on exedev: 0
   RUN DONE
   ```

   The driver forwards only `INSTALL_URL`, `AGRO_JS_URL`, `SANDBOX_IMAGE`, and `AGRO_REF` to the VM. The run carried no API key, token, or `.env` file into the VM.

## B. Local transcript

Prerequisites: a checkout of the task branch. Runs in this sandbox, local. The advisor observed each command. The operator did the sign-in in step 6.

1. Confirm the clean start:

   ```bash
   command -v prime-agent
   ls -d ~/.prime
   ```

   `command -v prime-agent` printed nothing. Exit status: 1. `ls -d ~/.prime` printed "No such file or directory". Exit status: 2.

2. Build the task-branch CLI:

   ```bash
   npm --prefix .agro/cli run build
   node .agro/cli/dist/agro.js --version
   ```

   The build exit status: 0. Output of the version command: `0.25.0`.

3. Install Prime Agent with the task-branch CLI:

   ```bash
   node .agro/cli/dist/agro.js harness install prime-agent
   prime-agent --version
   ```

   Output of the install command:

   ```text
   ✓ Downloaded (21.6 MB)
   ✓ Verified
   ✓ Installed
   ✓ Kernel ready
   prime-agent: installed — see https://github.com/mifunedev/agro/blob/main/docs/harnesses/prime-agent.md for authentication
   ```

   Exit status: 0. Output of `prime-agent --version`: `0.10.0`. Exit status: 0.

4. Start Prime Agent in a Herdr pane. The last command closes the pane:

   ```bash
   herdr agent start prime --cwd /home/sandbox/harness --no-focus -- prime-agent
   herdr agent list
   herdr pane close w1:p4S
   ```

   The start command printed `agent_started` for the pane `w1:p4S`. Exit status: 0. `herdr agent list` printed the row `w1:p4S	prime-agent	idle`. `herdr pane close w1:p4S` printed `ok`. After the close, `herdr agent list` did not name the pane.

5. Confirm that the install changed no tracked file:

   ```bash
   git status --porcelain
   ```

   In the task worktree the command printed nothing. The status of the main checkout did not change from the status before the run. The main checkout status shows only the operator edits that existed before the run.

6. Sign in. The operator signed in with a ChatGPT subscription through `/login` in the Herdr pane `w1:p4T`. The advisor did not see the credential and did not handle it. Prime Agent wrote `auth.json` in `~/.prime/agent`.

7. Failure path. Run a prompt without `--provider` and `--model`:

   ```bash
   prime-agent -p "<prompt asking to use the prd skill, read its SKILL.md, and reply with the absolute path and the name field>"
   ```

   Output: `Codex error: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.` Exit status: 1.

8. Run the same prompt with a supported model:

   ```bash
   prime-agent model list
   prime-agent -p "<prompt asking to use the prd skill, read its SKILL.md, and reply with the absolute path and the name field>" --provider openai-codex --model gpt-6.1-sol
   ```

   `prime-agent model list` printed `openai-codex  gpt-6.1-sol`. The prompt printed `/home/sandbox/harness/.agents/skills/prd/SKILL.md` and `prd`. Exit status: 0.

9. Cleanup. Close the sign-in pane and stop the background services:

   ```bash
   herdr pane close w1:p4T
   prime-agent shutdown
   ```

   `herdr pane close w1:p4T` printed `ok`. `prime-agent shutdown` printed `No background services found.`

10. Cleanup. Uninstall Prime Agent:

    ```bash
    node .agro/cli/dist/agro.js harness uninstall prime-agent
    command -v prime-agent
    ls -d ~/.prime/agent
    ```

    The uninstall printed `prime-agent: removed from /home/sandbox/.local`. Exit status: 0. `command -v prime-agent` exit status: 1. `ls -d ~/.prime/agent` printed the directory. Exit status: 0.

11. Cleanup. The operator ran `rm -rf ~/.prime`. Then the advisor ran `ls -d ~/.prime`. Output: "No such file or directory". Exit status: 2.

No transcript in this file shows an API key value or a credential value.

## Finding

After the ChatGPT sign-in, the interactive pane `w1:p4T` showed the model `gpt-6.1-sol`. The headless `prime-agent -p` run without `--provider` and `--model` failed with `Codex error: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.` The same prompt passed with `--provider openai-codex --model gpt-6.1-sol`. The cause of the difference is not known. For example, `-p` possibly does not read a model selection. The operator deleted `~/.prime` after the run, so the advisor could not examine the cause.
