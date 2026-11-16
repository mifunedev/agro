# US-003: CLI integration review

## Prerequisites and location

The reviewer needs this worktree, Docker, a working `agro run`, and npm registry access.
Run the command from the host repository root.
All installation and runtime checks execute inside one disposable sandbox.
The script needs no model credentials, model calls, env files, or persistent services.

## Commands

1. Run the reusable review script:

   ```bash
   cd /home/exedev/.agro/workspaces/harness
   agro run -- bash /home/exedev/.agro/workspaces/harness/.worktrees/feat/1616-pi-ask-user-question/.agro/tasks/pi-ask-user-question/evidence/manual-review.sh
   ```

   The script asserts that its installation input path does not exist before creating the project.
   It reads the selected package spec from this worktree's `.pi/settings.json`.
   It requires exactly `npm:@juicesharp/rpiv-ask-user-question@2.15.0`.
   Each child command receives these inline environment values:

   ```bash
   HOME="$root/home" PI_CODING_AGENT_DIR="$root/agent" npm_config_cache="$root/npm-cache" npm_config_ignore_scripts=true PI_OFFLINE=1
   ```

2. Inspect the installation and package-list commands printed by the script:

   ```bash
   npm install --prefix "$root" --ignore-scripts --no-audit --no-fund @earendil-works/pi-coding-agent@1.5.2
   "$root/node_modules/.bin/pi" --version
   "$root/node_modules/.bin/pi" install --local "$spec" --approve
   "$root/node_modules/.bin/pi" list --approve
   ```

   The Pi commands run from `$root/project`.
   `--approve` grants project trust for each command.
   The script installs only the selected package, not the other worktree package pins.
   The CLI installs the package under `$root/project/.pi/npm/node_modules/`.
   The script checks the real source path, package name, and version.
   It symlinks only that package into `$root/node_modules/@juicesharp/` for the existing probe.
   Pi's host dependencies remain in the shared temporary installation root.

## Observed output and exits

The reproduction command exited 0 twice.
The first run removed `/tmp/agro-question-review.YvYvMH` with cleanup exit 0.
The captured rerun used `/tmp/agro-question-review.CDkRhd/install` as `$root`.
The blocks below retain command outputs and exits in execution order.
The script prints the complete commands, including assertion expressions.

### Setup, versions, and npm installation

```text
PASS fresh input absent: /tmp/agro-question-review.CDkRhd/install
PASS selected worktree pin: npm:@juicesharp/rpiv-ask-user-question@2.15.0

COMMAND node --version
v24.22.1
EXIT 0

COMMAND npm --version
11.19.1
EXIT 0

COMMAND npm install --prefix /tmp/agro-question-review.CDkRhd/install --ignore-scripts --no-audit --no-fund @earendil-works/pi-coding-agent@1.5.2
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 123 packages in 13s
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.2
npm notice To update run: npm install -g npm@12.2.2
npm notice
EXIT 0

COMMAND /tmp/agro-question-review.CDkRhd/install/node_modules/.bin/pi --version
1.5.2
EXIT 0
```

### Real CLI installation and listing

```text
COMMAND /tmp/agro-question-review.CDkRhd/install/node_modules/.bin/pi install --local npm:@juicesharp/rpiv-ask-user-question@2.15.0 --approve
Installing npm:@juicesharp/rpiv-ask-user-question@2.15.0...

added 2 packages in 790ms
Installed npm:@juicesharp/rpiv-ask-user-question@2.15.0
EXIT 0

COMMAND /tmp/agro-question-review.CDkRhd/install/node_modules/.bin/pi list --approve
Project packages:
  npm:@juicesharp/rpiv-ask-user-question@2.15.0
    /tmp/agro-question-review.CDkRhd/install/project/.pi/npm/node_modules/@juicesharp/rpiv-ask-user-question
EXIT 0

PASS local settings contain only selected pin
EXIT 0
PASS CLI-installed source /tmp/agro-question-review.CDkRhd/install/project/.pi/npm/node_modules/@juicesharp/rpiv-ask-user-question version 2.15.0
EXIT 0
```

### Fresh runtime probe

Command inside the sandbox, with the inline environment above:

