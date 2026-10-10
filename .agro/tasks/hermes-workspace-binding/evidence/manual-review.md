# Hermes workspace binding: manual review

## Status

The advisor resolved the fresh-terminal approval and lifecycle fixture blockers.
Installed Hermes returned fixture HOME for `auto` and the selected workspace after
supported CLI repair, using real fresh terminals started outside the workspace.
The advisor reran the full suite and real runtime probe after integrating the
default-home, legacy Teams, and path fixes. Section F records those results.
Final independent review passed with no security concerns or logic errors.
Pushed-head CI remains the PR readiness gate.
The advisor retains acceptance authority.

Runs occurred on October 7, 2026, inside the isolated worker worktree:

```text
/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker
```

Implementation commits:

```text
783b918e520a1e1715a00892210dbb2fddcf8467  US-001
062c8aa3cdf0e74af90d1129dc1184ba84074ae4  US-002
af26fad1dc2ccb1cb592f8ce2ff5723bd0687f35  CI-required lockfile repair
e37144220e8db6f749ccfe0d9b49faff315b8437  Lifecycle negative fixture isolation
```

## A. Regression tests

Prerequisites: Node and the repository dependencies. Run these commands from the worker worktree.

```bash
npm exec --yes --package=pnpm@10.33.0 -- pnpm install --frozen-lockfile
npm test -- .agro/cli/src/__tests__/hermes-integration.test.ts .agro/cli/src/__tests__/harness.test.ts .agro/scripts/__tests__/gateway.test.ts .agro/cli/src/__tests__/docs-reference.test.ts
```

Dependency installation exited 0.
The final targeted command exited 0 and returned:

```text
Test Files  4 passed (4)
     Tests  107 passed (107)
```

The worker added assertions before each implementation change.
Each red run used `npm test -- <test-file>` from the worker worktree.
The following results came from executed runs, not reconstructed test output:

| Slice | Red result | Green result |
|---|---|---|
| First install configures cwd | Integration file: 1 failed, 6 passed; exit 1. No configure call existed. | Same file: 7 passed; exit 0. |
| Already-installed repair configures cwd | Integration file: 1 failed, 6 passed; exit 1. No configure call existed. | Same file: 7 passed; exit 0. |
| Foreign inherited home | Integration file: 1 failed, 9 passed; exit 1. Installation incorrectly returned 0. | Integration and harness files: conflict test passed. |
| Host launch guidance | Harness file: 4 failed, 65 passed; exit 1. Guidance omitted the selected home. | Integration and harness files: 79 passed; exit 0. |
| Supported config CLI exit status | Integration file: 1 failed, 11 passed; exit 1. Helper returned 1 instead of 7. | Integration and harness files: 85 passed; exit 0. |
| Gateway supported configuration | Gateway file: 1 failed, 10 passed; exit 1. No config CLI call existed. | Same file: 11 passed; exit 0. |
| Gateway conflict, state preservation, cwd validation | Gateway file: 3 failed, 13 passed; exit 1. | Three implementation files: 101 passed; exit 0. |
| Quoted gateway workspace | Gateway file: 1 failed, 16 passed; exit 1. Shell reported an unmatched quote. | Same file: 17 passed; exit 0. |
| Documentation anchor | First full suite: broken `#run-and-verify-read-only` anchor. | Documentation-reference file: 4 passed; exit 0. |

Host tests cover default, recorded, explicit path, and named workspace selection.
Each host selection runs through first-install and already-installed paths.
Docker tests cover first-install and repair with `/home/sandbox/harness`.
Configuration failures prevent success on the first-install and repair paths.
The helper test executes Bash and a fixture executable to check the exact supported CLI arguments and environment.
Gateway tests execute the launcher with fixture executables; no live tmux gateway runs in these tests.
The launch tests check the selected home, process cwd, overrides, failure ordering, and quoted paths.
The state test compares fixture `.env`, authentication, memory, skill, and session files byte for byte.
Non-Hermes installation tests continue to pass.

## B. Installed Hermes configuration

Prerequisites: the installed upstream launcher at `/home/sandbox/.local/bin/hermes`.
The upstream package is `/home/sandbox/.local/lib/hermes-agent`.
The worker used no LLM session or provider request.
The selected runtime home contains no operator credentials.

The fixture lives under the worker's ignored dependency directory:

```bash
export FIXTURE="$PWD/node_modules/.cache/hermes-workspace-check/runtime"
```

