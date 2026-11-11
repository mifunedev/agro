# Baseline

The advisor ran these commands in the worktree `.worktrees/task/1604-agro-hands` on 2026-11-11, at the plan commit on `origin/development` `66a640c6d`.

| Command | Exit | Result |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | |
| `pnpm run typecheck` | 0 | |
| `pnpm test:scripts` | 1 | 3084 passed, 14 failed, 6 skipped in 118 files |
| `pnpm run build:harness` | 0 | |

The 14 failures come from this node, not from a story. A story does not fail a criterion on them:

- `.agro/cli/src/__tests__/self-upgrade.test.ts > runSelfUpgrade — standalone > keeps an absolute Node shebang from the current target (#!/abs/path/node)`
- `.agro/cli/src/__tests__/self-upgrade.test.ts > runSelfUpgrade — standalone > keeps an absolute Node shebang from the current target (#!/home/user/.local/share/agro/node)`
- `.agro/cli/src/__tests__/self-upgrade.test.ts > runSelfUpgrade — standalone > upgrades older → newer from an empty directory without touching project or registry state`
- `.agro/cli/src/__tests__/self-upgrade.test.ts > runSelfUpgrade — standalone > upgrades older → newer inside an equipped checkout without touching project or registry state`
- `.agro/cli/src/lib/__tests__/agro-config.test.ts > round trip > writes agro.json world-readable — it is a tracked, non-secret file`
- `.agro/cli/src/lib/__tests__/host-config.test.ts > writeHostConfig > writes the file with mode 0644`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > exports the default to children in an interactive Herdr pane`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset in a noninteractive Herdr shell`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {"HERDR_PANE_ID":""}`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {}`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <0>`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <1>`
- `.agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <>`
- `.agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged`
