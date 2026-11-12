# US-005 mixed-file verification

Tested source: `5d40ae2418dc27973cc4d93b834db716847e0cd4`.
This document replaces the earlier image-only verification.
The advisor already accepted US-004 with 75 targeted tests, both typechecks, build, and audit.
This worker changed only assigned documentation and evidence.

## Documentation-reference tests

The first run used the existing sandbox:

```bash
node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 -- env CI=true pnpm exec vitest run .agro/cli/src/__tests__/docs-reference.test.ts
```

Exit 1: three tests passed; the runtime-path test reported ten existing ignored paths as missing.
The sandbox cannot resolve the worktree's host-side `.git` pointer for `git check-ignore`.
No clipboard command, config key, link, or anchor failed.

The final run mounted the actual host repository, including real git metadata, through public `agro run`:

```bash
cd /home/exedev/.agro/workspaces/harness
node /home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload/.agro/cli/dist/agro.js run -- env CI=true sh -lc 'cd /home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload && pnpm exec vitest run .agro/cli/src/__tests__/docs-reference.test.ts'
```

Exit 0: one test file, four tests passed.
The run used `ghcr.io/mifunedev/agro:0.34.0` and removed its throwaway container.
The CLI pulled the image because the host lacked that tag.
The worker created no fake git metadata and changed no sandbox configuration.
The worker invoked no raw Docker command.

## STE and whitespace

The worker extracted added documentation lines from `git diff --unified=0` into `/tmp/clipboard-us005-changed.md`.
The extraction covered the five assigned public documents, including the changelog.

```bash
bash .agro/skills/ste/scripts/ste-check.sh /tmp/clipboard-us005-changed.md .agro/tasks/clipboard-upload/evidence/manual-review.md .agro/tasks/clipboard-upload/evidence/runtime-probe.md
bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/clipboard-upload/evidence/verification.md
```

Both exited 0 after correction of one compound-step heading in the manual review.
The worker manually checked actors, execution locations, conditions, and reference clarity.

A full-file scan of the public documents retains unrelated baseline findings:

```bash
bash .agro/skills/ste/scripts/ste-check.sh .agro/cli/README.md docs/lifecycle-commands.md docs/connecting.md docs/security-considerations.md CHANGELOG.md
```

Exit 1: 284 findings, identical to the five accepted `HEAD` versions.
The worker compared detector-message multisets from independent baseline and current scans.
The comparison found zero new findings and zero resolved findings.
The four guidance documents retain 13 findings; the historical changelog retains 271.
No changed prose has a finding.
The worker preserved unrelated historical prose.

```bash
git diff --check
```

Exit 0.
The Unreleased Added clipboard entry contains one sentence and 211 characters, including its issue-1612 link and list marker.

## Executed browser and lifecycle criteria

See [manual review](manual-review.md) for commands, exact paths, modes, IDs, byte hashes, and screenshot callouts.

- The fresh equipped project and inputs used `~/.agro/reviews/clipboard-1612/review/` in the sandbox.
- Startup asserted absent project state and unset `AGRO_HOME`; public commands also used `env -u AGRO_HOME`.
- State, startup log, manifest, and attachments used the actual default `~/.agro/clipboard/<project-id>/` tree.
- Public start and repeated start returned identical credential URLs.
- Real clipboard paste and file input supplied a PNG and nonempty TXT with distinct captions.
- A dropped third file appeared; removal preserved retained caption IDs and values.
- SVG and HTML showed inert metadata without extra object URLs or active content.
- POST `/api/batches` returned HTTP 201 through private forwarding to the real backend.
- Stored TXT bytes matched the input hash; stored PNG bytes matched Chromium's normalized clipboard PNG hash.
- The ordered schema-version-1 `files[]` manifest recorded image/file kinds and private modes.
- The readonly prompt required explicit file tools and image-capable reads; actual clipboard copy matched the prompt.
- Light and dark screenshots used the existing palette and a 1280x720 viewport.
- Mobile viewport width and document width both measured 414 pixels with captions present.
- Axe reported zero WCAG2A/AA violations; final browser errors and console output were empty.
- Public stop and repeated stop preserved attachment and manifest hashes.
- Occupied-port startup exited 1 and preserved the review-owned foreign listener's response.

The fixture helper initially used a CSP-blocked data-URL fetch; the worker corrected the helper and reloaded before the successful journey.
The first PNG hash assertion compared canvas bytes with clipboard-normalized bytes and failed.
The corrected assertion compared actual clipboard bytes and passed.
Neither correction changed production code or weakened a guard.

## Reasoned criteria and limits

The documentation describes inert storage, not document processing or malware scanning.
Backend tests cover arbitrary binary/PDF/ZIP data and validation; this browser run does not claim those formats.
The accepted US-004 tests cover authentication/network/server retry preservation, validation limits, theme selection, text safety, and copy fallback.
The three new screenshots support assertions; they do not replace tests.
No downstream file-reading agent or physical-device interaction ran.
Isolated workers still need explicit attachment transfer or shared mounts with target-valid paths.

## Scope and cleanup

The worker replaced the three assigned PNGs and reviewed each rendered image for readable callouts and credential absence.
Historical runtime-probe commands remain unchanged beneath an explicit historical note.
The worker did not edit source, tests, tracker, plan, dependencies, PR state, or provider mirrors.
The existing sandbox remained running; no sandbox install, restart, or destroy command ran.
The worker stopped the public service, occupied-port fixture, private relay, and named browser session.
The worker removed only the exact review project, its project-specific store, private host inputs, request files, and temporary drivers.
Parent directories and unrelated AGRO state remain intact.
The token-free stopped relay helper remains at `/tmp/clipboard-us004-relay.py`.
Final checks found sandbox 3500 and host 14612 free, with no owned tmux sessions.
The worker sent no command to stop unrelated host listeners.
No monitor or late callback remains active.

The operator's prior shipping approval applies to this refinement.
The advisor owns acceptance, final full-SHA PR links, and exact-head CI.
The worker performed no push or PR edit.