The worker created `workspace`, `workspace/.git`, and `user` under that directory.
The fixture's `.agro` link points to the worker's canonical `.agro` directory.
All runtime configuration commands used an explicit fixture `HERMES_HOME` and a clean environment.

The version probe used this argument vector, with the environment below:

```bash
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes --version
```

Observed output; exit 0:

```text
Hermes Agent v0.21.5+8495.gcbffbee (2026.9.24)
Install directory: /home/sandbox/.local/lib/hermes-agent
Python: 3.14.7
OpenAI SDK: Not installed
```

The initial command `hermes config set terminal.backend local` exited 0 in the fixture home.
The launcher prepared its isolated Python dependencies during that command.
The worker did not treat the initial missing SDK as a successful integration probe.

The worker ran the shared helper against the real installed CLI:

```bash
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 bash .agro/scripts/hermes-workspace.sh configure "$FIXTURE/workspace" "$FIXTURE/workspace/.hermes" "$FIXTURE/workspace" /home/sandbox/.local/bin/hermes
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes config get terminal.cwd
```

Both commands exited 0.
The helper reported `Set terminal.cwd` in the fixture home's `config.yaml`.
The readback returned:

```text
/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace
```

### Stale cwd repair and unrelated setting

Run these commands from the worker worktree:

```bash
export FIXTURE="$PWD/node_modules/.cache/hermes-workspace-check/runtime"
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes config set terminal.timeout 17
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes config set terminal.cwd /home/sandbox/harness
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 bash .agro/scripts/hermes-workspace.sh configure "$FIXTURE/workspace" "$FIXTURE/workspace/.hermes" "$FIXTURE/workspace" /home/sandbox/.local/bin/hermes
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes config get terminal.timeout
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/workspace/.hermes" PYTHONDONTWRITEBYTECODE=1 /home/sandbox/.local/bin/hermes config get terminal.cwd
```

All five commands exited 0.
The first two commands reported the selected values.
The helper replaced the Docker-specific cwd with the local fixture workspace.
The readback commands returned:

```text
17
/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace
```

The real CLI retained the unrelated timeout setting.
No YAML writer changed the fixture configuration directly.

### Real failure path

Run these commands from the worker worktree:

```bash
mkdir -p node_modules/.cache/hermes-workspace-check/runtime/broken-home/config.yaml
export FIXTURE="$PWD/node_modules/.cache/hermes-workspace-check/runtime"
env -i PATH="$PATH" HOME="$FIXTURE/user" HERMES_HOME="$FIXTURE/broken-home" PYTHONDONTWRITEBYTECODE=1 bash .agro/scripts/hermes-workspace.sh configure "$FIXTURE/workspace" "$FIXTURE/broken-home" "$FIXTURE/workspace" /home/sandbox/.local/bin/hermes
```

The directory creation exited 0. The helper exited 1.
The invalid configuration location prevented upstream runtime preparation.
The upstream launcher reported a plugin-selection read failure, then `ModuleNotFoundError: No module named 'ruamel'`.
The helper then reported:

```text
[hermes] could not configure terminal.cwd in <fixture>/broken-home; run: HERMES_HOME=<fixture>/broken-home /home/sandbox/.local/bin/hermes config set terminal.cwd <fixture>/workspace
```

`<fixture>` abbreviates the exact `FIXTURE` path above only in this trimmed output.
This failure occurred before a terminal session or tmux launch.
The worker did not present the dependency failure as a successful config-write test.
Automated tests separately verify config-command exit 7 and installation-success suppression.

## C. Executed fresh-terminal verification

Ryan explicitly approved the isolated no-provider runtime probe after the initial
approval pause. The advisor executed the installed gateway configuration bridge,
default cwd resolver, and real terminal tool with fresh UUID task IDs. The worker
read the raw records and exact probe source from:

```text
/home/sandbox/.hermes/cache/scratch/hermes-workspace-parent-runtime-results.json
```

Save the complete Python block below as
`$TMPDIR/hermes-workspace-evidence-driver.py`, then run the driver from this worktree:

```bash
python3 "$TMPDIR/hermes-workspace-evidence-driver.py" "$PWD"
```

