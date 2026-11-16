# PRD: Simplify agro self-upgrade and remove the star prompt

Status: DRAFT

## User Stories

### US-001: Remove the star prompt

**Description:** As an operator, I want `agro sandbox install` to print no star prompt so that the CLI holds no promotional state.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/star-prompt.ts` and `.agro/cli/src/lib/__tests__/star-prompt.test.ts` do not exist.
- [ ] `git grep -n -i "star-prompt\|StarPrompt\|STAR_PROMPT" -- .agro/cli/src docs` prints no line.
- [ ] `agro run -- pnpm exec vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.
- [ ] Typecheck passes.

### US-002: Shrink the self-upgrade command

**Description:** As an operator, I want one small upgrade path for each released install kind so that the command is easy to verify.

**Acceptance Criteria:**

- [ ] The npm path applies when the realpath of `argv[1]` contains `/node_modules/@mifune/agro/`. The command runs `npm i -g --prefix <owning prefix> @mifune/agro@latest`. It exits 0 only when npm exits 0. A test asserts the exact npm arguments.
- [ ] The standalone path applies when the basename of the realpath of `argv[1]` is `agro` and the path is not under `node_modules/@mifune/agro/`. The command downloads `AGRO_JS_URL` (default `https://github.com/mifunedev/agro/releases/latest/download/agro.js`) and writes the file in the target directory with mode `0755`. It runs `--version` on the new file, then renames the new file over the target. A test asserts the new target content and mode.
- [ ] When the first line of the current target is an absolute Node shebang (`#!/<path>/node`), the replaced target keeps that first line. A test asserts the kept line.
- [ ] The command exits 1 when the downloaded file has no `#!` first line, or when its `--version` exits non-zero. Then the target bytes do not change, and no temporary file remains in the target directory. A test asserts each condition.
- [ ] For each other target, the command exits 1 and writes nothing. Examples are `/opt/agro/dist/agro.js` and a checkout `dist/agro.js`. The command prints one line that names the target and tells the operator to upgrade with the mechanism that installed it.
- [ ] With `--dry-run`, the command prints the planned npm command or the planned download URL, exits 0, and writes nothing.
- [ ] `agro update` stays an alias of `agro self-upgrade`, and the vendor-flag refusals in `.agro/cli/src/__tests__/cli-first-help.test.ts` and `.agro/cli/src/__tests__/bundle-identity.test.ts` still pass.
- [ ] `wc -l .agro/cli/src/commands/self-upgrade.ts` prints a number less than or equal to 180.
- [ ] `printSelfUpgradeHelp` in `.agro/cli/src/cli.ts` describes only the behavior in this story.
- [ ] Repair (review finding 1): the npm path applies only when the owning prefix equals the realpath of `npm prefix -g`. Otherwise the command exits 1 and names both prefixes. The command runs `npm i -g @mifune/agro@latest`, then runs `--version` on the target and prints the reported version. A test covers a non-global prefix.
- [ ] Repair (review finding 2): the command refuses an artifact when its `--version` output is not a SemVer version. The command also refuses an artifact with a version lower than the running version. When the versions are equal, the command keeps the target. A test covers each case.
- [ ] Repair (review finding 4): the standalone path refuses a symbolic link at `argv[1]`. The reason is that `install.sh` installs a regular file. A test covers a symbolic link named `agro`.
- [ ] Repair (review finding 5): when the target directory is not writable, the command exits 1 before the download. The error tells the operator to run as the owner of the target. When npm fails with `EACCES`, the error names the prefix owner. A test covers the directory case.
- [ ] Repair (review findings 6, 7, 10): a download error names the URL. A refusal after a failed realpath includes the cause. The `--version` probe of a new file stops after 30 seconds.
- [ ] Repair (review finding 9): the refusal test for a sandbox image path uses a real file at a temp `opt/agro/dist/agro.js`. The test then passes through the classification branch.
- [ ] `agro run -- pnpm exec vitest run .agro/cli/src/__tests__/self-upgrade.test.ts .agro/cli/src/__tests__/cli-first-help.test.ts .agro/cli/src/__tests__/bundle-identity.test.ts` exits 0.
- [ ] Typecheck passes.

