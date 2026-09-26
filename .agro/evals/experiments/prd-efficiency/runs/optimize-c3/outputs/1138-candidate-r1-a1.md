# PRD: Sandbox npm global prefix matches the harness prefix

Status: DRAFT

## User Stories

### US-001: Point npm's global prefix at the home-volume prefix

**Description:** As a sandbox agent, I want harness self-updates to succeed without sudo so that updates persist.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` after the last build-time root `npm install -g` step.
- [ ] Each build-time root `npm install -g` step in `.devcontainer/Dockerfile` still installs into /usr/local, because the home volume hides image-layer files under /home/sandbox/.local.
- [ ] `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX` with the value of `NPM_USER_PREFIX`, and keeps any value that the environment already sets.
- [ ] A new test case in `.agro/cli/src/__tests__/harness-catalog.test.ts` fails before the change and passes after the change.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `npm config get prefix` and the output is /home/sandbox/.local.
- [ ] In a rebuilt sandbox, the `sandbox` user runs `claude update` and `codex update`, and each command exits with code 0 without sudo.
- [ ] After `agro destroy <name>` and a new start with the same home volume, the updated harness versions remain.

## Summary

The issue reports that `claude update` and `codex update` fail with `EACCES` on /usr/local/lib/node_modules. The harness door installs each harness with an explicit prefix into `NPM_USER_PREFIX`, which is /home/sandbox/.local at `.devcontainer/Dockerfile:43`. npm's own global prefix stays /usr/local. A harness self-update calls a bare `npm install -g` and hits /usr/local.

The fix sets `NPM_CONFIG_PREFIX` to the same value. npm reads this variable as its global prefix. The Dockerfile sets the variable after the root build-time installs, such as `cc-safety-net` at `.devcontainer/Dockerfile:48`. `.agro/install/path-env.sh` exports the variable for login shells. `.devcontainer/agro-env-generator.sh` copies PID 1's environment to systemd units, so the image variable reaches cron and bootstrap units.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `ENV NPM_USER_PREFIX`, build-time `npm install -g` steps | Declares the new `NPM_CONFIG_PREFIX` after root installs |
| `.agro/install/path-env.sh` | `NPM_USER_PREFIX` export | Exports `NPM_CONFIG_PREFIX` for login shells |
| `.devcontainer/entrypoint.sh` | profile rewrite at lines 45-54 | Rewrites stale profile exports in the home mount; must also cover the new export |
| `.devcontainer/agro-env-generator.sh` | read of the PID 1 environment | Carries the image variable to systemd units; needs no change |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `DOCKERFILE`, `NPM_USER_PREFIX` | Holds the static regression test |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox environment | New variable | `NPM_CONFIG_PREFIX` equals `NPM_USER_PREFIX` for the `sandbox` user |
| `npm install -g` in the sandbox | Behavior change | Global installs land in /home/sandbox/.local instead of /usr/local |

## Storage

The home volume at /home/sandbox holds the npm global prefix. No new storage exists.

## Architectural Decisions

- `NPM_USER_PREFIX` stays the single source of truth. `NPM_CONFIG_PREFIX` derives from `NPM_USER_PREFIX` in the Dockerfile and in `.agro/install/path-env.sh`.
- The variable comes after the root build-time installs, so image-layer tools stay in /usr/local.
- The plan uses an environment variable, not a user npmrc file. The secret-path hooks deny access to npmrc files.
- The harness door keeps its explicit `npm --prefix` argument.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Dockerfile declares `ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"` after the last `npm install -g` line | The image sets npm's global prefix after root installs |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | `.agro/install/path-env.sh` exports `NPM_CONFIG_PREFIX` from `NPM_USER_PREFIX` | Login shells get the same prefix |
| `.agro/evals/probes/harness-one-door.sh` | Existing probe run | The install prefix contract stays green |
| Manual sandbox check | `npm config get prefix`, `claude update`, `codex update` | The issue reproduction passes without sudo |

Run the CLI tests with `<cli test command>`. Run the probe with `bash .agro/evals/probes/harness-one-door.sh`.

## Design Principles

- Keep one source of truth for the prefix.
- Make the smallest change that makes a bare `npm install -g` land in the home volume.
- Add no tracked-code comments.

## Out of Scope

- Support for `sudo claude update`. The sudo secure path excludes the home prefix, and a root install does not persist.
- Changes to the harness catalog install arguments.
- Migration of tools that the image installs into /usr/local.

## Open Questions

1. Which command runs the CLI vitest suite: `<cli test command>`?
2. Does a harness binary in /usr/local/bin from an earlier image shadow the updated binary? `PATH` puts NPM_USER_PREFIX/bin first, so the plan assumes no shadowing.
3. Does public documentation in mifunedev/agro-web need a note on harness self-update? The plan assumes no change.

## Acceptance Criteria

- [ ] Each US-001 acceptance criterion passes.
- [ ] `<cli test command>` exits with code 0.
- [ ] `bash .agro/evals/probes/harness-one-door.sh` prints PASS.

## Lessons

Filled by the advisor before undraft.