The worker also executed this runnable driver successfully before fixture cleanup.
It discovers the isolated interpreter/bootstrap with `hermes --print-runtime-command`
and replaces only the CLI `run_module` call with `runpy.run_path`.
The driver discovers the interpreter instead of hardcoding its path. Every subprocess starts outside the workspace
with explicit fixture HOME/HERMES_HOME. PATH and TMPDIR are the sole inherited environment
values. The driver inherits no provider credentials, terminal cwd override, messaging cwd,
PYTHONPATH, PYTHONHOME, or virtualenv. The installed launcher prepares dependencies.
The fixture HOME has no configured fallback Hermes home or legacy Teams credentials.
The driver starts no provider request, messaging connection, or gateway daemon.

```python
import json
import os
from pathlib import Path
import subprocess
import sys

PROBE_SOURCE = r'''
import json
import os
from pathlib import Path
from uuid import uuid4
from ruamel.yaml import YAML
import gateway.run as gateway
from gateway.cwd_placeholder import CWD_PLACEHOLDERS, resolve_placeholder_terminal_cwd
import tools.terminal_tool as terminal

home = Path(os.environ["HERMES_HOME"])
config = YAML(typ="safe").load((home / "config.yaml").read_text())
gateway._bridge_terminal_config_to_env(config["terminal"])
configured = os.environ.get("TERMINAL_CWD", "")
if not configured or configured in CWD_PLACEHOLDERS:
    resolved = resolve_placeholder_terminal_cwd(
        configured_cwd=configured,
        terminal_backend=os.environ.get("TERMINAL_ENV", ""),
        messaging_cwd=os.environ.get("MESSAGING_CWD"),
        docker_mount_cwd_to_workspace=False,
        home_fallback=str(Path.home()),
    )
    if resolved is None:
        os.environ.pop("TERMINAL_CWD", None)
    else:
        os.environ["TERMINAL_CWD"] = resolved

task_id = "agro-1344-" + uuid4().hex
assert not terminal._active_environments
assert terminal.get_session_cwd(task_id) is None
print("outside_process_cwd=" + os.getcwd())
print("runtime_home=" + str(home))
print("fresh_task_id=" + task_id)
print("configured_cwd=" + str(config["terminal"].get("cwd")))
print("gateway_terminal_cwd=" + os.environ.get("TERMINAL_CWD", ""))
try:
    result = json.loads(terminal.terminal_tool("pwd", task_id=task_id))
    print("terminal_result=" + json.dumps(result, sort_keys=True))
    assert result["exit_code"] == 0
    assert result["output"].strip() == os.environ["EXPECTED_CWD"]
finally:
    terminal._stop_cleanup_thread()
    terminal.cleanup_all_environments()
    terminal.clear_session_cwd(task_id)
    assert not terminal._active_environments
    print("terminal_cleanup=ok")
'''

repo = Path(sys.argv[1]).resolve()
fixture = repo / "node_modules/.cache/hermes-workspace-check/runtime"
workspace = fixture / "workspace"
workspace.mkdir(parents=True, exist_ok=True)
(workspace / ".git").mkdir(exist_ok=True)
(fixture / "user").mkdir(exist_ok=True)
if not (workspace / ".agro").exists():
    (workspace / ".agro").symlink_to(repo / ".agro", target_is_directory=True)
probe = fixture / "probe.py"
probe.write_text(PROBE_SOURCE)
launcher = "/home/sandbox/.local/bin/hermes"
env = {
    "PATH": os.environ["PATH"],
    "HOME": str(fixture / "user"),
    "HERMES_HOME": str(workspace / ".hermes"),
    "PYTHONDONTWRITEBYTECODE": "1",
    "TMPDIR": os.environ["TMPDIR"],
}

def run(argv, expected=0, extra=None):
    result = subprocess.run(argv, cwd=fixture, env={**env, **(extra or {})},
                            text=True, capture_output=True, timeout=180)
    print(json.dumps({"argv": argv, "cwd": str(fixture),
                      "exit_code": result.returncode, "stdout": result.stdout,
                      "stderr": result.stderr}, sort_keys=True), flush=True)
    assert result.returncode == expected
    return result.stdout

run([launcher, "config", "set", "terminal.backend", "local"])
run([launcher, "config", "set", "terminal.timeout", "17"])
argv = json.loads(run([launcher, "--print-runtime-command"]))
assert argv[1:3] == ["-I", "-c"]
old = "runpy.run_module('hermes_cli.main', run_name='__main__', alter_sys=True)"
assert argv[3].count(old) == 1
argv[3] = argv[3].replace(old, "runpy.run_path(" + repr(str(probe)) + ", run_name='__main__')")
run([launcher, "config", "set", "terminal.cwd", "auto"])
run(argv, extra={"EXPECTED_CWD": str(fixture / "user")})
helper = ["bash", str(repo / ".agro/scripts/hermes-workspace.sh"), "configure",
          str(workspace), str(workspace / ".hermes")]
run([*helper, str(workspace), launcher])
run(argv, extra={"EXPECTED_CWD": str(workspace)})
run([*helper, "relative/missing", launcher], expected=1)
assert run([launcher, "config", "get", "terminal.timeout"]).strip() == "17"
```

