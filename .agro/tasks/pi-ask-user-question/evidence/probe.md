# US-001: Published package probe

## Scope

This evidence supports advisor review before package-registry edits.
The probe uses the published package without source changes.
The worker changed only `probe.mjs` and this evidence file.

| Surface | Decision |
|---|---|
| Host and sandbox | Applied. Host tools manage evidence and git. `agro run --` executes installation and checks inside the sandbox. |
| Lifecycle door | Not applicable. No lifecycle changes. |
| Canonical and provider surfaces | Applied. Task evidence lives under `.agro/`. No provider changes. |
| Root and scaffold | Not applicable. No configuration or scaffold changes. |
| Interactive and headless processes | Applied. Test RPC dialogs and no-UI removal without services. |
| Local and remote operation | Applied. Use one bounded command without persistent processes. |
| Parallel operation | Applied. Use the assigned worktree and isolated temporary installation. |
| Public documentation | Not applicable. This story adds task evidence only. |
| Verification | Applied. Run real package discovery and execution assertions. |

## Reproduce

Run the reproduction command from the host repository root.
The command installs fresh dependencies inside one disposable sandbox.
Pi `1.5.2` was the current published release during the initial unpinned discovery install.
The reproduction command pins that observed version.

```bash
cd /home/exedev/.agro/workspaces/harness
agro run -- bash -lc '
set -eu
root=$(mktemp -d /tmp/agro-question-probe.XXXXXX)
trap '\''rm -rf "$root"; test ! -e "$root"; printf "CLEANUP installation root absent (exit %s)\n" "$?"'\'' EXIT
HOME="$root/home" npm_config_cache="$root/npm-cache" npm install --prefix "$root" --ignore-scripts --no-audit --no-fund @earendil-works/pi-coding-agent@1.5.2 @juicesharp/rpiv-ask-user-question@2.15.0
HOME="$root/home" PI_CODING_AGENT_DIR="$root/agent" node /home/exedev/.agro/workspaces/harness/.worktrees/feat/1616-pi-ask-user-question/.agro/tasks/pi-ask-user-question/evidence/probe.mjs "$root"
'
```

The probe accepts the temporary installation root through argv or `PROBE_INSTALL_ROOT`.
Set `HOME` and `PI_CODING_AGENT_DIR` inside that root before invoking Node.
The caller owns installation-root cleanup.
The probe removes its scratch project in `finally`.

## Observed results

The reproduction command exited 0.
Node reported `v24.22.1`; npm reported `11.19.1` in the sandbox inspection.
The install added 126 packages and emitted a `node-domexception` deprecation warning.

```text
{"node":"v24.22.1","piVersion":"1.5.2","packageVersion":"2.15.0"}
PASS manifest discovery + real extension loader + tool and reconciler registration
PASS structured option answer {"answers":[{"questionIndex":0,"question":"Which environment?","kind":"option","answer":"Staging"}],"cancelled":false}
PASS structured custom answer {"answers":[{"questionIndex":0,"question":"Which environment?","kind":"custom","answer":"Preview environment"}],"cancelled":false}
PASS dialog cancellation {"answers":[],"cancelled":true}
PASS no-UI removal, idempotence, execution backstop, RPC restoration and sibling preservation
PASS all checks; no session prompt or model API invoked
CLEANUP probe scratch removed; caller owns installation-root cleanup
CLEANUP installation root absent (exit 0)
```

## Criteria and limits

| Criterion | Evidence |
|---|---|
| Fresh sandbox installation without model calls | Executed. The reproduction command exited 0 with `--ignore-scripts`. No session prompt or provider API runs. |
| Versions and load result | Executed. Pi `1.5.2` and package `2.15.0` loaded with no extension errors or warnings. |
| Tool registration | Executed. Pi discovered the package manifest through `discoverAndLoadExtensions([packageDirectory], cwd, agentDir)`. Its real loader loaded `index.ts` and registered `ask_user_question` with `model-only` exposure. |
| Structured answer | Executed. The registered tool returned typed option and custom answers through its real `execute` method. |
| Cancellation | Executed. A dismissed select returned `cancelled: true` and `User declined to answer questions`. |
| Non-interactive removal | Executed. The registered `before_agent_start` handler removed the active tool with `hasUI: false`. Repeated removal preserved `read`. RPC restoration was idempotent. Direct no-UI execution returned `error: "no_ui"`. |
| Cleanup and advisor preservation | Executed. Scratch cleanup and installation-root absence checks passed. Reasoned. The isolated home, agent directory, and project exclude operator settings. No active advisor process receives commands. |

Pi supplies the real extension API, event bus, manifest discovery, and TypeScript loader.
The probe substitutes only dialog responses and active-tool storage.
The probe invokes the registered lifecycle handler directly with a minimal host context.
The registered `execute` method receives `mode: "rpc"` and `hasUI: true` for answer checks.
These checks do not prove terminal rendering, keyboard input, or RPC wire transport.
They do not test CLI package installation, project trust, or a full agent-session lifecycle.
US-003 owns user-entry-point installation evidence.
No custom question wrapper or production code exists in this change.

## Additional checks

Inside `agro run --`, `node --check .agro/tasks/pi-ask-user-question/evidence/probe.mjs` exited 0.
The STE checker initially exited 1 with two prose findings.
After those edits, the STE checker exited 0.
The combined runtime-and-check command initially exited 1 because of those prose findings.
The package probe itself exited 0.

## Earlier inspection commands

The first temporary install exited 0.
A later invocation could not inspect that installation because `agro run` had removed its disposable container.
The inspection commands exited 1 with a missing temporary file.
Subsequent source inspections installed and read dependencies within one invocation; both exited 0.
Each inspection used a cleanup trap.
No dependency compatibility check failed.
