# PRD: Sandbox npm global prefix matches the harness install prefix

Status: DRAFT

## User Stories

### US-001: Point npm's global prefix at the home volume

**Description:** As an application agent, I want npm's global prefix to equal `NPM_USER_PREFIX` so that `claude update` and `codex update` persist without sudo.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` in the `base` stage.
- [ ] Each `npm install -g` line in `.devcontainer/Dockerfile` comes ahead of the `ENV NPM_CONFIG_PREFIX` line, so that the root build step for `cc-safety-net@1.0.6` still installs into `/usr/local`.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the `NPM_USER_PREFIX` export.
- [ ] `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` appends the `NPM_CONFIG_PREFIX` export to `/home/sandbox/.profile` and to `/home/sandbox/.zprofile` when the file exists and holds no `NPM_CONFIG_PREFIX` line. A second boot appends nothing.
- [ ] Red test first: new cases in `.agro/cli/src/__tests__/harness-catalog.test.ts` and `.agro/scripts/__tests__/entrypoint.test.ts` fail before the change and pass after the change.
- [ ] `npx vitest run .agro/cli/src/__tests__/harness-catalog.test.ts .agro/scripts/__tests__/entrypoint.test.ts .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] In a rebuilt sandbox, `npm prefix -g` run as the `sandbox` user prints `/home/sandbox/.local`. The implementer records the output in `progress.txt`.

### US-002: Pin the contract in the probe, docs, and changelog

**Description:** As the operator, I want a probe and docs to pin the npm prefix so that a Dockerfile edit cannot break harness self-update.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/harness-one-door.sh` reports a failure when the Dockerfile declares no `NPM_CONFIG_PREFIX` or when the value does not resolve to the `NPM_USER_PREFIX` value.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` exits 0 on the changed tree.
- [ ] `docs/harnesses/claude-code.md` and `docs/harnesses/codex.md` state that `claude update` and `codex update` run as the `sandbox` user without sudo.
- [ ] `CHANGELOG.md` holds a `### Fixed` entry under `## [Unreleased]` that cites issue `<issue number>`.

## Summary

Verified current state:

- `.devcontainer/Dockerfile` line 43 sets `ENV NPM_USER_PREFIX="/home/sandbox/.local"`. No line sets `NPM_CONFIG_PREFIX`. npm therefore keeps the `node:22-trixie-slim` global prefix `/usr/local`.
- `.devcontainer/Dockerfile` line 49 runs `npm install -g cc-safety-net@1.0.6` as root. That install must stay in `/usr/local`, because the home volume hides `/home/sandbox/.local` at run time.
- The `final` stage starts `FROM base`. An `ENV` line in `base` reaches the final image.
- `.agro/cli/src/lib/harnesses/catalog.ts` sets `SANDBOX_HARNESS_PREFIX = "/home/sandbox/.local"` and installs each npm harness with an explicit `npm --prefix`. A harness self-update calls a bare `npm install -g` and uses the npm global prefix instead.
- `.agro/install/path-env.sh` is appended to `/home/sandbox/.profile` and `/home/sandbox/.zprofile` at image build. Both files live in the home volume. An existing volume keeps the old snippet. `reconcile_shell_env_exports` in `.devcontainer/entrypoint.sh` already rewrites those two files on each boot.

Selected approach: npm reads the `NPM_CONFIG_PREFIX` environment variable as its `prefix` setting. Set that variable to the `NPM_USER_PREFIX` value in three places:

1. The image environment, for `docker exec` shells, Herdr, and tmux sessions.
2. `.agro/install/path-env.sh`, for login shells on a fresh home volume, such as SSH sessions.
3. `reconcile_shell_env_exports`, for login shells on an existing home volume.

