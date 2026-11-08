# Test baseline

The advisor ran these commands on `feat/1590-agro-run-microvm` on the VM host before the first wave, through `agro run` (installed agro v0.31.0).

- `agro run -- pnpm typecheck`: exit 0.
- `agro run -- pnpm test`: Tests  1 failed | 3020 passed (3021).
- Failing tests:  .agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged;
