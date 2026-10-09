# PRD: OpenClaw harness support

Status: DRAFT

## User Stories

### US-001: Install OpenClaw through the harness door

**Description:** As an operator, I want `agro harness install openclaw` to install OpenClaw into the persistent home so that OpenClaw survives a container recreate like every other harness.

**Acceptance Criteria:**

- [ ] `HARNESS_CATALOG` in `.agro/cli/src/lib/harnesses/catalog.ts` holds one entry with `id: "openclaw"`, `binary: "openclaw"`, `kind: "installable"`, and `docsPath: "docs/harnesses/openclaw.md"`.
- [ ] The install argv is `npm --prefix {{prefix}} install -g --allow-scripts=openclaw openclaw@2026.9.9`. The exact pin follows the `grok-build` and `fx` entries.
- [ ] The uninstall argv is `npm --prefix {{prefix}} uninstall -g openclaw`.
- [ ] The evidence records the output of `npm --version` in the Node 24 sandbox.
- [ ] If that npm version is 11.16 or later, the install argv keeps `--allow-scripts=openclaw`. If not, the install argv omits the flag.
- [ ] `.agro/scripts/verify-sandbox-image.sh` fails when the image npm version is lower than the version that the install argv assumes.
- [ ] The test "covers claude-code, codex, opencode and pi" in `harness-catalog.test.ts` lists `openclaw` as an npm harness.
- [ ] The `SHIPPED_SANDBOX_INSTALL_ARGV` table in `.agro/cli/src/__tests__/harness-catalog.test.ts` holds the expanded `openclaw` row.
- [ ] The story starts only after `.agro/tasks/node-24-runtime/` merges. `.devcontainer/Dockerfile` line 1 then reads `FROM node:24-trixie-slim AS base`.
- [ ] A new catalog test fails before the entry exists and passes after the entry exists.

### US-002: Bind OpenClaw state and workspace to the AGRO checkout

**Description:** As an operator, I want OpenClaw to use `<target-root>/.openclaw` as its state directory and the checkout as its agent workspace. OpenClaw then reads the root `AGENTS.md` and the canonical skills.

**Acceptance Criteria:**

- [ ] Installation sets `agents.defaults.workspace` to `<target-root>` through `OPENCLAW_STATE_DIR="<target-root>/.openclaw" openclaw config set` before it reports success. The implementation uses the single-key form or the batch form that upstream supports.
- [ ] `git grep -n 'openclaw.json' -- .agro/scripts .agro/cli/src` returns no direct edit of the file.
- [ ] `.agro/scripts/openclaw-workspace.sh` holds the OpenClaw state-directory check. The task does not change `.agro/scripts/hermes-workspace.sh`.
- [ ] Docker targets use `/home/sandbox/harness` as `<target-root>`. Local and host targets use the resolved absolute path.
- [ ] A repeated install repairs a missing or stale workspace value and does not download the executable again.
- [ ] If the inherited `OPENCLAW_STATE_DIR` differs from `<target-root>/.openclaw`, installation exits nonzero before it changes any file. The diagnostic names both paths.
- [ ] Installation prints the launch command `OPENCLAW_STATE_DIR=<target-root>/.openclaw openclaw`.
- [ ] `.gitignore` ignores `/.openclaw/`.
- [ ] After `openclaw onboard` runs with the workspace home selected, `git status --porcelain` at `<target-root>` lists no new file outside `.openclaw/`.
- [ ] `openclaw skills list` with the workspace home selected lists the `prd` skill from `.agents/skills`.
- [ ] A configuration failure returns a nonzero exit status. The command prints no installation-success message.
- [ ] Tests in `.agro/cli/src/__tests__/harness.test.ts` cover default, recorded, and explicit roots, repair, configuration failure, and a conflicting inherited state directory.

### US-003: Run the OpenClaw gateway in a named tmux session

**Description:** As an operator, I want `agro gateway openclaw` to run the OpenClaw gateway in a named tmux session. The gateway then survives a terminal disconnect without a systemd user unit.

**Acceptance Criteria:**

