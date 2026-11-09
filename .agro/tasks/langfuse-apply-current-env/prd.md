# PRD: Langfuse apply acts on the current environment

Status: DRAFT

## User Stories

### US-001: Remove the sandbox gate from the langfuse verbs

**Description:** As an operator, I want the langfuse verbs to act on my `$HOME` so that I can configure tracing on a VM.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/commands/langfuse.ts` contains no `insideSandbox`, no `hostRefusal`, and no import of `runningInsideSandbox`.
- [ ] `LangfuseOptions` keeps `home?: string` as the only home override and has no `insideSandbox` field.
- [ ] `runLangfuseApply` with `langfuse.enabled=true` and an empty fixture home writes every generated file under that home and returns 0.
- [ ] `runLangfuseStatus` checks the fragment and every generated file in every environment. Its output never contains `generated in the sandbox`.
- [ ] `runLangfuseDisable` removes the fragment under the fixture home, rewrites the harness files, and returns 0.
- [ ] The wizard test that expected exit 1 and the text `settings saved; run \`agro langfuse apply\` in the sandbox` now expects exit 0 and every path from `generatedPaths(f.home)` present.
- [ ] The `sandboxOpts` fixture in `.agro/cli/src/commands/__tests__/langfuse.test.ts` has no `insideSandbox` parameter. Each caller compiles.
- [ ] The `agro langfuse` help text in `.agro/cli/src/cli.ts` states that the verbs write under the `$HOME` of the CLI user. The help text makes no claim that `apply` and `disable` refuse on the host.
- [ ] `pnpm exec vitest run .agro/cli/src/commands/__tests__/langfuse.test.ts` exits 0.
- [ ] `pnpm run typecheck` exits 0.

### US-002: Update the Langfuse documentation and changelog

**Description:** As an operator, I want the documentation to describe host and sandbox use of the langfuse verbs so that the documentation matches the CLI.

**Acceptance Criteria:**

- [ ] `docs/integrations/langfuse.md` no longer says that `~/.claude`, `~/.pi`, and `~/.codex` exist only in the sandbox. The text no longer says that the host refuses the file work.
- [ ] `docs/integrations/langfuse.md` states that the verbs write under the `$HOME` of the user who runs them, in the sandbox or on a host.
- [ ] `docs/integrations/langfuse.md` tells a host shell to source `~/.config/agro/langfuse.env` between `set -a` and `set +a`. The text links to the manual configuration section.
- [ ] The wizard instruction at `docs/integrations/langfuse.md:28` no longer requires the sandbox.
- [ ] `docs/lifecycle-commands.md` no longer says "run these verbs in the sandbox" for the langfuse verbs.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` that describes the change.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/integrations/langfuse.md` reports no finding on a changed line.

### US-003: Record the manual review evidence

**Description:** As the advisor, I want a host command transcript so that the pull request shows the change through the operator entry point.

**Acceptance Criteria:**

- [ ] `.agro/tasks/langfuse-apply-current-env/evidence/manual-review.md` holds a transcript of the worktree build of `agro langfuse apply`, `status`, and `disable` on the host. Each command sets `HOME` inline to a new temp directory.
- [ ] The transcript shows `apply` exit 0 and the files that it wrote under the temp `HOME`.
- [ ] The transcript shows `status` exit 0. Each file shows the state `current`.
- [ ] The transcript shows `disable` exit 0 and the fragment removed.
- [ ] The story restores `langfuse.enabled` in `agro.json` to its value before the run, and deletes the temp `HOME`.
- [ ] The story writes no env file and reads no env file directly.

## Summary

`agro langfuse apply` refuses on the host with the message `~/.claude and ~/.pi exist only in the sandbox — settings saved; run \`agro langfuse apply\` in the sandbox or restart it`. The operator runs AGRO directly on an exe.dev VM and wants the verbs to act on the current environment.

Verified current state:

- `context()` in `.agro/cli/src/commands/langfuse.ts` sets `home: opts.home ?? homedir()` and `insideSandbox: opts.insideSandbox ?? runningInsideSandbox()`.
- Three branches read `ctx.insideSandbox`: `runLangfuseApply` refuses, `runLangfuseStatus` prints a stub and skips the file check, and `runLangfuseDisable` refuses after it sets `langfuse.enabled=false`. The disable branch leaves a half-completed state on the host.
- The wizard `runLangfuseSetup` reaches the apply gate and the disable gate.
- Each tracing writer writes only under `home`. No writer references a sandbox-only path.
- `.devcontainer/entrypoint.sh` runs `agro langfuse apply` as the `sandbox` user with `HOME=/home/sandbox`. The gate always passed there, so the sandbox path does not change.
- The refusal came from the original design in #1132 (FR-18). The design gave no security reason. `agro harness install` and `agro tool install` already fall back to a host install.