### US-003: Update documentation and changelog

**Description:** As an operator, I want the documentation to state the new upgrade behavior so that the documentation matches the code.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` § Upgrading the CLI and `docs/installation.md` describe only the behavior of US-002. Neither file mentions `.prev` or a PATH shadow refusal.
- [ ] `docs/configuration.md` has no `AGRO_NO_STAR_PROMPT` row.
- [ ] `CHANGELOG.md` `## [Unreleased]` has entries for the simpler self-upgrade and the star prompt removal.
- [ ] Repair (review finding 3): `.agro/cli/README.md` describes only the behavior of US-002.
- [ ] Repair: `docs/lifecycle-commands.md`, `docs/installation.md`, `printSelfUpgradeHelp`, and `CHANGELOG.md` describe the repaired refusals of US-002.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md docs/installation.md` reports no new finding compared with `development`.

### US-004: Record the sandbox routing replay again

**Description:** As a maintainer, I want the routing replay fixture to match the changed instruction files so that `sandbox-routing.test.ts` passes.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` holds 17 decisions, R1 to R17. A fresh decision-only agent produced each decision against the final instruction files.
- [ ] Each decision matches its oracle in `cases.json`.
- [ ] The provenance equals the output of `sourceProvenance()` on the final tree.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/sandbox-routing.test.ts` exits 0.

### US-005: Capture manual review evidence

**Description:** As a reviewer, I want a command transcript of the branch CLI so that I can see each upgrade path work.

**Acceptance Criteria:**

- [ ] `.agro/tasks/simplify-self-upgrade/evidence/manual-review.md` holds a transcript of the built branch CLI. Each run uses `node .agro/cli/dist/agro.js self-upgrade` on a copy in a new temp directory.
- [ ] Each standalone run sets `AGRO_JS_URL` inline to a local HTTP artifact.
- [ ] The transcript shows three runs: `--dry-run` for an npm-shaped path, a standalone upgrade with the pinned shebang, and the refusal of a checkout `dist/agro.js`.
- [ ] The transcript shows that `agro sandbox install` code has no star prompt line (`git grep` output).
- [ ] The story creates no live resource and deletes each temp directory that it creates.

## Summary

`agro self-upgrade` is 462 lines. It classifies five install kinds and parses and compares SemVer. It refuses downgrades and a PATH shadow, checks that the target reports the running version, and keeps a `.prev` backup with rollback.

The released installers create two kinds. `npm install -g @mifune/agro` puts the file under `node_modules/@mifune/agro/`. `.agro/scripts/install.sh` (the `get-agro.sh` release asset) installs one file at `$AGRO_BIN_DIR/agro`, mode `0755`, and can pin the shebang to `~/.local/share/agro/node`. The sandbox image (`/opt/agro`) and a source checkout are not installer kinds. The command refuses them today and keeps that refusal in one generic message.

The selected approach keeps three checks that protect the target: the `#!` check, the `--version` run on the new file before the rename, and the same-directory rename. The approach also keeps the pinned shebang, because `docs/installation.md` states that an upgrade keeps it. The approach deletes the SemVer code, the downgrade gate, the PATH and self checks, and the `.prev` rollback. A failed rename leaves the old target in place.