- [ ] `agro gateway openclaw` starts `openclaw gateway run` in the tmux session `client-openclaw` with `OPENCLAW_STATE_DIR=<target-root>/.openclaw` exported.
- [ ] `agro gateway openclaw --restart` and `agro gateway openclaw --stop` act on `client-openclaw` only.
- [ ] `agro gateway status` lists `client-openclaw` with its state.
- [ ] No AGRO code path runs `openclaw gateway install` or `openclaw onboard --install-daemon`.
- [ ] If the `openclaw` executable is absent, `agro gateway openclaw` exits nonzero before tmux starts a session.
- [ ] The gateway binds to loopback. AGRO publishes no new Compose port.
- [ ] The usage text in `.agro/scripts/gateway.sh` and in `.agro/cli/src/cli.ts` names `openclaw`.
- [ ] Tests in `.agro/scripts/__tests__/gateway.test.ts` cover start, restart, stop, status, and the missing-executable path.

### US-004: Document OpenClaw

**Description:** As an operator, I want a harness page for OpenClaw so that I can install, authenticate, and run OpenClaw without reading the AGRO source.

**Acceptance Criteria:**

- [ ] `docs/harnesses/openclaw.md` exists and documents install, the state directory, the workspace binding, authentication, the gateway session, state persistence, and `agro destroy` behavior.
- [ ] The page states that AGRO does not seed `SOUL.md`, `IDENTITY.md`, or `USER.md` in the checkout.
- [ ] The page states that the operator keeps provider keys in `<target-root>/.openclaw/.env`.
- [ ] `docs/harnesses/overview.md` lists OpenClaw in the install sentence and in the "Supported agents" table.
- [ ] `docs/README.md` links `harnesses/openclaw.md`.
- [ ] `CHANGELOG.md` holds an `Added` entry under `## [Unreleased]` that links the task issue.
- [ ] `.agro/cli/src/__tests__/docs-reference.test.ts` and `.agro/cli/src/__tests__/docs.test.ts` exit 0.

### US-005: Record manual review evidence

**Description:** As a maintainer, I want a command transcript so that a reviewer can verify install, workspace binding, and gateway behavior. The reviewer then needs no trust in installer output.

**Acceptance Criteria:**

- [ ] The story depends on US-001, US-002, US-003, and US-004.
- [ ] `.agro/tasks/openclaw-harness-support/evidence/manual-review.md` records each command, its output, and its exit status.
- [ ] The transcript shows `agro harness install openclaw`, `openclaw --version`, `openclaw config get agents.defaults.workspace`, and `git status --porcelain` in the sandbox.
- [ ] The transcript shows `agro gateway openclaw`, `agro gateway status`, and `agro gateway openclaw --stop`.
- [ ] The transcript shows one failure path: a conflicting `OPENCLAW_STATE_DIR` refusal.
- [ ] The run uses no provider credential and connects no messaging channel unless the operator approves the resource.
- [ ] The transcript ends with `agro harness uninstall openclaw` and the removal of each created resource.

## Summary

OpenClaw is a gateway-first personal agent runtime. Its gateway serves channels, a Control UI, and agent sessions on port 18789.
AGRO has no OpenClaw support today. A `git grep -n -i openclaw` returns only the council record at `.agro/tasks/council-openclaw-workspace/`.

Verified constraints:

- OpenClaw requires Node 24.16 or later (`https://docs.openclaw.ai/install`).
- The sandbox image uses `FROM node:22-trixie-slim` today. The prerequisite task `.agro/tasks/node-24-runtime/` moves the image to Node 24.
- OpenClaw installs through `npm install -g openclaw@latest --allow-scripts=openclaw` on npm 11.16 or later.
- OpenClaw keeps config, credentials, and sessions in `OPENCLAW_STATE_DIR`. The default is `~/.openclaw`.
- OpenClaw resolves the agent workspace from `agents.defaults.workspace`, then `OPENCLAW_WORKSPACE_DIR`, then `<state-dir>/workspace`.
- OpenClaw loads skills from `<workspace>/skills` and `<workspace>/.agents/skills`.
- AGRO already links `.agents/skills -> ../.agro/skills` (`.agro/scripts/link-providers.sh:30`).
- The OpenClaw installer offers a systemd user service through `--install-daemon`. AGRO keeps headless services in named tmux sessions.

Selected approach: treat OpenClaw as one more catalog harness and follow the Hermes precedent.

