# Prime Agent exe.dev validation

Story US-003, task prime-agent-harness, issue #1500.

## Run header

- Provider: exedev
- VM name: agro-mx-1021-221857
- Image: `ghcr.io/mifunedev/agro:latest`
- Date: 2026-10-22T04:18:57Z (run log header, UTC)
- Build under test: `install=release agro_js=release sandbox_image=cli default agro_ref=default branch vm_image=ghcr.io/mifunedev/agro:latest`
- Log path: `/tmp/claude-1000/-home-sandbox-harness/c599b61c-ea1d-4d5b-ba7e-df673f363980/scratchpad/rs/exedev-prime-agent-harness-20261021-221857.log`
- Driver command, started detached in a named tmux session:

```bash
IMAGE=ghcr.io/mifunedev/agro:latest bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/prime-agent-harness/checks/prime-agent-harness.sh
```

The check ran in image mode as `root`. The `agro-bootstrap` service was `active` before row P0.

## Result lines

```text
RESULT P0-workspace PASS .agents/skills -> /home/sandbox/harness/.agro/skills
RESULT P1-install PASS rc=0 version=0.10.0 prefix=/home/sandbox/.local
RESULT P2-version PASS 0.10.0 
RESULT P3-binary PASS /home/sandbox/.local/bin/prime-agent
RESULT P4-instructions PASS prompt names /home/sandbox/harness/AGENTS.md
RESULT P5-skills PASS prompt names /home/sandbox/harness/.agents/skills/prd/SKILL.md
RESULT P6-clean PASS no path under /home/sandbox/harness newer than /tmp/prime-agent-harness/before-install.marker
RESULT P7-uninstall PASS command -v prime-agent rc=1
SUMMARY fails=0
```

The `prime-agent prompt` command exited 0 and printed 58332 bytes.

## Destroy step

```text
== destroy agro-mx-1021-221857
1 VM deleted successfully
remaining agro-matrix resources on exedev: 0
RUN DONE
```

## Run 1

- VM name: agro-mx-1021-215949
- Date: 2026-10-22T03:59:49Z (run log header, UTC)
- Log path: `/tmp/claude-1000/-home-sandbox-harness/c599b61c-ea1d-4d5b-ba7e-df673f363980/scratchpad/rs/exedev-prime-agent-harness-20261021-215949.log`

Rows P0 to P5 and P7 passed. Row P6 failed:

```text
RESULT P6-clean FAIL before rc=128 after rc=128 diff: 
SUMMARY fails=1
```

The P6 row compared `git -C /home/sandbox/harness status --porcelain` before and after the install. Both commands exited 128, because the image-seed workspace is not a git repository. The fx evidence records the same workspace state. The advisor changed the P6 criterion to a marker check. The check creates a marker under `/tmp/prime-agent-harness` before row P1. Row P6 passes when `find /home/sandbox/harness -newer <marker>` prints no path. Commits ff4479bd and 6457398a hold the change.

The driver destroyed the run 1 VM. The log records `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.
