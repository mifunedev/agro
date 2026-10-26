# PRD: Rename the Claude Code harness id to `claude`

Status: DRAFT

## User Stories

### US-001: Make `claude` the canonical harness id and keep `claude-code` as a deprecated alias

**Description:** As an operator, I want to run `agro harness install claude` so that the harness id matches the `claude` binary.

**Acceptance Criteria:**

- [ ] `HARNESS_CATALOG` in `.agro/cli/src/lib/harnesses/catalog.ts` holds `id: "claude"` and holds no entry with `id: "claude-code"`.
- [ ] `findHarness("claude-code")` returns the entry with `id: "claude"`. `harnessIds()` does not return `claude-code`.
- [ ] `agro harness install claude-code`, `agro harness uninstall claude-code`, and `agro harness status claude-code` each write this line to stderr and then act on the `claude` entry: `agro harness: "claude-code" is a deprecated alias for "claude"; the alias stops working in 0.29.0`.
- [ ] `agro harness install claude` writes no deprecation line.
- [ ] `agro harness list` and `agro harness list --json` show `claude` and do not show `claude-code`.
- [ ] `PLUGIN_PROBES` in `.agro/cli/src/commands/langfuse.ts` holds `harnessId: "claude"`.
- [ ] The npm package name `@anthropic-ai/claude-code` and `docsPath: "docs/harnesses/claude-code.md"` stay unchanged.
- [ ] A red test in `harness-catalog.test.ts` fails before the change and passes after the change. The test resolves `claude-code` to the `claude` entry.
- [ ] `pnpm run typecheck` exits 0. `pnpm test:scripts` exits 0.

### US-002: Migrate the stored install records from `claude-code` to `claude`

**Description:** As an operator with an existing install, I want the CLI to find my old install record so that `status`, `install`, and `uninstall` keep working.

**Acceptance Criteria:**

- [ ] When `~/.agro/config.json` holds `hostHarnesses["claude-code"]` and holds no `hostHarnesses["claude"]`, `readHostConfig` returns the receipt under `hostHarnesses["claude"]` and returns no `claude-code` key.
- [ ] When both keys exist, `readHostConfig` keeps `hostHarnesses["claude"]` and drops `hostHarnesses["claude-code"]`.
- [ ] After a host install of `claude`, `~/.agro/config.json` holds `hostHarnesses["claude"]` and holds no `claude-code` key.
- [ ] A host `uninstall claude` finds a receipt that the CLI recorded under `claude-code` and does not refuse for a missing record.
- [ ] In the sandbox, `install claude` prints `updating Claude Code in the sandbox…` when only `/home/sandbox/.local/share/agro/harnesses/claude-code.installed` exists and the binary is present.
- [ ] After a sandbox install of `claude`, `claude.installed` exists and `claude-code.installed` does not exist.
- [ ] After a sandbox uninstall of `claude`, neither `claude.installed` nor `claude-code.installed` exists.
- [ ] Red tests in `host-config.test.ts` and `harness.test.ts` fail before the change and pass after the change.
- [ ] `pnpm run typecheck` exits 0. `pnpm test:scripts` exits 0.

### US-003: Update scripts, checks, documentation, and the changelog to `claude`

**Description:** As an operator, I want every printed hint and every document to name `agro harness install claude` so that no surface tells me to type the deprecated id.

**Acceptance Criteria:**

- [ ] `.agro/install/banner.sh` prints `harness install claude`.
- [ ] The first field of the Claude entry in `.agro/scripts/sandbox-upgrade-smoke.sh` is `claude`. The second field stays `claude`, and the third field stays `@anthropic-ai/claude-code`.
- [ ] `.agro/skills/remote-sandbox/checks/openshell-journey.sh` and `.agro/skills/remote-sandbox/checks/docker-egress.sh` run `agro harness install claude`.
- [ ] `README.md`, `docs/quickstart.md`, `docs/harnesses/claude-code.md`, and `docs/harnesses/overview.md` name `claude` in each `agro harness install`, `agro harness uninstall`, and harness-id table cell.
- [ ] `git grep -nE 'harness (install|uninstall|status) claude-code'` returns matches only in `CHANGELOG.md` entries for released versions and in `.agro/tasks/`.
- [ ] The test fixtures in `sandbox-boot-smoke.test.ts`, `verify-sandbox-image.test.ts`, and `sandbox-upgrade-smoke.test.ts` use the id `claude`.
- [ ] `CHANGELOG.md` `## [Unreleased]` `### Changed` holds this entry: "Rename the Claude Code harness id from `claude-code` to `claude`. `claude-code` stays a deprecated alias until 0.29.0, which removes that alias."
- [ ] `pnpm test:scripts` exits 0.

### US-004: Retake the quickstart harness-install screenshot

**Description:** As a new operator, I want the quickstart screenshot to show `agro harness install claude` so that the image matches the command on the page.

**Acceptance Criteria:**

