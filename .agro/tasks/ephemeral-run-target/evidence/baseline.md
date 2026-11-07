# Test baseline

The advisor ran these commands on `feat/1579-ephemeral-run-target` on the VM host before the first wave.

- `pnpm typecheck`: exit 0.
- `pnpm test`: Tests  14 failed | 2868 passed | 6 skipped (2888).
- Baseline failure files: .agro/cli/src/__tests__/self-upgrade.test.ts .agro/cli/src/lib/__tests__/agro-config.test.ts .agro/cli/src/lib/__tests__/host-config.test.ts .agro/scripts/__tests__/herdr-default.test.ts .agro/scripts/__tests__/install.test.ts 
