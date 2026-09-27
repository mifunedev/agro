# PRD: Set the npm global prefix to the sandbox home volume

Status: DRAFT

## User Stories

### US-001: Point the npm global prefix at NPM_USER_PREFIX

**Description:** As an operator, I want `npm install -g` in the sandbox to write to `/home/sandbox/.local` so that `claude update` and `codex update` succeed without sudo and persist across a container recreate.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` after the `RUN` step that links `/opt/agro/dist/agro.js` to `/usr/local/bin/agro`.
- [ ] No `ENV NPM_CONFIG_PREFIX` line appears before the `npm install -g cc-safety-net@1.0.6` step or before the `/opt/agro` build step.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$NPM_USER_PREFIX}"` after the `NPM_USER_PREFIX` export.
- [ ] A test in `.agro/cli/src/__tests__/harness-catalog.test.ts` fails before the change and passes after the change. The test asserts that the Dockerfile sets `NPM_CONFIG_PREFIX` to `$NPM_USER_PREFIX`.
- [ ] `.agro/evals/probes/harness-one-door.sh` reports `REGRESSION` when the Dockerfile lacks `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"`, and reports `PASS` when the Dockerfile has the line.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `npm config get prefix`. The command prints `/home/sandbox/.local`.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `claude update` and `codex update`. Neither command prints `EACCES` or `Insufficient permissions`.

## Summary

Issue 1138 reports the defect. `agro harness install` installs each harness with an explicit `npm --prefix` into `NPM_USER_PREFIX` (`/home/sandbox/.local`). npm's own global prefix stays `/usr/local`. The `sandbox` user cannot write `/usr/local`. A harness self-update runs a bare `npm install -g`, and that command exits with `EACCES`.

The Dockerfile declares `ENV NPM_USER_PREFIX="/home/sandbox/.local"` at line 43. The Dockerfile runs two root npm installs into `/usr/local` at lines 50 and 57. The Compose file mounts the `workspace` volume at `/home/sandbox`.

The selected approach sets npm's documented environment key `NPM_CONFIG_PREFIX` to `$NPM_USER_PREFIX`. The image `ENV` places the key in every container process. The export in `path-env.sh` covers login shells that reset the environment. The `ENV` line goes after the two root npm installs, so those installs still land in `/usr/local`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX` (line 43), `npm install -g cc-safety-net` (line 50), `/opt/agro` build (line 57), `ENV UV_*` block (lines 69-73) | Image environment. The new `ENV NPM_CONFIG_PREFIX` line goes next to the `ENV UV_*` block. |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX`, `PATH` exports | Login-shell environment appended to `.profile` and `.zprofile`. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `declares NPM_USER_PREFIX as the prefix the catalog installs into` (line 202) | Existing Dockerfile assertion. The new assertion goes beside this case. |
| `.agro/evals/probes/harness-one-door.sh` | `PREFIX` extraction (line 29) | Existing probe that ties the install prefix to the Dockerfile. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment | Add | `NPM_CONFIG_PREFIX=/home/sandbox/.local` for every process in the container. |
| `npm install -g` as `sandbox` | Behavior change | The command writes to `/home/sandbox/.local` instead of `/usr/local`. |

## Storage

The npm global prefix moves to `/home/sandbox/.local`. The `workspace` volume holds this path, so a self-updated harness survives a container recreate. No schema changes.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of the prefix value. `NPM_CONFIG_PREFIX` references `$NPM_USER_PREFIX` and does not repeat the literal path.
- The fix uses an environment key, not a `.npmrc` file. The hooks `deny-secret-paths.sh` and `deny-env-dump.sh` block `.npmrc` paths. An existing home volume also keeps its old dotfiles, and an image `ENV` reaches that volume without a file change.
- Root image installs keep `/usr/local`. Only runtime installs move.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile sets `NPM_CONFIG_PREFIX` to `$NPM_USER_PREFIX` after the `/opt/agro` build | US-001 image environment and order |
| `.agro/evals/probes/harness-one-door.sh` | Missing `ENV NPM_CONFIG_PREFIX` gives `REGRESSION` | US-001 regression guard |
| Manual sandbox check | `npm config get prefix`; `claude update`; `codex update` | US-001 runtime behavior |

## Design Principles

- Keep one source of truth for the prefix value.
- Make the smallest change that fixes the self-update path.
- Add no comments to tracked code.

## Out of Scope

- Changes to `sudo` `secure_path`.
- Changes to the harness catalog install argv.
- Migration of packages that already exist in `/usr/local`.

## Open Questions

1. Do systemd units such as `agro-cron.service` inherit the image `ENV`? If a unit does not, a cron-fired harness update still writes to `/usr/local`. The build owner confirms this in a rebuilt sandbox.
2. What `<test command>` runs the CLI test suite in CI? The build owner reads `.agro/cli/package.json` to confirm.

## Acceptance Criteria

- [ ] Every US-001 acceptance criterion passes.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` exits 0 on the changed tree.
- [ ] The CLI test suite passes with `<test command>`.

## Lessons

Filled by the advisor before undraft.