- [ ] The worker asks the operator for approval before the worker creates the capture sandbox.
- [ ] The capture follows the method in `.agro/tasks/agro-docs-screenshots/prd.md`: a temporary sandbox, a Herdr pane, and a 1280x720 PNG.
- [ ] The capture sandbox runs the CLI built from the task branch. `agro harness install claude` runs in the Herdr pane and prints `claude: installed`.
- [ ] `docs/img/quickstart-harness-install.png` shows `agro harness install claude` and the install result line.
- [ ] The screenshot shows no real name, email address, token, or public IP address.
- [ ] The alt text in `docs/quickstart.md` names `agro harness install claude`.
- [ ] The worker deletes the capture sandbox after the capture, and the evidence records the delete command and its exit status.

### US-005: Record the manual review transcript

**Description:** As the advisor, I want a command transcript of the rename so that the PR `## Manual review` section shows the observed behavior.

**Acceptance Criteria:**

- [ ] The worker runs `pnpm run build:harness` on the host, and the command exits 0.
- [ ] `.agro/tasks/rename-claude-harness-id/evidence/manual-review.md` embeds the new `docs/img/quickstart-harness-install.png`.
- [ ] `.agro/tasks/rename-claude-harness-id/evidence/manual-review.md` holds the command and output of `node .agro/cli/dist/agro.js harness list`.
- [ ] The transcript holds the command and output of `node .agro/cli/dist/agro.js harness status claude-code` with the deprecation line on stderr.
- [ ] The transcript holds the command and output of `node .agro/cli/dist/agro.js harness install nope`. The output lists `claude` and does not list `claude-code`.
- [ ] The transcript holds the output of `bash .agro/install/banner.sh` or states the reason that the banner did not run.
- [ ] The worker creates no live resource and runs no install against a sandbox without operator approval.

## Summary

The harness id `claude-code` has one definition at `.agro/cli/src/lib/harnesses/catalog.ts:31`. `findHarness` (`catalog.ts:230`) matches the id exactly. The CLI has no alias mechanism. The binary is already `claude` (`catalog.ts:33`).

The id also keys two stored records:

- the host receipt `hostHarnesses[entry.id]` in `~/.agro/config.json` (`harness.ts:479`, `harness.ts:549`, `host-config.ts:39`);
- the sandbox marker `/home/sandbox/.local/share/agro/harnesses/<id>.installed` (`harness.ts:143`).

A hard rename orphans both records. A hard rename also breaks operator scripts, published content, and vendored projects that run an older banner or check. `agro vendor` overwrites files and never deletes files (`update.ts:57`). The installed CLI and the vendored control plane upgrade on separate schedules.

Five explorers compared a hard rename against a rename with an alias. Four explorers selected the alias. This plan follows the `get-agro.sh` precedent at `CHANGELOG.md:196`: rename now, keep a hidden deprecated alias, and name the removal release.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | `HARNESS_CATALOG`, `findHarness`, `harnessIds` | Canonical id and alias resolution |
| `.agro/cli/src/commands/harness.ts` | `unknownHarness`, `sandboxMarkerPath`, `sandboxMarkerExists`, `installOnHost`, `runHarnessInstall`, uninstall at line 594, status at line 232 | Deprecation notice, marker and receipt lookup |
| `.agro/cli/src/lib/host-config.ts` | `readHostConfig`, `HostConfig.hostHarnesses` | Receipt key migration on read |
| `.agro/cli/src/commands/langfuse.ts` | `PLUGIN_PROBES` | Langfuse plugin probe keyed by harness id |
| `.agro/install/banner.sh` | `claude_detail` | Printed install hint |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | harness list at line 43 | Smoke label |
| `.agro/skills/remote-sandbox/checks/openshell-journey.sh` | line 138 | Remote check install command |
| `.agro/skills/remote-sandbox/checks/docker-egress.sh` | line 113 | Remote check install command |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install|uninstall|status <name>` | Changed | `claude` is canonical. `claude-code` resolves to `claude` and prints a deprecation line on stderr. |
| `agro harness list [--json]` | Changed | The `id` field reads `claude`. |
| `~/.agro/config.json` | Migrated | `hostHarnesses["claude-code"]` moves to `hostHarnesses["claude"]` on read and persists on the next write. |
| Sandbox marker | Migrated | `claude-code.installed` counts as the `claude` marker until the next install or uninstall replaces it. |
| Banner, docs, README | Changed | Each command names `claude`. |

## Storage

Two stored records change keys:

1. Host: `~/.agro/config.json` key `hostHarnesses`. `readHostConfig` moves a `claude-code` receipt to `claude`. `writeHostConfig` persists the moved key on the next write. Follow the `~/.oh/oh.json` precedent at `CHANGELOG.md:385`: read the old record, then retire the old record on the next write.
2. Sandbox: marker files under `/home/sandbox/.local/share/agro/harnesses/`. A successful install writes `claude.installed` and deletes `claude-code.installed`. An uninstall deletes both files.

## Architectural Decisions

- `catalog.ts` owns the alias map. `findHarness` is the only resolver. Other code reads `entry.id`, so the canonical id flows to each consumer.
- The alias is hidden. `harnessIds()`, `harness list`, `--json`, and the unknown-harness message list canonical ids only.
- `harness.ts` prints the deprecation line, because the `harness` command owns operator output. `findHarness` stays free of I/O.
- The alias stays until 0.29.0. That release removes the alias map entry, the receipt migration, and the marker fallback in one change.
- The doc file `docs/harnesses/claude-code.md` keeps its name. The page describes the product Claude Code, and a rename breaks five inbound links for no gain.
- The other harness ids (`grok-build`, `muse-code`, `antigravity-cli`) stay unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `claude` is canonical; `claude-code` resolves to `claude`; `harnessIds()` excludes `claude-code` | US-001 catalog and alias |
| `.agro/cli/src/__tests__/harness.test.ts` | deprecation line for install, uninstall, status; no line for `claude`; list and `--json` ids | US-001 output |
| `.agro/cli/src/__tests__/harness.test.ts` | legacy marker counts as installed; install replaces legacy marker; uninstall deletes both markers; host uninstall finds a legacy receipt | US-002 migration |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | legacy key moves to `claude`; both keys keep `claude` | US-002 receipt migration |
| `.agro/cli/src/lib/tracing/__tests__/harness-writers.test.ts` | references use `claude` | US-001 id consumers |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts`, `verify-sandbox-image.test.ts`, `sandbox-upgrade-smoke.test.ts` | fixtures use `claude` | US-003 scripts |

