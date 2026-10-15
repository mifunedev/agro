# PRD: Console provider for the remote-sandbox skill

Status: DRAFT

## User Stories

### US-001: Add the console adapter

**Description:** As an operator, I want `run.sh console` to create an agro-console sandbox node, run a check on it, and destroy it. AGRO checks then run on our own platform, as on exe.dev and Vercel.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/adapters/console.sh` defines `console_preflight`, `console_create`, `console_exec`, `console_destroy`, and `console_list`.
- [ ] `console_preflight` runs `agro node list --json` and exits 0 only when the console answers. The adapter reads `AGRO_CONSOLE_URL` and `AGRO_CONSOLE_TOKEN` on the driver host only, through the `agro` CLI.
- [ ] `console_create NAME` runs `agro node create --spec "${CONSOLE_SPEC:-n4}" --ssh-key "$CONSOLE_SSH_KEY_ID" --name NAME --json`, and adds `--free-tier` unless `CONSOLE_FREE_TIER=0`. The free tier is on by default. The function stores the node ID and the SSH target in `$STATE_DIR/console-NAME`.
- [ ] `console_create` exits 2 with a clear message when `IMAGE` is set, because a console node has no image choice.
- [ ] `console_exec NAME CMD…` runs `CMD…` through `ssh` with `$CONSOLE_SSH_IDENTITY` and the `SSHO` options to the stored SSH target, under `timeout 120`.
- [ ] `console_destroy NAME` runs `agro node delete <id> --yes` and retries a `409` for up to 60 s.
- [ ] `console_list` prints the number of nodes from `agro node list --json` whose name starts with `agro-mx-`.
- [ ] `console_row_ssh` prints `RESULT R10-ssh-inbound PASS ssh <target>`. The adapter defines no `console_row_https` and no `console_restart`.
- [ ] `bash -n` and `shellcheck` pass on the file.
- [ ] `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` covers each function with a stub `agro` and a stub `ssh` on `PATH`. The tests include the `IMAGE` refusal, the `409` retry, the name filter of `console_list`, the default `--free-tier`, and `CONSOLE_FREE_TIER=0`.
- [ ] Typecheck passes.

### US-002: Document the console provider

**Description:** As an operator, I want setup steps and a manual sweep for the console provider. I can then run and clean up a console run without reading the adapter.

**Acceptance Criteria:**

- [ ] `references/providers.md` has an "agro-console" section. The section lists the variables `AGRO_CONSOLE_URL`, `AGRO_CONSOLE_TOKEN`, `CONSOLE_SSH_KEY_ID`, `CONSOLE_SSH_IDENTITY`, `CONSOLE_SPEC`, and `CONSOLE_FREE_TIER`. The section also gives the preflight command, the free tier limit of one live node, and the manual sweep with `agro node list` and `agro node delete`.
- [ ] `SKILL.md` names the console provider in the description, the compatibility line, and the references table.
- [ ] `references/providers.md` states that a console sandbox node has no Docker at create, so a check that needs Docker installs it in the VM.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no finding on each changed file.

### US-003: Record a fresh-install run on the console

**Description:** As the advisor, I want one real fresh-install run on the console so that the adapter is proven end to end.

**Acceptance Criteria:**

- [ ] With operator approval, `bash scripts/run.sh console --preflight` prints `preflight ok: console`.
- [ ] With operator approval, `bash scripts/run.sh console` reports `F1` to `F4` from the log, and the log ends with `remaining agro-matrix resources on console: 0` and `RUN DONE`.
- [ ] The agent writes the transcript to `.agro/tasks/remote-sandbox-console/evidence/manual-review.md`.

## Summary

Verified current state:

- The remote-sandbox driver loads `adapters/*.sh` and needs five functions per provider (`SKILL.md`, "Adapter contract").
- The exe.dev adapter uses the provider SSH command API and `ssh <name>.exe.xyz` (`adapters/exedev.sh`).
- The AGRO CLI has `agro node create --spec <spec> --ssh-key <uuid> [--name <name>] [--free-tier] [--json]`, `agro node list [--json]`, and `agro node delete` (`.agro/cli/src/commands/node.ts`). The CLI reads `AGRO_CONSOLE_URL` and `AGRO_CONSOLE_TOKEN`. The CLI creates sandbox-profile nodes only.
- A warm console sandbox node reaches first SSH login in about 4 s (mifunedev/agro-console#417). The SSH user is `sandbox` with passwordless sudo.
- A sandbox node has no Docker at create. The CLI has no `--docker` flag yet (mifunedev/agro#1437).

Approach: one adapter file that drives the `agro` CLI on the driver host and uses plain `ssh` for `exec`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/remote-sandbox/adapters/console.sh` | `console_*` | New adapter |
| `.agro/skills/remote-sandbox/scripts/lib.sh` | `SSHO`, `STATE_DIR`, `load_adapters` | Shared options and state |
| `.agro/skills/remote-sandbox/scripts/run.sh` | driver | Calls the adapter |
| `.agro/cli/src/commands/node.ts` | `node create/list/delete` | Console API client |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | adapter tests | Stub tests |
| `.agro/skills/remote-sandbox/references/providers.md` | provider setup | Docs |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `scripts/run.sh console` | New provider | Runs each check on a console node |
| Environment | New variables | `CONSOLE_SSH_KEY_ID`, `CONSOLE_SSH_IDENTITY`, `CONSOLE_SPEC`, `CONSOLE_FREE_TIER` |

## Storage

The adapter writes one state file per node in `$MATRIX_OUT/.state/console-<name>` with the node ID and the SSH target. The driver already owns this directory.

## Architectural Decisions

- The adapter uses the `agro` CLI, not raw HTTP. The CLI owns the console API and its token handling.
- The console token stays on the driver host. No check sees it (skill rule 2).
- `console_list` counts by the `agro-mx-` name prefix, because a console node has no tag.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | preflight, create with state, IMAGE refusal, exec, destroy with 409 retry, list by prefix, row_ssh | US-001 |

Run `pnpm test`, `pnpm run typecheck`, and the boot path lint (`shellcheck`) before Close.

## Design Principles

- Keep the adapter to the five functions plus `row_ssh`.
- Read each credential on the driver host only.
- Add no explanatory comments to tracked code.

## Out of Scope

- `--docker`, `--profile`, and `--t3` on `agro node create` (mifunedev/agro#1437).
- A restart hook and an HTTPS row for console nodes.
- Agro-profile console nodes.

## Open Questions

None. The operator chose the provider name `console`, and the free tier on by default with `CONSOLE_FREE_TIER=0` to turn it off.

## Acceptance Criteria

- [ ] `pnpm test`, `pnpm run typecheck`, and the boot path lint exit 0.
- [ ] One fresh-install run on the console passes `F1` to `F4` and leaves 0 nodes.

## Lessons

Filled by the advisor before undraft.
