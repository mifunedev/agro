# US-010 / US-011 / US-012 note — candidate install and recreation smoke

Worktree: `/home/sandbox/harness/.worktrees/task/939-cli-first-release`
Branch: `task/939-cli-first-release`

This host has no Docker socket. Live container evidence is not collected here. US-012 remains incomplete until exact-head Docker CI runs.

## Script contract

```bash
bash -n .agro/scripts/cli-first-install-smoke.sh
# SYNTAX_EXIT=0

bash .agro/scripts/cli-first-install-smoke.sh --help
```

Phases: `pack` | `bootstrap` | `seed` | `recreate` | `all`.

`--image` is required for seed/recreate/all. Released `:latest` tags are refused.

`--cleanup-only` removes only resources recorded in `--workdir/manifest`. Missing manifest and `CLI_FIRST_CLEANUP_SCOPE=unscoped` are refused.

## What the script asserts (not yet live)

Pack:

- `npm pack` of `.agro/cli`
- install the tarball into an isolated prefix
- invoke that prefix's `agro --version` and record tarball/bundle identity

Bootstrap:

- real `get-agro.sh` against the built `agro.js` via `AGRO_JS_URL=file://…`
- isolated HOME / profile / bin
- installed bytes equal the candidate bundle
- version in a new shell
- `--bootstrap-without-node` fails when `node` is present; records `node_before=ABSENT` when it is not

Seed:

- `agro sandbox install docker --name … --yes --image=<locally built candidate>`
- isolated `AGRO_HOME`
- no `--repo`
- empty persistent workspace
- `.agro/` present, `.agro/.image-seeded` present, `.oh/` absent
- PID 1 is systemd; `openharness-bootstrap.service` and `openharness-cron.service` active via the existing healthcheck command

Recreate (socket `false` then `true`):

- `agro config set --sandbox <name> access.dockerSocket <value>`
- supported recreation: `agro stop` then `agro sandbox install docker --name … --yes --image=…`
- before/after: container ID changes, storage identity stays, saved settings stay, synthetic `0600` credential and `0755` canary survive with UID/GID, seeded edit and seed-marker hash survive
- socket disabled: no `docker.sock` mount/file and no Docker API as sandbox user with `DOCKER_HOST` cleared
- socket enabled: mount present and `docker info` as sandbox user with `DOCKER_HOST` cleared
- runner `DOCKER_HOST` is ignored

Cleanup affects only recorded fixture resources.

## Fixture tests (this host)

Focused vitest for `cli-first-install-smoke.test.ts` and the real-bundle case in `get-agro.test.ts` passed (see `evidence/release-contract.md`). Stubs do not establish live runtime acceptance.

## CI wiring (for US-012)

`.github/workflows/sandbox-boot-guard.yml` (non-publishing Docker CI):

1. Builds the sandbox image as `openharness-sandbox-boot-guard:${{ github.sha }}` (not released `latest`).
2. Builds the candidate CLI.
3. Runs bootstrap without Node inside `debian:bookworm-slim`.
4. Runs `cli-first-install-smoke.sh --phase all --image "$CANDIDATE_IMAGE" --require-docker`.
5. Uploads `cli-first-install-smoke.log`.

Live container evidence waits on that exact-head job. Do not treat this file as US-012 pass.
