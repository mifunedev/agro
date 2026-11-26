# Baseline

Branch: `fix/1673-secret-guard-variants` at the plan commit, on the brain host.

Command: `corepack pnpm test` (PATH includes `$HOME/.local/share/fnm/aliases/default/bin`).

Result: 7 failed, 3533 passed, 9 skipped (3549). Test files: 1 failed, 124 passed.

The 7 failures are all in `.agro/scripts/__tests__/herdr-default.test.ts` ("Pi clipboard defaults in the canonical zshrc"). The brain has no `zsh`. These failures are the baseline.

The advisor runs commands directly with `corepack pnpm`, not through `agro run`, per the supervisor tooling instruction for this lane.