### Advisor's actual output

Both probe subprocesses exited 0 with empty stderr. The preceding
`hermes config set terminal.cwd auto` and the workspace repair helper each exited 0.
The helper's exact argument vector is in the raw records; the advisor invoked the
canonical helper from its integration worktree against this worker's fixture.
The blocks below copy the unmodified stdout records of both executed probes.

Baseline (configured `auto`, fallback to fixture HOME):

```text
outside_process_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime
runtime_home=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace/.hermes
fresh_task_id=agro-1344-f861fddb9b20420a880f55b84ccf084e
configured_cwd=auto
gateway_terminal_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/user
terminal_result={"error": null, "exit_code": 0, "output": "/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/user"}
terminal_cleanup=ok
```

After supported CLI repair (same outside process cwd, different fresh task ID):

```text
outside_process_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime
runtime_home=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace/.hermes
fresh_task_id=agro-1344-9f7ca2f7249444aba5258303d11c7012
configured_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace
gateway_terminal_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace
terminal_result={"error": null, "exit_code": 0, "output": "/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker/node_modules/.cache/hermes-workspace-check/runtime/workspace"}
terminal_cleanup=ok
```

The worker's executable-driver repeat exited 0 and used task IDs
`agro-1344-8bdba0e613de4b0aacf85e9ed8326b5a` (baseline) and
`agro-1344-d0d371caeaca43ab95f756e4be1c5f22` (repaired).
Both real `terminal_tool("pwd", task_id=...)` calls returned exit 0 and the same
HOME/workspace outputs above, respectively. Both reported `terminal_cleanup=ok`.
Neither supplied `workdir` or executed a prior `cd`; each checked that no terminal
environment or session cwd existed for the new ID.

The helper's `relative/missing` failure used the same isolated environment outside
the workspace. Both advisor and driver observed exit 1, empty stdout, and stderr:

```text
[hermes] terminal cwd must be an existing absolute directory: relative/missing
```

The subsequent real `hermes config get terminal.timeout` readback exited 0,
with empty stderr and stdout:

```text
17
```

The unrelated timeout remains 17 after repair and failure.
This verifies real local terminal execution through the installed gateway cwd
bridge, not an end-to-end provider-backed chat or running tmux gateway.

### Resolved attempt history

The initial `hermes --run-module runpy <script-path>` attempt exited 1 because
`runpy` interpreted the path as a module name. It never executed the probe.
The initial replacement attempt paused for approval; the worker did not bypass it.
Approval was then explicitly resolved. The successful driver uses `runpy.run_path`.
The broken-home dependency failure in section B is a separate historical negative
run, not the final runtime status.

## D. Repository checks (pre-review-repair)

These results are from this worker worktree before the separately assigned
independent-review repairs. They do not certify those pending changes.

Run these commands from the worker worktree:

```bash
npm test -- .agro/cli/src/__tests__/lifecycle.test.ts --maxWorkers=2
npm test -- --maxWorkers=2
npm run typecheck
npm run build:harness
npm run lint
bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/hermes.md
bash -n .agro/scripts/hermes-workspace.sh .agro/scripts/gateway.sh
git diff --check
```

### Lifecycle fixture red/green

Before repair, the targeted lifecycle command exited 1:

```text
Test Files  1 failed (1)
     Tests  2 failed | 96 passed (98)
```

Both negative tests expected an unequipped-repository error, but found
`/home/sandbox/.agro` above TMPDIR and received these actual diagnostics instead:

```text
missing lifecycle script /home/sandbox/.agro/scripts/docker-compose.sh — the vendored .agro/ payload looks incomplete; run `agro vendor` to re-vendor the control-plane payload
missing lifecycle script /home/sandbox/.agro/scripts/gateway.sh — the vendored .agro/ payload looks incomplete; run `agro vendor` to re-vendor the control-plane payload
```