The star prompt (`star-prompt.ts`) prints one line after `agro sandbox install`. The task deletes the module, its two call sites in `sandbox.ts`, its test, and its `docs/configuration.md` row.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/self-upgrade.ts` | `runSelfUpgrade`, `defaultDeps`, `DEFAULT_ARTIFACT_URL` | Upgrade logic |
| `.agro/cli/src/cli.ts` | `printSelfUpgradeHelp`, `parseSelfUpgradeArgs`, `update`/`self-upgrade` dispatch | Help text and wiring |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | all cases | Behavior tests |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | self-upgrade help and alias cases | Help and alias tests |
| `.agro/cli/src/commands/sandbox.ts` | `maybePrintStarPrompt` call sites | Star prompt call sites |
| `.agro/cli/src/lib/star-prompt.ts` | `maybePrintStarPrompt`, `STAR_PROMPT_LINE` | Deleted module |
| `.agro/scripts/install.sh` | `AGRO_BIN_DIR`, shebang pin | Standalone install shape (read only) |
| `.agro/scripts/__tests__/helpers/sandbox-routing.ts` | `instructionFiles`, `sourceProvenance` | Hash of `docs/lifecycle-commands.md` |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro self-upgrade [--dry-run]`, `agro update` | Behavior | Two upgrade paths and one generic refusal |
| `agro sandbox install` output | Removed line | No star prompt line |
| `AGRO_NO_STAR_PROMPT` | Removed variable | The CLI reads it no longer |

## Storage

N/A. The star prompt marker file `star-prompt-shown` in the user state home is no longer written. The task does not delete existing marker files.

## Architectural Decisions

- The realpath of `argv[1]` is the only source of the install kind.
- The npm path uses the dist-tag `latest`. npm owns version resolution.
- The standalone path replaces the target with one same-directory rename.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | npm args, npm failure, standalone replace, pinned shebang, bad artifact, bad `--version`, generic refusal, dry run | US-002 |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | help text, `update` alias, vendor-flag refusal | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | existing cases | US-001 |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | replay provenance and oracles | US-004 |

## Design Principles

- Keep only the checks that protect the target file.
- No explanatory comments in tracked code.
- Prose follows `/ste`.

## Out of Scope

- A version argument for `agro self-upgrade`.
- A change to `install.sh` or to the release workflow.
- An upgrade path for the image or a source checkout.

## Open Questions

None

## Acceptance Criteria

- [ ] `agro run -- pnpm typecheck` exits 0.
- [ ] `agro run -- pnpm test` exits 0.
- [ ] `bash .agro/skills/delegate/scripts/next.sh` prints `done`.
- [ ] CI on the PR is green.

## Lessons

1. Claim: the curl-install path does not need most of the old code. Evidence: `self-upgrade.ts` drops from 462 to 120 lines. The standalone path keeps four parts: the `#!` check, the `--version` run on the new file, the pinned Node shebang, and the same-directory rename. The manual review transcript shows an upgrade that keeps the fnm shebang at mode `755`. Outcome: fixed in this PR.
2. Claim: the plan gave test commands in the form `pnpm --dir .agro/cli exec vitest run src/...`. The `--dir` form finds no test files, because the only vitest config is at the repository root. Evidence: the US-001 worker report shows "No test files found" and exit 1, and the root-relative form exits 0. Outcome: fixed in this PR. The plan and `prd.json` now use root-relative paths.
3. Claim: `.gitignore` ignores `.agro/tasks/*/evidence/`, so a plain `git add` skips the evidence files. Evidence: `git add` refused `evidence/manual-review.md`. `.agro/skills/git/references/manual-review.md` names `git add -f` as the remedy for a linked file. Outcome: dropped, because the documented remedy works. The PR links only the manual review file, so `baseline.md` stays local.
4. Claim: a clipboard case in `bundle-identity.test.ts` fails under `umask 077`. Evidence: the US-002 worker saw a failure at line 167 under `umask 077`, and the case passes under the default umask and on CI. Outcome: dropped, because the case is a test-environment flake outside this change.
5. Claim: an edit to any section of `docs/lifecycle-commands.md` makes the sandbox routing replay stale. Evidence: US-003 changed only the self-upgrade section, and US-004 needed 17 fresh agents to record the replay again. Outcome: dropped, because the cost is process cost and not a correctness or security risk.
