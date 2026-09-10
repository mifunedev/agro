# CLI-first release closeout

## Pull requests

| Repository | Pull request | Verified content head | State |
|---|---|---|---|
| `mifunedev/agro` | https://github.com/mifunedev/agro/pull/1031 | `5003697f3cb4c7eeeee337eb549bbd4398e6e7b3` | Draft before final audit |
| `mifunedev/agro-web` | https://github.com/mifunedev/agro-web/pull/54 | `34485f68557a3f5deb1b1f5f9ef47462c1569ef6` | Draft before final audit |

The core content head excludes later task-record-only commits. The final PR audit output names the remote head.

## Verification

Core CI passes at `5003697f`:

- Lint, Typecheck, Build & Test: PASS.
- Boot Path Lint: PASS.
- Eval Probe Regression Gate: PASS.
- Validate sandbox compose and image build: PASS.
- Boot a legacy volume against the fresh image: PASS.

Web verification passes at `34485f68`:

- `pnpm test`: 28 passed.
- `pnpm typecheck`: PASS.
- Changed Markdown STE: PASS.
- Docs drift check: PASS.
- `pnpm build`: PASS.
- Build docs site CI: PASS.
- Deploy to GitHub Pages: SKIPPED for the draft PR.

Browser verification passes. See `../ui-evidence.json` and `docs-ref.md`.

## Definition of Done

| ID | Result | Evidence |
|---|---|---|
| D1 | PASS | `scope.md` |
| D2 | PASS | `onboarding.md`, `docs-ref.md`, `../ui-evidence.json` |
| D3 | PASS | `image-selection.md` |
| D4 | PASS | `release-contract.md` |
| D5 | PASS | `docs-ref.md`, web PR 54 |
| D6 | PASS | `candidate.md`, Boot Guard run `34418907048` |
| D7 | PASS | Audit `audit-20260910T002751Z-894377`; ready-for-review actions follow the final task-record CI run |

## Complete criterion map

The current `prd.json` contains 104 acceptance entries. Each entry appears in one range below.

| Criteria | Result | Evidence |
|---|---|---|
| US-001 C1-C5 | PASS | `scope.md` |
| US-002 C1-C6 | PASS | `onboarding.md`; focused CLI tests; core CI |
| US-003 C1-C5 | PASS | `onboarding.md`; core docs review; core CI |
| US-004 C1-C7 | PASS | `image-selection.md`; lifecycle and render tests; core CI |
| US-005 C1-C10 | PASS | `release-contract.md`; publication contract tests; core CI |
| US-006 C1-C7 | PASS | `release-contract.md`; parity probes; core CI |
| US-007 C1-C7 | PASS | `release-contract.md`; retained-shim integrity tests; core CI |
| US-008 C1-C7 | PASS | `docs-ref.md`; web source-ref tests; web CI |
| US-009 C1-C7 | PASS | `docs-ref.md`; `../ui-evidence.json`; web CI |
| US-010 C1-C12 | PASS | `candidate.md`; Boot Guard run `34418907048` |
| US-011 C1-C14 | PASS | `candidate.md`; Boot Guard run `34418907048` |
| US-012 C1-C8 | PASS | `candidate.md`; exact-head core and web CI |
| US-013 C1-C9 | PASS | This closeout; audit `audit-20260910T002751Z-894377`; final PR audits |

## Excluded operations

No merge, release, npm publication, GHCR publication, live migration, live backup, or secret change occurred. Those operations need separate operator approval and evidence.

## Final review

The first implementation audit failed at 11 of 13 stories. That failure was correct. US-009 then passed through agent-browser and independent UI review.

Final implementation audit: `audit-20260910T002751Z-894377`, `AUDIT-PASS`.
Final core PR audit: run after the final task-record CI.
Final web PR audit: run after the final task-record CI.