```bash
node "$evidence/probe.mjs" "$root"
```

```text
{"node":"v24.22.1","piVersion":"1.5.2","packageVersion":"2.15.0"}
PASS manifest discovery + real extension loader + tool and reconciler registration
PASS structured option answer {"answers":[{"questionIndex":0,"question":"Which environment?","kind":"option","answer":"Staging"}],"cancelled":false}
PASS structured custom answer {"answers":[{"questionIndex":0,"question":"Which environment?","kind":"custom","answer":"Preview environment"}],"cancelled":false}
PASS dialog cancellation {"answers":[],"cancelled":true}
PASS no-UI removal, idempotence, execution backstop, RPC restoration and sibling preservation
PASS all checks; no session prompt or model API invoked
CLEANUP probe scratch removed; caller owns installation-root cleanup
EXIT 0
```

The probe uses Pi's real extension loader and the registered package tool and lifecycle handler.
Deterministic host stubs supply dialog answers and active-tool storage.
These checks do not verify terminal rendering, keyboard input, RPC wire transport, or a full agent-session lifecycle.
No browser evidence applies because AGRO changes package configuration, not UI implementation.

## Failure path

The script runs this command from the same fresh project, with the same inline environment:

```bash
"$root/node_modules/.bin/pi" install --local ./missing-package --approve
```

Observed output and exit:

```text
Installing ./missing-package...
Error: Path does not exist: /tmp/agro-question-review.CDkRhd/install/project/missing-package
EXIT 1
PASS expected failure exit 1
```

The script requires exit 1 and rejects unexpected success or another status.
The failure needs no network request or model call.

## Cleanup and preservation

The final settings assertion and cleanup produced:

```text
PASS local pin unchanged; no personal settings
EXIT 0
PASS manual review complete
CLEANUP /tmp/agro-question-review.CDkRhd absent; exit 0
```

The exit trap deletes the temporary parent, including the project, installation, home, agent directory, symlink, and npm cache.
The trap asserts parent absence and propagates cleanup errors or the original command error.
The probe deletes its scratch project in `finally`.

Isolated paths and bounded commands support the operator-preservation claim.
No command writes to the advisor home, active session, main `agro.json`, or worktree settings.
The worker changes only this file and `manual-review.sh`.

## Criteria and additional checks

| Criterion | Evidence |
|---|---|
| Fresh entry-point installation and listing | Executed. Real Pi CLI commands exited 0 from a fresh trusted project. |
| Fresh package loading, answers, cancellation, no UI | Executed. Existing probe against the CLI-installed source exited 0. Host stubs apply. |
| Failure output and exit | Executed. Missing local source exited 1. |
| Sandbox and inline environment | Executed. One `agro run -- bash` command; no env files or services. |
| Cleanup | Executed. Parent absence and personal-settings assertions passed. |
| Operator preservation | Reasoned. All runtime writes target the temporary root. |

Inside `agro run --`, `bash -n` against `manual-review.sh` produced no output and exited 0.
A host transcript-capture attempt used `set -o pipefail` under `sh` and exited 2 before sandbox execution:

```text
sh: 1: set: Illegal option -o pipefail
```

The corrected capture used `bash -lc` with `set -o pipefail` and `tee` to this owned evidence file.
The corrected capture exited 0.
The first STE run exited 1 with two passive-voice findings.
After the prose edits, the STE checker exited 0 with no findings.

## Surface review

| Surface | Decision |
|---|---|
| Host and sandbox | Applied. Host orchestration; sandbox installation and execution. |
| Lifecycle door | Applied. Reuse `agro run`; no lifecycle changes. |
| Canonical and provider surfaces | Applied. Task evidence under `.agro/`; no provider changes. |
| Root and scaffold | Not applicable. No configuration or scaffold changes. |
| Interactive and headless processes | Applied. Bounded CLI commands and stubbed no-UI checks; no services. |
| Local and remote operation | Applied. One disposable command; no attached persistent process. |
| Parallel operation | Applied. Assigned worktree and fresh temporary root. |
| Public documentation | Not applicable. Evidence-only story. |
| Verification | Applied. Real CLI installation and listing, existing runtime probe, failure path, cleanup, and STE. |