The advisor independently reproduced both unchanged failures on original main.
The repair changes only these two tests and their filesystem spy setup. Each test
masks only `.agro` directory stats for that fixture's strict ancestors. The actual
empty fixture is still inspected on disk; every other stat delegates to the real
filesystem. The real root resolver traverses to `/`, emits the expected error,
and spawns no command. Assertions check fixture, parent, and root lookups.
Each test restores its spy. The repair changes no production resolver or runtime code.
The repair creates no `/tmp` fixture and changes no equipped ancestor.
An intermediate spy attempt failed because native ESM exports are non-configurable;
a behavior-preserving `node:fs` module copy allows the narrowly scoped spies.

After repair, the identical targeted command exited 0:

```text
Test Files  1 passed (1)
     Tests  98 passed (98)
```

### Bounded full suite

`npm test -- --maxWorkers=2` exited 0 in 72.94 seconds:

```text
Test Files  89 passed (89)
     Tests  1878 passed | 4 skipped (1882)
```

The advisor's earlier unbounded integrated run had 1875 passing, 3 failing, and
4 skipped tests: the two lifecycle fixture failures plus the unchanged
`escalate-env.test.ts` 5000ms concurrency timeout. The bounded run has no failures.
The worker did not modify escalate tests or increase their timeout.

Typecheck, build, configured lint, STE, Bash syntax, and diff checks each exited 0.
The build emitted `dist/agro.js` at 269.3 kB.
The configured lint command printed `No root lint configured` and supplies no
static-analysis coverage; this limitation is not a claimed lint inspection.

### CI-required lockfile repair

The parent reported the plan-only CI audit failure before the implementation.
The operator authorized a lockfile-only refresh within existing semver ranges.

Before the refresh, this command exited 1:

```bash
npm exec --yes --package=pnpm@10.33.0 -- pnpm audit --audit-level low
```

Observed result:

```text
high: source-map-js allows event-loop denial of service through indexed source-map section offsets
Vulnerable versions: >=1.0.0 <1.2.2
Patched versions: >=1.2.2
Path: .>@vitest/coverage-v8>magicast>source-map-js
Advisory: GHSA-68fv-2mgg-jv7q
1 vulnerabilities found
Severity: 1 high
```

The final lockfile changes only `source-map-js` from 1.2.1 to 1.2.2.
The change includes its integrity, package entry, snapshot, and three existing dependency references.
The worker retained no broader transitive upgrades from the package-manager refresh.
Neither package manifest nor override changed.
The worker added no audit suppression.

After the minimal refresh, frozen installation and both audit commands exited 0:

```bash
npm exec --yes --package=pnpm@10.33.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.33.0 -- pnpm audit --audit-level low
npm exec --yes --package=pnpm@10.33.0 -- pnpm run security:audit
```

Both audits returned `No known vulnerabilities found`.

## E. Safety and cleanup

The worker changed only the assigned implementation, tests, documentation, evidence, and authorized lockfile.
The worker did not change `prd.md`, `prd.json`, a PR, or the tracker.
The worker did not push commits or restart a live gateway.
The runtime commands selected the isolated fixture home explicitly.
The commands used no provider credentials or Slack requests.
No tracked `.hermes/config.yaml` change exists in the implementation commits.
The installed upstream package's `git status --short` returned no changes.

Section C preserves the reproducible probe source and advisor output.
The worker executed the cleanup below after exercising the exact Python block
extracted from section C. It removes only the isolated ignored runtime fixture
from this worktree:

```bash
python3 -c 'from pathlib import Path; import shutil; p=Path("node_modules/.cache/hermes-workspace-check/runtime"); shutil.rmtree(p); print("runtime_fixture_removed=" + str(not p.exists()))'
```

Cleanup exited 0 and returned:

```text
runtime_fixture_removed=True
```

The exact embedded-driver verification also exited 0, with fresh task IDs
`agro-1344-d966478fda924e7ba29788ee6d0eb763` (baseline) and
`agro-1344-64feadf0e8934f8f8513d90edefbc603` (repaired). Both terminal calls
returned exit 0, the expected HOME/workspace paths, and `terminal_cleanup=ok`.
The installed upstream package's final `git status --short` was empty (exit 0).
The advisor retains acceptance authority, including integrated checks after the
separate independent-review repairs.

## F. Advisor integrated verification

The advisor ran these checks after integrating review-fix commit
`9c054337` into `bug/1344-hermes-workspace-binding`.
All commands ran in that integration worktree on October 7, 2026.

