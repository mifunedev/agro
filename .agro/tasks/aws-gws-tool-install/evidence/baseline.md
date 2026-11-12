# Baseline

Revision: `42474b2d` (plan-only task branch, based on `af779d7b`).
Location: sandbox main checkout, `/home/sandbox/harness`.

- `pnpm install --frozen-lockfile`: exit 0.
- `pnpm run typecheck`: exit 0; `tsc --noEmit` reported no error.
- `pnpm test:scripts`: exit 0; 120 files passed, 3176 tests passed, and 2 skipped.

No baseline test failure requires an exclusion.
Initial plan-push CI: PASS, https://github.com/mifunedev/agro/actions/runs/43123257994.
Boot Path Lint and Typecheck, Build & Test both passed.
Implementation acceptance requires new checks after integration.