Run `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness`. CI runs the same three commands in `.github/workflows/ci-harness.yml`.

## Design Principles

- Keep one source of truth: the catalog owns the id and the alias.
- Delete obsolete paths on a schedule: name the removal release in the changelog entry.
- Migrate stored state once, and never orphan an existing install.
- Add no explanatory comments to tracked code.

## Out of Scope

- The npm package `@anthropic-ai/claude-code`.
- The Langfuse trace tags in `.agro/skills/behavioral-training/scripts/lib/inventory.mjs` and `normalize.mjs`. Recorded traces carry the tag `claude-code`.
- The `cc-safety-net --claude-code` flag in `.claude/settings.json` and `.codex/hooks.json`.
- The `.claude/` provider directory and `link-providers.sh`.
- Released `CHANGELOG.md` entries, `.agro/tasks/` history, and content under `projects/`.
- A rename of the other harness ids.
- Acceptance of `--help` after the verb in `parseInstallerArgs` (`.agro/cli/src/cli.ts:983`). This change does not expose that defect.

## Open Questions

None. The operator selected 0.29.0 as the alias removal release and selected a new quickstart screenshot.

## Acceptance Criteria

- [ ] `agro harness install claude` installs Claude Code, and `agro harness list` shows `claude`.
- [ ] `agro harness install claude-code` prints the deprecation line and installs Claude Code.
- [ ] An existing host receipt or sandbox marker under `claude-code` keeps `status`, `install`, and `uninstall` correct.
- [ ] `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness` exit 0.
- [ ] `docs/img/quickstart-harness-install.png` shows `agro harness install claude`.
- [ ] `.agro/tasks/rename-claude-harness-id/evidence/manual-review.md` exists.

## Lessons

1. Claim: `agro destroy <name>` that runs inside a sandbox stops the current sandbox container. The command does not refuse. Evidence: the US-004 worker ran `agro destroy agro-sbx-1525-capture --yes` inside `agro-sbx-local`. The output was `Container agro-sbx-local Stopping`, and the exit status was 144. The container restarted, and the workspace volume stayed intact. `agro sandbox install` refuses inside a sandbox through `runningInsideSandbox`. Outcome: proposed issue, which waits for operator approval.
2. Claim: the advisor briefed the US-004 worker as if the session ran on the host, but the session runs inside `agro-sbx-local`. Evidence: `/.dockerenv` exists, and `agro sandbox list` shows no registered sandbox. Outcome: dropped, because the finding is a process observation. Lesson 1 owns the defect that the mistake exposed.
3. Claim: the console refuses a free node in an organization context. Evidence: `agro node create --free-tier` exited 1 with `HTTP 403 FREE_TIER_INELIGIBLE`. Outcome: dropped, because the refusal is account policy. The operator approved one paid `n4` node. The node lived about 5 minutes 29 seconds.
4. Claim: the plan step did not set `pr` in `prd.json` when the draft PR opened. Evidence: `next.sh` printed `blocked prd.json has no pr` after US-005. Outcome: dropped, because the finding is tooling friction that `next.sh` already catches.
5. Claim: the `remote-sandbox.test.ts` SIGTERM case timed out one time at 30 seconds while two workers ran tests in parallel. Evidence: an isolated rerun and a full rerun passed. Outcome: dropped, because the finding is a test flake under load.
6. Claim: `lib/host-config.ts` now imports `DEPRECATED_HARNESS_ALIASES` from `lib/harnesses/catalog.ts`. Evidence: the review found no import cycle. Outcome: dropped, because the finding is a layering judgment, and the alias map leaves at 0.29.0.
