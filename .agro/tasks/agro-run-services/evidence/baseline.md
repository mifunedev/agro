# Test baseline

The advisor ran these commands on `feat/1584-agro-run-services` on the VM host before the first wave. Per the new `/delegate` rule planned in US-003, the advisor also ran the suite through `agro run`.

- `pnpm typecheck`: exit 0.
- host `pnpm test`: Tests  14 failed | 2899 passed | 6 skipped (2919).
- `agro run -- pnpm test` (official image 0.30.0): Tests  1 failed | 2924 passed (2925).
- `agro run` failing tests:  .agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged;
