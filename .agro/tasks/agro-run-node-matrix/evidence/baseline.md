# Test baseline

The advisor ran these commands on `feat/1594-agro-run-node-matrix` on the VM host before the first wave, through `agro run` (installed agro v0.32.0).

- `agro run -- pnpm typecheck`: exit 0.
- `agro run -- pnpm test`: Tests  1 failed | 3059 passed (3060).
- Failing tests:  .agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged;