The issue text gives the reproduction. The red tests in US-001 encode the reproduction statically.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, `RUN npm install -g cc-safety-net@1.0.6`, `FROM base AS final` | Declares the new `ENV NPM_CONFIG_PREFIX` after the last root global install. |
| `.agro/install/path-env.sh` | `export NPM_USER_PREFIX` | Exports `NPM_CONFIG_PREFIX` for login shells. |
| `.devcontainer/entrypoint.sh` | `reconcile_shell_env_exports` | Appends the export to an existing home-volume profile. |
| `.agro/cli/src/lib/harnesses/catalog.ts` | `SANDBOX_HARNESS_PREFIX` | Reference value. No change. |
| `.agro/evals/probes/harness-one-door.sh` | `PREFIX` extraction from the Dockerfile | Adds the `NPM_CONFIG_PREFIX` check. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment | New variable | `NPM_CONFIG_PREFIX` equals `/home/sandbox/.local` for the `sandbox` user. |
| Harness self-update (`claude update`, `codex update`) | Behavior fix | Installs into the home volume without sudo. |
| `agro harness install` | None | The explicit `npm --prefix` argv stays unchanged. |
| Public docs in `mifunedev/agro-web` | Open question | See Open Questions. |

## Storage

The harness binaries persist in the existing home volume under `/home/sandbox/.local`. The change adds no new storage. The entrypoint edits `/home/sandbox/.profile` and `/home/sandbox/.zprofile` in place and follows the existing `reconcile_shell_env_exports` pattern.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of truth. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` in each place and never repeats the literal path.
- Use the environment variable, not an `npmrc` file. The deny hooks `.agro/hooks/deny-secret-paths.sh` and `.agro/hooks/deny-env-dump.sh` block `.npmrc` access, and a user `npmrc` file can hold registry tokens.
- Root keeps `/usr/local` at build time. `sudo` resets the environment, so a root `npm install -g` at run time also keeps `/usr/local`.
- The change runs on the host only as an image rebuild. The operator rebuilds the sandbox with the `agro` lifecycle door. The application agent performs the edits and runs the tests inside the sandbox.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`; each `npm install -g` line precedes that line | Image environment and build-order contract. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX` after `NPM_USER_PREFIX` | Login-shell contract on a fresh volume. |
| `.agro/scripts/__tests__/entrypoint.test.ts` | `reconcile_shell_env_exports` appends the export once and stays idempotent on a second run | Existing-volume migration. |
| `.agro/evals/probes/harness-one-door.sh` | Missing or mismatched `NPM_CONFIG_PREFIX` reports a failure | Regression floor. |

Run the suite with `npx vitest run` from the repository root. `vitest.config.ts` includes both test directories.

## Design Principles

- Keep one source of truth for the prefix: `NPM_USER_PREFIX`.
- Choose the smallest change: one environment variable, no new script, no new CLI verb.
- Add no comments to tracked code.
- Keep the persistence guarantee: each harness write lands in the home volume.

## Out of Scope

- Changes to `agro harness install` argv or the harness catalog.
- A sudo path for harness updates.
- Changes to pnpm, uv, or `PNPM_HOME`.
- Harnesses that install through a vendor shell script, such as `grok-build` and `muse-code`.

## Open Questions

1. The input file carries no issue number. Which number does the `CHANGELOG.md` entry cite? The plan uses `<issue number>`.
2. Does `mifunedev/agro-web` document harness self-update? If `mifunedev/agro-web` documents harness self-update, the operator decides whether a matching docs change joins this task.
3. Do systemd units in the sandbox run npm as the `sandbox` user? A systemd unit does not inherit the Docker image `ENV`. The plan assumes that no unit runs a bare `npm install -g`.

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes.
- [ ] `npx vitest run` exits 0 from the repository root.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` exits 0.
- [ ] `git grep -n 'NPM_CONFIG_PREFIX' -- .devcontainer .agro/install` lists the Dockerfile, `path-env.sh`, and `entrypoint.sh` lines, and no line holds the literal `/usr/local`.

## Lessons

Filled by the advisor before undraft.