1. After the Node 24 task merges, install through npm into `~/.local`, like Claude Code, Codex, Pi, and OpenCode.
2. Bind state to `<target-root>/.openclaw`, like `<target-root>/.hermes`.
3. Set the agent workspace to the checkout root. OpenClaw then reads the root `AGENTS.md` and `.agents/skills` through surfaces that already exist.
4. Run the gateway through `agro gateway openclaw` in a named tmux session.

Rejected alternatives:

- Install through `install-cli.sh` with a private Node 24. The operator chose a Node 24 image instead.
- Run the upstream OpenClaw Docker image as a Compose service. This choice puts agent work outside the sandbox and breaks non-negotiable 1.
- Adopt the OpenClaw workspace file map in the checkout. The council record rejected option O1, and `CHANGELOG.md` records the retirement of a root `context/` tier in #868.
- Use `--install-daemon`. systemd in the sandbox supervises only the bootstrap oneshot and the cron runtime.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | `HARNESS_CATALOG`, `HarnessEntry` | Adds the `openclaw` entry with install, verify, and uninstall argv. |
| `.agro/cli/src/commands/harness.ts` | `hermesTargetRoot`, `hermesEnv`, `configureHermes`, `hermesLaunch` | Hermes precedent for target root, runtime env, post-install config, and launch guidance. OpenClaw receives equivalent steps. |
| `.agro/scripts/hermes-workspace.sh` | `hermes_workspace_check`, `hermes_workspace_configure` | Precedent for the conflicting-home refusal and the `config set` call. Stays unchanged. |
| `.agro/scripts/openclaw-workspace.sh` | new check and configure functions | Holds the OpenClaw state-directory check and the workspace `config set` call. |
| `.agro/scripts/gateway.sh` | `show_status`, `start_hermes`, backend `case` | Adds the `openclaw` backend and its status row. |
| `.agro/cli/src/cli.ts` | gateway usage text at lines 150 and 367-369 | Names `openclaw` in the help text. |
| `.agro/scripts/link-providers.sh` | `.agents/skills` link | Supplies skills to OpenClaw with no change. |
| `.gitignore` | `/.hermes/*` block at line 69 | Adds `/.openclaw/`. |
| `.agro/tasks/node-24-runtime/prd.md` | prerequisite task | Moves the image to Node 24 before this task starts. |
| `docs/harnesses/hermes.md` | page structure | Template for `docs/harnesses/openclaw.md`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install openclaw` | New catalog id | Installs OpenClaw, sets the workspace, and prints the launch command. |
| `agro harness uninstall openclaw` | New catalog id | Removes the launcher and the prefix directory. |
| `agro harness list` and `agro harness status openclaw` | New row | Report OpenClaw presence. |
| `agro gateway openclaw [--attach\|--restart\|--stop]` | New backend | Runs `openclaw gateway run` in tmux session `client-openclaw`. |
| `agro gateway status` | New row | Reports `client-openclaw`. |
| `docs/harnesses/openclaw.md` | New page | Operator guide. |

## Storage

- Executable: `~/.local/lib/node_modules/openclaw` and `~/.local/bin/openclaw` in the persistent home volume. The pattern follows the other npm harnesses.
- Runtime state: `<target-root>/.openclaw/`. The directory holds `openclaw.json`, `.env`, credentials, and sessions. Git ignores the directory.
- In an image-only sandbox, `<target-root>/.openclaw/` resides in the home volume. With a checkout bind, the directory resides in the host checkout.
- `agro destroy` removes the home volume. The command does not remove a host checkout's `.openclaw/` directory.

## Architectural Decisions

- Source of truth for install behavior: the catalog entry in `catalog.ts`. No second install path exists.
- Source of truth for state location: `OPENCLAW_STATE_DIR=<target-root>/.openclaw`. AGRO sets the variable for install, configuration, launch guidance, and the gateway.
- Source of truth for the workspace: `agents.defaults.workspace` in `<target-root>/.openclaw/openclaw.json`. AGRO writes the value only through `openclaw config set`. AGRO does not edit the JSON file directly.
- Source of truth for skills: `.agro/skills`, reached through the existing `.agents/skills` link. AGRO adds no `skills/` directory at the root.
- Process supervision: named tmux session `client-openclaw`. The gateway binds to loopback. Public sharing of the Control UI uses the `/cloudflared` skill and stays out of this task.
- Identity scoping: one OpenClaw state directory per checkout. A worktree that needs a separate identity selects its own `<worktree>/.openclaw`.
- AGRO copies no credential, merges no home, and deletes no `~/.openclaw` directory.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `openclaw` row in `SHIPPED_SANDBOX_INSTALL_ARGV`; npm harness list; uninstall argv | US-001 install contract |
| `.agro/cli/src/__tests__/harness.test.ts` | install sets workspace; repair; config failure; conflicting `OPENCLAW_STATE_DIR`; launch text | US-002 binding |
| `.agro/scripts/__tests__/gateway.test.ts` | start, restart, stop, status, missing executable | US-003 gateway |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | new page paths resolve | US-004 docs |
| `.agro/cli/src/__tests__/docs.test.ts` | catalog and docs agree | US-004 docs |
| `.agro/tasks/openclaw-harness-support/evidence/manual-review.md` | live transcript | US-005 evidence |

CI runs `pnpm test:scripts` in `.github/workflows/ci-harness.yml`. Run `pnpm test` (root `vitest run`) for the CLI suites, and run `pnpm --dir .agro/cli typecheck`.

## Design Principles

- Non-negotiable 1: OpenClaw runs inside the sandbox. No upstream OpenClaw container joins the Compose project.
- Non-negotiable 2: OpenClaw reads the same `AGENTS.md` and `.agro/skills` as every other harness. AGRO adds no OpenClaw-specific mirror.
- Non-negotiable 3: the gateway runs in a named tmux session. AGRO installs no systemd user unit.
- Non-negotiable 4: each checkout owns one state directory. Two worktrees do not share `.openclaw/`.
- Non-negotiable 5: the change adds no explanatory comment to tracked code.
- Smallest model: reuse the catalog, the target-root resolution, and the gateway script. Extract a shared Hermes and OpenClaw helper only if the two implementations hold identical code.
- Depend on the shared Node 24 image. Do not add a private runtime for one harness.

## Out of Scope

- Messaging channel setup (Slack, Discord, Telegram, and others). The operator runs `openclaw configure` for channels.
- Langfuse tracing for OpenClaw. `tracingWriter` stays unset.
- Public exposure of the Control UI on port 18789.
- A Compose service or a published port. `.agro/tasks/node-24-runtime/` owns the Dockerfile change.
- Adoption of `SOUL.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, or `BOOTSTRAP.md` in the checkout.
- Migration from an existing `~/.openclaw` or from Hermes.
- OpenClaw multi-agent rosters and OpenClaw tool sandboxing.