Selected approach: delete the gate. Each verb acts on `opts.home ?? homedir()`. No new flag.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/langfuse.ts` | `LangfuseOptions`, `Context`, `context`, `hostRefusal`, `runLangfuseApply`, `runLangfuseStatus`, `runLangfuseDisable` | Remove the gate and its message |
| `.agro/cli/src/commands/__tests__/langfuse.test.ts` | `sandboxOpts`, host status test, host wizard test | Replace host-refusal assertions with host-write assertions |
| `.agro/cli/src/cli.ts` | `agro langfuse` help text | Describe the new behavior |
| `docs/integrations/langfuse.md` | wizard section, host paragraph | Describe host and sandbox use |
| `docs/lifecycle-commands.md` | langfuse verb table note | Remove the sandbox-only instruction |
| `CHANGELOG.md` | `## [Unreleased]` | Record the change |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro langfuse apply` | Behavior | Writes on the host instead of exit 1 |
| `agro langfuse status` | Behavior | Checks the files on the host instead of a stub line |
| `agro langfuse disable` | Behavior | Completes on the host instead of exit 1 after the config change |
| `agro config langfuse` | Behavior | Completes on the host through apply and disable |
| `LangfuseOptions.insideSandbox` | Removal | The test-only option goes away |

## Storage

No schema change. The verbs write the same files as before: `~/.config/agro/langfuse.env`, `~/.claude/settings.json`, `~/.pi/agent/langfuse.json`, and `~/.codex/langfuse.json`, under the home of the user who runs the CLI. `agro.json` keeps the `langfuse.*` settings.

## Architectural Decisions

- The home of the process (`opts.home ?? homedir()`) is the single target. The CLI does not decide where the harness homes live.
- `runningInsideSandbox` stays in `lib/execution/detect.ts`. Other commands use it.
- The entrypoint keeps its call to `agro langfuse apply`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/commands/__tests__/langfuse.test.ts` | apply writes every generated file under an empty fixture home | Apply has no gate |
| `.agro/cli/src/commands/__tests__/langfuse.test.ts` | status reports each file state and never prints `generated in the sandbox` | Status has no stub branch |
| `.agro/cli/src/commands/__tests__/langfuse.test.ts` | disable removes the fragment and returns 0 | Disable completes |
| `.agro/cli/src/commands/__tests__/langfuse.test.ts` | the wizard returns 0 and writes every generated file | The wizard completes |
| `ci-harness.yml` | `pnpm run typecheck`, `pnpm test:scripts` | Full suite stays green |

## Design Principles

- Delete obsolete paths instead of keeping dormant alternatives.
- Keep one source of truth: the process home.
- Add no comment to tracked code.
- Keep the sandbox boot path unchanged.

## Out of Scope

- Skipping a harness whose home directory does not exist.
- Changes to directory or file modes.
- A new flag such as `--host` or `--here`.
- Automatic edits to host shell profiles to source the fragment.
- Plugin installs on the host.

## Open Questions

None.

## Acceptance Criteria
- [ ] On a host, `agro langfuse apply` with `langfuse.enabled=true` exits 0 and writes the generated files under `$HOME`.
- [ ] No source file under `.agro/cli/src` contains the text `exist only in the sandbox`.
- [ ] `pnpm run typecheck` and `pnpm test:scripts` exit 0.
- [ ] CI workflow `ci-harness.yml` passes on the task pull request.

## Lessons

- Claim: a host shell does not load the credential fragment, so a host apply alone does not export the keys. Evidence: `.devcontainer/Dockerfile` installs `.agro/install/.zshenv` only in the image. Outcome: fixed in this PR. `docs/integrations/langfuse.md` tells a host shell to source the fragment between `set -a` and `set +a`.
- Claim: `docs/configuration.md` says that `agro langfuse apply` reads the keys from the checkout at `/home/sandbox/harness`. Evidence: `docs/configuration.md:48`. On a host, the CLI reads the `.env` of the project checkout. Outcome: dropped. The sentence describes container processes, the file is outside this PR, and the finding is not a correctness or security risk.
- Claim: the operator-only path guard refused a direct `test -e` of the fragment path during the evidence run. Evidence: `evidence/manual-review.md`. Outcome: dropped. The CLI output `removed` and the next `status` line `absent` prove the removal, and the friction is tooling only.
