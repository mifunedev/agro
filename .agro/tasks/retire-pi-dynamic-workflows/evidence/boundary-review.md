# Boundary review (D4)

Performed by T2, an independent read-only worker that did not write the code under
review. Accepted by the advisor, who re-ran the two suites itself.

## Regression surface

| Command | Runner | Exit |
|---|---|---|
| `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` | T1 | 0 |
| `pnpm exec vitest run .pi` | T1 | 0 |
| `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` | T2, independently | 0 |
| `pnpm exec vitest run .pi` | T2, independently | 0 |
| `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` | advisor | 0, 3 tests |
| `pnpm exec vitest run .pi` | advisor | 0, 7 files, 52 tests |

Three independent runners, same result. The suite was re-run by the advisor after the
guard repair as well.

## Changed set

`git diff origin/development...HEAD --stat` reports exactly:

- `.pi/settings.json`
- `.pi/extensions/__tests__/settings.test.ts`
- `CHANGELOG.md`
- `docs/README.md`, `docs/harnesses/pi.md`, `docs/installation.md`,
  `docs/integrations/pi-fff.md`
- `docs/integrations/pi-dynamic-workflows.md` (deleted)
- `.agro/evals/RESULTS.md` (the benchmark refresh, committed separately)
- files under `.agro/tasks/retire-pi-dynamic-workflows/`

Nothing else. No source file outside the Pi configuration surface changed.

## Preserved state — how it was checked

| Boundary | Check | Result |
|---|---|---|
| Root checkout | `git status --porcelain` at `/home/sandbox/harness` | empty |
| The reviewed worktree | `git status --porcelain` | empty after each commit |
| agro-web clone | `git status --porcelain` at `projects/mifunedev/agro-web` | empty; the companion change lives in its own worktree on its own branch |
| Global Pi settings | `~/.pi/agent/settings.json` mtime | Sep 6 16:50, predating this work on Sep 11; the file holds no `packages` key, so no global registration source exists here |
| Package cache | `.pi/npm/node_modules` inspected | no `pi-dynamic-workflows` directory; nothing was removed from the tracked tree |
| Session histories | not touched | no command in this build reads or writes one |
| Gateway state | not touched | no `gateway` invocation in this build |
| Provider mirrors | not touched | the change is in `.pi/` and `docs/`; no `.agro/skills` mirror was edited |
| Application-owned files | not touched | nothing under `projects/` was written except the separately branched companion worktree |
| Running services | no reload, no restart | the runtime probes were new disposable processes under `/tmp/piprobe/` that exited on their own |

## Probe artifacts

The runtime verification wrote only to `/tmp/piprobe/`, outside the repository. The
temporary inspection extension lived at `/tmp/piprobe/probe.ts` and was copied into two
disposable `/tmp` checkouts, never into tracked source. No credential was read into or
copied into any evidence file.

## Residual, disclosed

- `cc-safety-net@1.0.6` registers no LLM-callable tool, so the acceptance criterion
  "safety-guard tools remain present" cannot hold by tool name. See
  `evidence/runtime.txt` and the *What remains unverified* section of `evidence.md`.
- The eval suite carries four persistent reds, none caused by this change. One of them,
  `next-dev-prod`, fires because an unrelated `next dev` process is running in this
  sandbox. That process belongs to another agent's service and was deliberately left
  running, in keeping with the instruction to disturb no active service.
