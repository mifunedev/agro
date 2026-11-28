# Baseline

Branch `feat/1676-hands-create-desktop-count` at 19884b35, on the brain host. The commands ran directly with `export PATH=$HOME/.local/share/fnm/aliases/default/bin:$PATH`.

- `corepack pnpm run typecheck`: exit 0.
- `corepack pnpm test`: 1 failed file, 124 passed. 7 failed tests, 3688 passed, 9 skipped.
- The 7 failures are in `.agro/scripts/__tests__/herdr-default.test.ts`. The brain has no zsh.
