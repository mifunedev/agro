# Manual review evidence: retire agro crons

Base commit: `cdd2c4206c95c863617cc1d15f960da58127db93` (all of US-001 to US-006 are on the branch).
Location for each step: sandbox, local, in the worktree `.worktrees/task/1391-us007`.
Prerequisites: a checkout of this branch, Node 20 or newer, and pnpm v10.33.0.
No step creates a resource, so no step has a cleanup step.

## A. Install the test prerequisites

```bash
pnpm install --frozen-lockfile
```

Output, trimmed:

```text
+ @sinclair/typebox 0.34.49
+ @vitest/coverage-v8 4.1.11
+ diff 8.0.4
+ fast-check 4.8.0
+ vitest 4.1.11
+ yaml 2.9.0
Ignored build scripts: esbuild@0.28.1, msw@2.13.4.
Done in 752ms using pnpm v10.33.0
```

The output does not list `croner`. Exit status: 0.

## B. No live cron runtime reference

```bash
git grep -n -i -E 'agro-cron|cron-runtime|croner|crons/|cron\.agentBin' -- ':!CHANGELOG.md' ':!.agro/tasks/**'
```

Output:

```text
.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts:59:    expect(script).not.toContain("croner");
```

Exit status: 0 (one match).

Classification:

| Line | Class |
|---|---|
| `sandbox-upgrade-smoke.test.ts:59` | Negative test assertion. |

Failure path: a new live reference adds a line to this output that is not a negative assertion.

## C. No live boot-time install reference

```bash
git grep -n -E 'skipPnpmInstall|PNPM_INSTALL' -- ':!CHANGELOG.md' ':!.agro/tasks/**'
```

Output:

```text
.agro/cli/src/lib/__tests__/agro-config.test.ts:182:  it("loads an agro.json that still carries a retired build.skipPnpmInstall key", () => {
.agro/cli/src/lib/__tests__/agro-config.test.ts:186:      JSON.stringify({ version: 1, name: "legacy", build: { skipPnpmInstall: true } }),
.agro/cli/src/lib/__tests__/agro-config.test.ts:190:    expect(() => validateAgroConfig({ version: 1, build: { skipPnpmInstall: "1" } })).not.toThrow();
.agro/cli/src/lib/__tests__/config-render.test.ts:30:  "SKIP_PNPM_INSTALL",
.agro/cli/src/lib/__tests__/config-render.test.ts:197:    config.build = { skipPnpmInstall: true };
.agro/cli/src/lib/__tests__/config-render.test.ts:200:    expect(text).not.toContain("SKIP_PNPM_INSTALL");
.agro/cli/src/lib/config-render.ts:21:  "SKIP_PNPM_INSTALL",
.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts:58:    expect(script).not.toContain("skipPnpmInstall");
```

Exit status: 0 (eight matches).

Classification:

| Line | Class |
|---|---|
| `config-render.ts:21` | Retired-key list (`RETIRED_KEYS`). |
| `config-render.test.ts:30` | Retired-key list (test copy of `RETIRED_KEYS`). |
| `config-render.test.ts:197` | Fixture of the negative assertion at line 200. |
| `config-render.test.ts:200` | Negative test assertion. |
| `sandbox-upgrade-smoke.test.ts:58` | Negative test assertion. |
| `agro-config.test.ts:182` | UNEXPECTED. Title of a legacy-input test. |
| `agro-config.test.ts:186` | UNEXPECTED. Legacy-input fixture. |
| `agro-config.test.ts:190` | UNEXPECTED. Legacy-input fixture inside a `.not.toThrow()` assertion. |

The three `agro-config.test.ts` lines are not in a retired-key list, and they are not a negative assertion of absence. The test proves that an old `agro.json` that holds the retired `build.skipPnpmInstall` key still loads. The lines do not configure live behavior. The advisor decides if this class is acceptable.

`docs/configuration.md` has no match for either pattern.

## D. Script tests

```bash
pnpm test:scripts
```

Output, trimmed:

```text
 Test Files  90 passed (90)
      Tests  2021 passed | 2 skipped (2023)
   Duration  15.83s
```

Exit status: 0.

## E. Typecheck

```bash
pnpm run typecheck
```

Output:

```text
> agro@0.19.0 typecheck
> (test -d .agro/cli/node_modules || npm --prefix .agro/cli ci --ignore-scripts) && npm --prefix .agro/cli run typecheck

> @mifune/agro@0.19.0 typecheck
> tsc --noEmit
```

Exit status: 0.

## F. CI shellcheck

The command is the `ci-harness.yml` shellcheck step. The binary is ShellCheck version 0.10.0.

```bash
shellcheck -S warning .devcontainer/*.sh .agro/install/*.sh .agro/scripts/*.sh .agro/skills/{audit,escalate,typesafe-ai}/scripts/*.sh .claude/hooks/*.sh
```

Output: none. Exit status: 0.

## G. Provider links

```bash
bash .agro/scripts/link-providers.sh --check
```

Output, trimmed:

```text
note: Hermes uses another runtime home; checking only this checkout's other providers
Providers OK: .agents/.claude skills -> .agro/skills (vendored pack present)
```

Exit status: 0.

## H. No boot-time install in the entrypoint

```bash
grep -c 'pnpm install' .devcontainer/entrypoint.sh
```

Output: `0`. Exit status: 1 (`grep -c` exits 1 when the count is 0).

## I. Deleted files are absent

```bash
test -e crons; echo $?
test -e .devcontainer/agro-cron.service; echo $?
test -e .agro/scripts/cron-runtime.ts; echo $?
```

Output:

```text
1
1
1
```

Each path is absent.

## What remains unverified

The operator did not approve a sandbox rebuild. This review did not rebuild, restart, or inspect a container. The live rebuild check was not run.

To run the check, the operator does these steps.

1. On the host, at the project root, rebuild the sandbox with the operator-approved lifecycle verb. Then run:

   ```bash
   agro ps <name>
   ```

   Expected: the container shows a running and healthy status.

2. In the rebuilt sandbox, run:

   ```bash
   bash .agro/scripts/sandbox-healthcheck.sh; echo $?
   systemctl list-units 'agro-*'
   journalctl -u agro-bootstrap.service --no-pager | grep -c 'pnpm install'
   ```

   Expected: the healthcheck exits 0. `systemctl list-units 'agro-*'` shows only `agro-bootstrap.service`. The `journalctl` count is `0`.
