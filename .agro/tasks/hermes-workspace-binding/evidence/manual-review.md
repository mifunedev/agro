# Hermes workspace binding: manual review

## Status

US-001 and US-002 have passing targeted tests.
US-003 remains blocked. Do not accept US-003 from this evidence.
The fresh terminal probe needs a pending tool approval.
Two unchanged lifecycle tests also fail with this environment's scratch directory.
No fresh-session `pwd` result exists yet.

Runs occurred on October 7, 2026, inside the isolated worker worktree:

```text
/home/sandbox/.agro/workspaces/harness/.worktrees/task/1344-hermes-workspace-worker
```

Implementation commits:

```text
783b918e520a1e1715a00892210dbb2fddcf8467  US-001
062c8aa3cdf0e74af90d1129dc1184ba84074ae4  US-002
af26fad1dc2ccb1cb592f8ce2ff5723bd0687f35  CI-required lockfile repair
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

## C. Fresh terminal verification blocker

The worker prepared this script:

```text
node_modules/.cache/hermes-workspace-check/runtime/probe.py
```

The script imports the installed gateway cwd bridge and default resolver.
The script creates a UUID task ID and checks for an empty terminal environment cache.
The script then calls the installed `terminal_tool("pwd", task_id=...)` without `workdir` or a previous `cd`.
The script includes terminal environment cleanup.

The first attempted invocation used `hermes --run-module runpy <script-path>`.
That invocation exited 1 before executing the probe.
The standard-library `runpy` module treated the file path as a module name.
The error began:

```text
Error while finding module specification for '/home/sandbox/.../runtime/probe.py'
(ModuleNotFoundError: No module named '/home/sandbox/')
```

The worker then requested the installed launcher's `--print-runtime-command` interpreter.
The replacement invocation would bootstrap the installed PM environment and use `runpy.run_path`.
The execution guard paused that subprocess invocation for approval and instructed the worker not to retry or rephrase it.
The worker did not bypass the approval prompt.
No terminal result or fresh-session cwd assertion ran successfully.

The pending probe still expects the earlier unset-cwd baseline.
The later configuration checks set the fixture cwd to the workspace.
After resolving the approval, the advisor must align the assertion with the scenario under test.
Do not claim the remaining script is an executed fresh-session test.

## D. Repository checks

Run these commands from the worker worktree:

```bash
npm test
npm run typecheck
npm run build:harness
npm run lint
bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/hermes.md
bash -n .agro/scripts/hermes-workspace.sh .agro/scripts/gateway.sh
git diff --check
```

The final full test run exited 1 and returned:

```text
Test Files  1 failed | 88 passed (89)
     Tests  2 failed | 1876 passed | 4 skipped (1882)
```

Both failures are in unchanged `.agro/cli/src/__tests__/lifecycle.test.ts`:

- `runSandbox > errors under agro when not inside an equipped repo`.
- `runGateway > errors when not inside an equipped repo`.

The tests create a bare fixture under `TMPDIR`.
Here, `TMPDIR` is below `/home/sandbox/.hermes/cache/scratch`.
The root resolver finds `/home/sandbox/.agro` above the fixture.
The tests therefore receive a missing-script error instead of the expected unequipped-repository error.
The worker requested parent guidance because the failing file is outside the owned paths.
The worker changed no lifecycle test, resolver, or scratch-directory policy.

Typecheck, build, configured lint, STE, Bash syntax, and diff checks exited 0.
The build emitted `dist/agro.js` at 269.3 kB.
The configured lint command printed `No root lint configured`.
That command supplies no static-analysis coverage.

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

The runtime fixture remains under the ignored `node_modules` directory because the probe approval is pending.
After resolving the approval and completing verification, remove the fixture with this command from the worker worktree:

```bash
python3 -c 'from pathlib import Path; import shutil; p=Path("node_modules/.cache/hermes-workspace-check/runtime"); shutil.rmtree(p); print("runtime_fixture_removed=" + str(not p.exists()))'
```

The worker has not executed that cleanup while the invocation remains pending.
This resource and the incomplete fresh-session check remain explicit blockers.
The advisor retains acceptance authority.

## Lessons

Use the supported config CLI rather than a second YAML writer.
Select the runtime home independently of the process cwd.
Keep a fresh terminal result separate from installer and configuration output.
Do not bypass a pending tool approval to obtain integration evidence.
