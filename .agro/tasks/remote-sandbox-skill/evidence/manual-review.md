# Manual review: remote-sandbox on exe.dev

Date: 2026-10-03. Build under test: AGRO v0.16.2 from the GitHub release. Driver host: the AGRO sandbox, branch `skill/1315-remote-sandbox-skill`. The operator approved the VM spend.

## A. Fresh install

Command on the driver host:

```bash
MATRIX_OUT=<out> setsid nohup bash .agro/skills/remote-sandbox/scripts/run.sh exedev > <out>/run-fresh.out 2>&1 < /dev/null &
```

Log, without the `exe.dev new` JSON line:

```text
== exedev agro-mx-1003-164118 check=fresh-install.sh image=default date=2026-10-03T22:41:18Z
TIMING create_return_s=1.3 first_shell_s=1.9
build under test: install=release agro_js=release sandbox_image=cli default vm_image=provider default
started
== fresh install from https://github.com/mifunedev/agro/releases/latest/download/install.sh on Ubuntu 24.04.5 LTS, node before: none
install exit=0
WARN: Node.js not found (need >= 20 to run 'agro')
 ✓  Pinned the 'agro' shebang to /home/exedev/.local/share/agro/node -> /home/exedev/.nvm/versions/node/v22.23.3/bin/node
 ✓  Installed /home/exedev/.local/bin/agro
 ✓  agro 0.16.2
RESULT F1-new-login-shell PASS rc=0 0.16.2
RESULT F2-new-interactive-shell PASS rc=0 0.16.2
RESULT F3-absolute-path PASS rc=0 0.16.2
RESULT F4-empty-environment PASS rc=0 0.16.2
shebang: #!/home/exedev/.local/share/agro/node
SUMMARY
== destroy agro-mx-1003-164118
1 VM deleted successfully
remaining agro-matrix resources on exedev: 0
RUN DONE
```

## B. Hosting matrix

Command on the driver host:

```bash
MATRIX_OUT=<out> setsid nohup bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/agro-rows.sh > <out>/run-rows.out 2>&1 < /dev/null &
```

Log, `==` and `RESULT` lines and the run end:

```text
== exedev agro-mx-1003-164155 check=agro-rows.sh image=default date=2026-10-03T22:41:55Z
build under test: install=release agro_js=release sandbox_image=cli default vm_image=provider default
== mode=host user=exedev kernel=6.12.93 cgroupfs=cgroup2fs
== R13
RESULT R13-time-to-shell PASS 2.2s
== R04
RESULT R04-cgroup-delegation PASS already delegated: cpuset cpu io memory pids
== R02
RESULT R02b-noninteractive-cli PASS agro runs in a non-interactive shell
RESULT R02-workspace PASS agro 0.16.2
== R03
RESULT R03-docker-engine-host SKIPPED docker already running in base image
== R01
RESULT R01-docker PASS server=29.1.3 cgroup=2 driver=systemd
== R05
RESULT R05-sandbox-boot PASS 37s
== R06
RESULT R06-systemd PASS failed units: 
== R07
RESULT R07-container-restart PASS 3s
== R12
RESULT R12-egress-tls PASS 99987664f47c
== R14
RESULT R14-hermes-install PASS install=0
== R11 server
SUMMARY fails=0
== driver rows
RESULT R09-disconnect PASS tmux session survives the client exit
RESULT R10-ssh-inbound PASS ssh agro-mx-1003-164155.exe.xyz
RESULT R11-https-port SKIPPED proxy answers 307: private by default, needs share
== destroy agro-mx-1003-164155
remaining agro-matrix resources on exedev: 0
RUN DONE
```

## C. Comparison with the 2026-10-03 baseline

The baseline is the post-release run of `agro-host-matrix` `rows.sh` on exe.dev at 2026-10-03T20:51:03Z against v0.16.1. Every row has the same status:

| Row | Baseline | This run |
|---|---|---|
| `R01-docker` | PASS | PASS |
| `R02-workspace` | PASS | PASS |
| `R02b-noninteractive-cli` | PASS | PASS |
| `R03-docker-engine-host` | SKIPPED | SKIPPED |
| `R04-cgroup-delegation` | PASS | PASS |
| `R05-sandbox-boot` | PASS | PASS |
| `R06-systemd` | PASS | PASS |
| `R07-container-restart` | PASS | PASS |
| `R09-disconnect` | PASS | PASS |
| `R10-ssh-inbound` | PASS | PASS |
| `R11-https-port` | SKIPPED | SKIPPED |
| `R12-egress-tls` | PASS | PASS |
| `R13-time-to-shell` | PASS | PASS |
| `R14-hermes-install` | PASS | PASS |

## D. Cleanup

After both runs, `ssh exe.dev ls --json` listed 0 VMs.