## Open Questions

None. The operator resolved each question on 2026-10-08:

- O1A: the catalog pins `openclaw@2026.9.9`.
- O2A: the implementation reads the image npm version and selects the install argv. The image check guards that version.
- O3A: US-002 requires no new file outside `.openclaw/`. The implementation owner finds the upstream setting that meets the criterion.
- O4A: AGRO writes the workspace only through `openclaw config set`.
- O5A: the gateway session is `client-openclaw`.
- O6A: a separate `openclaw-workspace.sh` holds the OpenClaw check. A shared helper waits until the two scripts hold identical code.
- N3A: this task gets its own GitHub issue. The advisor opens the issue before `prd.json` conversion.

## Acceptance Criteria

- [ ] `agro harness install openclaw` exits 0 in a fresh sandbox, and `openclaw --version` exits 0.
- [ ] The task diff does not change `.devcontainer/Dockerfile`.
- [ ] `openclaw config get agents.defaults.workspace` with the workspace home selected prints `/home/sandbox/harness` in the Docker sandbox.
- [ ] `git status --porcelain` lists no file outside `.openclaw/` after install and onboarding.
- [ ] `agro gateway openclaw` starts tmux session `client-openclaw`, and `agro gateway status` reports the session.
- [ ] `git grep -n -E 'install-daemon|gateway install' -- .agro` returns no OpenClaw code path.
- [ ] `pnpm test:scripts`, `pnpm test`, and `pnpm --dir .agro/cli typecheck` exit 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `.agro/tasks/openclaw-harness-support/evidence/manual-review.md` exists and holds the US-005 transcript.

## Lessons

Filled by the advisor before undraft.
