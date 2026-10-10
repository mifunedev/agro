# PRD: Add fx as an optional harness

Status: DRAFT

Issue: [#1339](https://github.com/mifunedev/agro/issues/1339)

## User Stories

### US-001: Write the fx validation check

**Description:** As the advisor, I want a credential-free `remote-sandbox` check for fx. An exe.dev VM then proves the installer, the pin, and fx discovery before the catalog change.

**Acceptance Criteria:**

- [ ] The check is at `.agro/tasks/fx-harness/checks/fx-harness.sh`. The check prints `RESULT <id> <PASS|FAIL|INFO> <detail>` lines and ends with `SUMMARY fails=<n>`.
- [ ] The check uses image mode: the VM boots `ghcr.io/mifunedev/agro:latest`, and the check runs each fx command as `su - sandbox -c` in `/home/sandbox/harness`.
- [ ] Row `X0-workspace` passes only when `/home/sandbox/harness/AGENTS.md` exists and `/home/sandbox/harness/.agents/skills` resolves to `.agro/skills`.
- [ ] Row `X1-install` runs `curl -fsSL https://fx.sh/setup.sh | FX_INSTALL_DIR="/home/sandbox/.local/bin" bash -s v0.0.13` and passes on exit code 0.
- [ ] Row `X2-version` passes when `fx --version` exits 0. The row prints the version output.
- [ ] Row `X3-binary-path` passes when `command -v fx` prints `/home/sandbox/.local/bin/fx`.
- [ ] Row `X4-status` and row `X5-doctor` print the output of `fx status --json` and `fx doctor --json` to the log.
- [ ] Row `X6-instructions` reports PASS when the X4 or X5 output names `AGENTS.md`, and INFO when the output does not name instruction files.
- [ ] Row `X7-skills` reports the number of entries for the `git` skill when the X4 or X5 output lists skills, and INFO when the output does not list skills.
- [ ] Row `X8-uninstall` runs `rm -f /home/sandbox/.local/bin/fx` and passes when `command -v fx` then exits 1.
- [ ] The check reads no token, no `.env` file, and no fx credential.

### US-002: Run the fx validation on exe.dev

**Description:** As the advisor, I want the US-001 check to run on a fresh exe.dev VM so that the plan uses observed fx behavior.

**Acceptance Criteria:**

- [ ] The operator approves the run before the advisor starts the driver.
- [ ] The advisor starts `IMAGE=ghcr.io/mifunedev/agro:latest bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/fx-harness/checks/fx-harness.sh` detached in a named tmux session.
- [ ] The log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.
- [ ] `.agro/tasks/fx-harness/evidence/exedev-validation.md` holds each `RESULT` line copied from the log, the log path, and the image digest.
- [ ] Rows `X0`, `X1`, `X2`, `X3`, and `X8` show PASS. If a row shows FAIL, the advisor sets the plan status to `BLOCKED` and records the cause.
- [ ] The evidence file states the result for Decision 1 and Decision 2 as `confirmed`, `deferred to US-005`, or `failed`.
- [ ] If row `X7` shows more than one `git` entry, the advisor opens a follow-up issue for Decision 1 option B and links the issue in the evidence file.

### US-003: Add the fx catalog entry

**Description:** As an operator, I want `agro harness install fx` so that I can run the Vercel Labs fx coding agent in the sandbox without an image rebuild.

**Acceptance Criteria:**

- [ ] `HARNESS_CATALOG` in `.agro/cli/src/lib/harnesses/catalog.ts` holds an entry with `id: "fx"`, `title: "fx"`, `binary: "fx"`, `installUser: "sandbox"`, `kind: "installable"`, and `docsPath: "docs/harnesses/fx.md"`.
- [ ] The fx `installArgv` is `["bash", "-lc", "set -o pipefail; curl -fsSL https://fx.sh/setup.sh | FX_INSTALL_DIR=\"{{prefix}}/bin\" bash -s v0.0.13"]`, with `HARNESS_PREFIX_TOKEN` as the prefix.
- [ ] The fx `verifyArgv` is `["fx", "--version"]`.
- [ ] The fx `uninstallArgv` is `["rm", "-f", "{{prefix}}/bin/fx"]`, with `HARNESS_PREFIX_TOKEN` as the prefix.
- [ ] A test case asserts that the fx `installArgv` contains the literal `bash -s v0.0.13`. The case does not use `versionPins`.
- [ ] Red first: the new cases in `.agro/cli/src/__tests__/harness-catalog.test.ts` fail before the catalog change and pass after the catalog change.
- [ ] `npm test` exits 0 at the repository root.
- [ ] `npm run typecheck` exits 0 at the repository root.

### US-004: Document fx and its AGRO integration

**Description:** As an operator, I want a `docs/harnesses/fx.md` page so that I know how to install fx, sign in, and which AGRO primitives fx uses.

**Acceptance Criteria:**

- [ ] `docs/harnesses/fx.md` exists and has the sections Install, Uninstall, Authentication, Common usage, AGRO integration, and References.
- [ ] The Authentication section names `fx login`, `fx login codex`, `fx login grok`, and `fx setup`.
- [ ] The AGRO integration section states that fx loads the root `AGENTS.md` and each nested `AGENTS.md` that applies to the target file.
- [ ] The AGRO integration section states that fx discovers AGRO skills through `.agents/skills` and `.claude/skills`, and that both links resolve to `.agro/skills`.
- [ ] If US-002 or US-005 records a truncated skill catalog, the AGRO integration section shows `context_limits.skill_catalog_bytes` in `~/.fx/settings.json`.
- [ ] The AGRO integration section states that AGRO hooks in `.agro/hooks/` do not run under fx, and names each guard that is absent: `deny-env-dump.sh`, `deny-secret-paths.sh`, `warn-devtcp.sh`, `notify_slack.sh`, and `cc-safety-net`.
- [ ] The AGRO integration section states that fx reports its state to Herdr through its built-in Herdr provider.
- [ ] `docs/harnesses/overview.md` lists fx in the installable sentence on line 7 and in the harness table.
- [ ] `docs/README.md` links to `harnesses/fx.md`.
- [ ] `CHANGELOG.md` has one `### Added` entry under `## [Unreleased]` that links issue #1339.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/fx.md` exits 0.

### US-005: Record the manual review evidence

**Description:** As the advisor, I want a signed-in command transcript from the local sandbox. The transcript proves the AGRO integration that the credential-free run cannot prove, for the PR `## Manual review` section.

**Acceptance Criteria:**

- [ ] The transcript is at `.agro/tasks/fx-harness/evidence/manual-review.md`.
- [ ] The transcript shows `agro harness install fx` with exit code 0 inside the local sandbox.
- [ ] The transcript shows `agro harness list` with an `fx` row.
- [ ] With operator approval and operator sign-in in a Herdr pane, the transcript shows an fx session that names one rule from the root `AGENTS.md`.
- [ ] The same session lists the `git` skill. The transcript records the number of `git` entries and any skill-catalog truncation notice.
- [ ] The transcript shows `agro harness uninstall fx` with exit code 0, and `command -v fx` with exit code 1 after the uninstall.
- [ ] The transcript links `.agro/tasks/fx-harness/evidence/exedev-validation.md`.

## Summary

[fx](https://github.com/vercel-labs/fx) is a native coding agent CLI from Vercel Labs. The fx project uses Zig and the Apache-2.0 license. The project status is experimental. The latest release is `v0.0.13`. `https://releases.fx.sh/latest.txt` returns `v0.0.13`.

### Installer

`https://fx.sh/setup.sh` sets `BIN_DIR="${FX_INSTALL_DIR:-$HOME/.local/bin}"`. The script accepts a version as its first argument. Without an argument, the script reads `latest.txt`. The installer matches the curl pattern of `grok-build`, `muse-code`, and `antigravity-cli` in `HARNESS_CATALOG`.

### Research: AGENTS.md

Source: `https://fx.sh/docs/configure-fx/project-instructions.md`.

- fx reads `AGENTS.md` from the start directory. Under the home directory, fx also reads the `AGENTS.md` of each parent directory up to the home directory. fx does not read `AGENTS.md` in the home directory itself.
- fx loads a nested `AGENTS.md` when fx works on a file below that directory. The closest file wins a conflict. This rule matches the AGRO rule "resolve conflicts by target-path specificity".
- `~/.fx/AGENTS.md` holds personal instructions.
- An additional workspace does not contribute `AGENTS.md`. AGRO project clones under `projects/` are separate start directories, so this limit does not affect them.
- The default limits are 64 KiB for each instruction file and 128 KiB for all project instructions. The root `AGENTS.md` is 9339 bytes.
- `context: false` in `.fx.json` turns off instruction loading. AGRO does not ship `.fx.json`.

Result: AGRO needs no change for `AGENTS.md`.

### Research: skills

Source: `https://fx.sh/docs/capabilities/skills.md`.

- fx searches these project roots from the workspace upward, and stops before the home directory: `.fx/skills/`, `skills/`, `.opencode/skills/`, `.codex/skills/`, `.claude/skills/`, `.agents/skills/`, `.claw/skills/`.
- fx then searches the user roots `~/.fx/skills/`, `~/.agents/skills/`, `~/.claude/skills/`, and others.
- `SKILL.md` uses YAML frontmatter with `name` and `description`. AGRO skills use the same format.
- In this repository, `.agents/skills` and `.claude/skills` are symlinks to `../.agro/skills`. `.agro/scripts/link-providers.sh` owns both links.
- The repository has no `skills/` directory and no `.fx/` directory.
- The default skill catalog budget is 2% of the model context window. Each skill description has a 1 KiB limit.

Result: AGRO needs no new provider link. Two roots point to one pack. The open questions record the duplicate-entry risk and the catalog-budget risk.

### Research: hooks

Sources: `src/core/hooks/definitions.zig` and `src/builtins/hooks.zig` in `vercel-labs/fx`, and the fx documentation.

- fx has an internal lifecycle hook runtime with four events: `PreToolUse`, `Stop`, `PostTurnEnd`, and `AttentionRequired`.
- Only first-party in-process handlers register on these events. The built-in providers are Herdr state reporting (`fx.herdr.turn_end`, `fx.herdr.attention_required`) and notifications.
- The fx documentation describes no user-configured command hook. Neither `~/.fx/settings.json` nor `.fx.json` accepts a hook key.
- fx has permission rules with `allow`, `ask`, and `deny` wildcard patterns for `bash` and `edit`. Only `~/.fx/settings.json` holds these rules. A project `.fx.json` cannot define them.

Result: the AGRO hooks in `.agro/hooks/` cannot attach to fx. These guards do not run under fx: `deny-env-dump.sh`, `deny-secret-paths.sh`, `warn-devtcp.sh`, `notify_slack.sh`, and `cc-safety-net`. The Docker sandbox stays the security boundary. Hook parity is out of scope. The built-in Herdr provider gives fx Herdr state reporting with no AGRO change.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | `HARNESS_CATALOG` | Holds the new `fx` entry. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `covers every harness the verb can install`, `SHIPPED_SANDBOX_INSTALL_ARGV`, host-prefix `it.each`, `versionPins` | Adds fx to the installable list, the shipped argv table, the host-prefix cases, and a pin case. |
| `docs/harnesses/fx.md` | new page | Documents install, auth, usage, and AGRO integration. |
| `docs/harnesses/overview.md` | line 7 and harness table | Lists fx. |
| `docs/README.md` | harness link list | Links fx. |
| `CHANGELOG.md` | `## [Unreleased]` | Holds the `### Added` entry. |
| `.agro/tasks/fx-harness/checks/fx-harness.sh` | new check | Validates the installer, the pin, and fx discovery on exe.dev. |
| `.agro/skills/remote-sandbox/scripts/run.sh` | driver | No change. The driver accepts a check path. |
| `.agro/scripts/link-providers.sh` | `provider_links` | No change. The existing `.agents/skills` and `.claude/skills` links serve fx. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install fx` | New | Installs `fx` into `~/.local/bin` in the sandbox. |
| `agro harness uninstall fx` | New | Deletes `~/.local/bin/fx`. |
| `agro harness list` and `agro harness status` | Modify | Report fx. |
| `docs/harnesses/fx.md` | New | Operator documentation. |

## Storage

N/A. The change adds no persisted state. The fx binary lands in the existing home volume at `~/.local/bin`. fx keeps its own credentials and settings in `~/.fx/`. That directory is in the persistent home volume.

## Architectural Decisions

- **Source of truth:** `HARNESS_CATALOG` owns the fx install, verify, and uninstall commands.
- **Validation:** the exe.dev check stays in the task folder. AGRO adds no reusable `remote-sandbox` check, because no second harness needs one now.
- **Version pin:** pin `v0.0.13`. The `v` prefix matches the format of `latest.txt`.
- **Instructions and skills:** fx uses the existing root `AGENTS.md` and the existing `.agents/skills` link. AGRO adds no fx mirror and no `.fx/` directory.
- **Hooks:** AGRO adds no fx hook adapter, because fx exposes no user hook surface. The docs state the gap.
- **Auth and scoping:** the operator signs in from a Herdr pane inside the sandbox. AGRO stores no fx credential.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `covers every harness the verb can install` includes `fx` | Catalog membership |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `SHIPPED_SANDBOX_INSTALL_ARGV` row for `fx` | Exact sandbox install argv |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | host-prefix `it.each` includes `fx` | Prefix substitution with no `/home/sandbox` and no `$HOME` |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `keeps the fx pin in the catalog` asserts the literal `bash -s v0.0.13` | Version pin |
| `.agro/tasks/fx-harness/checks/fx-harness.sh` | rows `X0` to `X8` on exe.dev | Installer, pin, binary path, discovery, uninstall |

## Design Principles

- Make the smallest change. Copy the `muse-code` entry shape.
- Write the failing tests first.
- Add no fx-specific mirror. Keep `.agro/skills` and the root `AGENTS.md` as the only sources.
- State each absent guard in the docs. Do not hide the hook gap.

## Out of Scope

- A `.fx/skills` link. A follow-up issue owns that change if US-002 or US-005 shows duplicates.
- A branch build of the AGRO CLI on exe.dev. The catalog tests cover the CLI wiring.
- An fx hook adapter, and any permission-rule template that copies the AGRO guards into `~/.fx/settings.json`.
- A tracing writer for fx sessions.
- libfx, WebAssembly, and `fx acp` embedding.
- fx as a default harness.
- A `.fx.json` project file.

## Open Questions

The operator answered the earlier questions. Each answer is a decision below.

1. **Duplicate skills:** measure in US-002 and US-005. If fx shows more than one entry for a skill, open a follow-up issue for option B: a `.fx/skills` link to `.agro/skills`. fx searches every root, so option B can still show duplicates. The follow-up issue must test option B before the issue proposes the link.
2. **Skill catalog budget:** measure in US-002 and US-005. If fx truncates the catalog, US-004 documents `context_limits.skill_catalog_bytes`.
3. **Pin test:** assert the literal `bash -s v0.0.13`. Do not change `versionPins`.
4. **Permission rules:** out of scope. Document the hook gap only.
5. **Validation:** two stages. US-002 runs the credential-free check on exe.dev before the catalog change. US-005 runs the signed-in check in the local sandbox.

One question stays open until US-002 runs: do `fx status --json` and `fx doctor --json` report instruction files and skills? If the output reports neither, Decisions 1 and 2 move to US-005.

## Acceptance Criteria

- [ ] Every story in this plan passes.
- [ ] `npm test` exits 0 at the repository root.
- [ ] `npm run typecheck` exits 0 at the repository root.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 with no change to `.agro/scripts/link-providers.sh`.
- [ ] The draft PR title is `FROM feat/1339-fx-harness TO development`, and the PR body holds `Closes #1339`.

## Lessons

1. **Claim:** fx runs no AGRO hook. **Evidence:** the fx source registers only first-party handlers, and the fx documentation names no hook setting. **Outcome:** fixed in this PR. `docs/harnesses/fx.md` names each absent guard.
2. **Claim:** the sandbox banner shows no status line for fx, Hermes, or Muse Code. **Evidence:** `.agro/install/banner.sh` has status lines for Claude Code, Codex, Pi, OpenCode, Grok Build, and Antigravity CLI only. **Outcome:** proposed issue `bug: banner omits fx, hermes, and muse-code harness status`. The advisor creates the issue only after operator approval.
3. **Claim:** a `remote-sandbox` run records no image digest. **Evidence:** the US-002 log names only the tag `latest`. The secret guard refused the GHCR lookup, and the packages API needs the `read:packages` scope. **Outcome:** proposed issue `feat: remote-sandbox logs the booted image digest`. The advisor creates the issue only after operator approval.
4. **Claim:** the catalog test requires each `docsPath` to exist, so US-003 and US-004 could not pass apart. **Evidence:** `.agro/cli/src/__tests__/harness-catalog.test.ts:55`. **Outcome:** dropped. The observation concerns plan sequencing, and the PR records the merged stories under Where it diverged.