```bash
npm test -- --maxWorkers=2
npm test -- .agro/cli/src/__tests__/hermes-integration.test.ts .agro/cli/src/__tests__/harness.test.ts .agro/scripts/__tests__/gateway.test.ts .agro/cli/src/__tests__/docs-reference.test.ts
npm run typecheck
npm run build:harness
npm run lint
npm exec --yes --package=pnpm@10.33.0 -- pnpm run security:audit
bash -n .agro/scripts/hermes-workspace.sh .agro/scripts/gateway.sh
bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/hermes.md .agro/tasks/hermes-workspace-binding/prd.md
git diff --check
```

Every command exited 0. The full suite returned:

```text
Test Files  89 passed (89)
     Tests  1898 passed | 4 skipped (1902)
```

The targeted suite returned 4 passing files and 127 passing tests.
Typecheck passed. The build emitted `dist/agro.js` at 269.3 kB.
The audit returned `No known vulnerabilities found`.
The configured lint command returned `No root lint configured`.
No static-analysis coverage comes from that lint command.

The advisor extracted the driver in section C to this scratch file:

```bash
python3 /home/sandbox/.hermes/cache/scratch/hermes-workspace-final-probe.py "$PWD"
```

The advisor ran the driver against the integrated helper. The driver exited 0.
Its clean subprocess environment also passed TMPDIR to the scratch directory.
The baseline fresh task was `agro-1344-5ff39d4962b540a7b9b98d92a8c3d54e`.
The repaired fresh task was `agro-1344-89e65b0f15ce4a2fa76d493c87458db9`.
Both probes reported `terminal_cleanup=ok`.
The following selected lines came from their actual stdout:

```text
configured_cwd=auto
gateway_terminal_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/bug/1344-hermes-workspace-binding/node_modules/.cache/hermes-workspace-check/runtime/user
terminal_result={"error": null, "exit_code": 0, "output": "/home/sandbox/.agro/workspaces/harness/.worktrees/bug/1344-hermes-workspace-binding/node_modules/.cache/hermes-workspace-check/runtime/user"}
```

After supported CLI repair, the new terminal returned:

```text
configured_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/bug/1344-hermes-workspace-binding/node_modules/.cache/hermes-workspace-check/runtime/workspace
gateway_terminal_cwd=/home/sandbox/.agro/workspaces/harness/.worktrees/bug/1344-hermes-workspace-binding/node_modules/.cache/hermes-workspace-check/runtime/workspace
terminal_result={"error": null, "exit_code": 0, "output": "/home/sandbox/.agro/workspaces/harness/.worktrees/bug/1344-hermes-workspace-binding/node_modules/.cache/hermes-workspace-check/runtime/workspace"}
```

The invalid `relative/missing` cwd exited 1 with the diagnostic in section C.
The unrelated timeout readback remained `17`, exit 0.
The advisor removed this integration fixture with the cleanup command in section E.
Cleanup returned `runtime_fixture_removed=True`, exit 0.
The installed upstream checkout remained clean.
The main checkout retained only the operator's existing `.hermes/config.yaml` modification.
No live gateway, provider request, stored credential, or active runtime home changed.

### Final recovery-command and empty-key repair

The advisor reran the same integrated checks after commit
`0d45625e269656074992c2a880b4bdd67a4b7320`.
That commit removes recovery-command punctuation and rejects empty canonical Teams keys.
The unchanged-command regression no longer strips the final character.
Every command exited 0. The full suite returned:

```text
Test Files  89 passed (89)
     Tests  1901 passed | 4 skipped (1905)
```

The targeted suite returned 4 passing files and 130 passing tests.
Typecheck, build, configured lint, security audit, Bash syntax, STE, and diff checks passed.
The shared runtime helper has no source changes since the executed probe in section F.
The advisor verified that empty helper diff against commit `9c054337`.
The integration branch contains the current `origin/development`; the advisor made no catch-up merge.
Final independent review passed with no security concerns, logic errors, or suggestions.
The reviewer also reported 228 targeted tests across five files passing.
Pushed-head CI still governs PR readiness.

## Lessons

Use the supported config CLI rather than a second YAML writer.
Select the runtime home independently of the process cwd.
Keep a fresh terminal result separate from installer and configuration output.
Do not bypass a pending tool approval to obtain integration evidence.
Isolate negative fixtures from equipped scratch ancestors without mocking the resolver.
Use bounded test concurrency to separate resource contention from behavior failures.
Preserve the actual probe source and exercise the embedded driver before cleanup.
