# PRD: Prime Agent harness support

Status: DRAFT

## User Stories

### US-001: Add the pinned Prime Agent catalog entry

**Description:** As an operator, I want `agro harness install prime-agent` to install a pinned Prime Agent into the harness prefix. I can then run Prime Agent in the sandbox.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/harnesses/catalog.ts` holds one entry with `id: "prime-agent"`, `title: "Prime Agent"`, `binary: "prime-agent"`, `installUser: "sandbox"`, and `kind: "installable"`.
- [ ] The entry `installArgv` is `["bash", "-lc", "set -o pipefail; curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | PRIME_AGENT_VERSION=0.10.0 PRIME_AGENT_RUST_PREFIX=\"{{prefix}}\" PRIME_AGENT_UV_BIN_DIR=\"{{prefix}}/bin\" sh"]`. The TypeScript source spells `{{prefix}}` through `HARNESS_PREFIX_TOKEN`.
- [ ] The entry `verifyArgv` is `["prime-agent", "--version"]`.
- [ ] The entry `uninstallArgv` is `["rm", "-rf", "{{prefix}}/bin/prime-agent", "{{prefix}}/share/prime-agent"]`.
- [ ] The entry `docsPath` is `docs/harnesses/prime-agent.md`, and that file exists with an `## Install` section.
- [ ] `.agro/cli/src/__tests__/harness-catalog.test.ts` adds `prime-agent` to the installable list, the shipped-argv table, and the host-prefix `it.each` list.
- [ ] `.agro/cli/src/__tests__/harness-catalog.test.ts` adds one test that asserts the `PRIME_AGENT_VERSION=0.10.0` pin.
- [ ] `.agro/cli/src/__tests__/harness-catalog.test.ts` adds one `toMatchObject` registration test in the shape of the fx test at line 272.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-002: Document Prime Agent

**Description:** As an operator, I want a complete Prime Agent page and catalog listings. I can then install, sign in, run, and remove Prime Agent without upstream research.

**Acceptance Criteria:**

- [ ] `docs/harnesses/prime-agent.md` has these sections in order: Install, Uninstall, Authentication, Common usage, AGRO integration, References.
- [ ] The AGRO integration section has the subsections Project instructions, Skills, MCP servers, Hooks and guards, and Herdr.
- [ ] The Uninstall section states that `~/.prime/agent` stays after `agro harness uninstall prime-agent`, and it gives the command that removes `~/.prime/agent`.
- [ ] The Authentication section names `/login` and the provider API-key environment variables `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `PRIME_API_KEY`.
- [ ] The Authentication section states that the operator runs `prime-agent shutdown` after a change to a provider environment variable.
- [ ] The Hooks and guards subsection states that AGRO hooks under `.agro/hooks/` do not run under Prime Agent.
- [ ] The Herdr subsection tells the operator to start `prime-agent` in a Herdr pane, and it names the Prime Agent daemon as secondary to Herdr.
- [ ] `docs/harnesses/overview.md` names **Prime Agent** in the install sentence at line 7 and has one agent-table row with `agro harness install prime-agent`.
- [ ] `docs/README.md` line 29 and the `README.md` harness table each link `docs/harnesses/prime-agent.md`.
- [ ] `CHANGELOG.md` has one `### Added` entry under `## [Unreleased]` for Prime Agent.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/prime-agent.md` exits 0.
- [ ] `pnpm test` exits 0.

### US-003: Prove the installer on a fresh VM

**Description:** As the advisor, I want a credential-free `remote-sandbox` check for Prime Agent. An exe.dev VM then proves the installer, the pin, and discovery on a clean AGRO image.

**Acceptance Criteria:**

- [ ] The check is at `.agro/tasks/prime-agent-harness/checks/prime-agent-harness.sh`. The check prints `RESULT <id> <PASS|FAIL|INFO> <detail>` lines and ends with `SUMMARY fails=<n>`.
- [ ] The check follows the image-mode shape of `.agro/tasks/fx-harness/checks/fx-harness.sh` and runs each Prime Agent command as the `sandbox` user.
- [ ] Row `P1-install` runs the same installer command as the US-001 `installArgv`, with the prefix `/home/sandbox/.local`.
- [ ] Row `P2-version` passes when `prime-agent --version` prints `0.10.0`.
- [ ] Row `P3-binary` passes when `command -v prime-agent` prints `/home/sandbox/.local/bin/prime-agent`.
- [ ] Row `P4-instructions` passes when `prime-agent prompt` in `/home/sandbox/harness` prints `/home/sandbox/harness/AGENTS.md`.
- [ ] Row `P5-skills` passes when `prime-agent prompt` prints `/home/sandbox/harness/.agents/skills/prd/SKILL.md`.
- [ ] Row `P6-clean` passes when `git -C /home/sandbox/harness status --porcelain` prints the same lines before and after rows `P1` to `P5`.
- [ ] Row `P7-uninstall` runs the US-001 `uninstallArgv` and passes when `command -v prime-agent` exits 1.
- [ ] The operator approves the run before the advisor starts the driver.
- [ ] The advisor starts `IMAGE=ghcr.io/mifunedev/agro:latest bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/prime-agent-harness/checks/prime-agent-harness.sh` detached in a named tmux session.
- [ ] `.agro/tasks/prime-agent-harness/evidence/exedev-validation.md` records each `RESULT` line and `SUMMARY fails=0`.
- [ ] The driver destroys the VM, and the evidence file records the destroy step.

### US-004: Record the manual review

**Description:** As a reviewer, I want an exe.dev transcript of the task-branch `agro harness install prime-agent` verb. I also want one local authenticated run and one local Herdr launch. The evidence confirms the integrated behavior before merge.

**Acceptance Criteria:**

- [ ] The branch check is at `.agro/tasks/prime-agent-harness/checks/prime-agent-branch.sh`. The check prints `RESULT <id> <PASS|FAIL|INFO> <detail>` lines and ends with `SUMMARY fails=<n>`.
- [ ] Row `M1-branch-cli` clones `AGRO_REF`, builds the CLI, and puts the CLI first on `PATH`, in the shape of `.agro/skills/remote-sandbox/checks/docker-egress.sh`. The row passes when `command -v agro` prints the branch CLI path.
- [ ] Row `M2-sandbox` passes when `agro sandbox install docker --name <name> --checkout <clone> --yes` exits 0 and the sandbox reports healthy.
- [ ] Row `M3-install` passes when `command -v prime-agent` exits 1 in the sandbox before the install, and `agro harness install prime-agent` then exits 0 as the `sandbox` user.
- [ ] Row `M4-version` passes when `prime-agent --version` in the sandbox prints `0.10.0`.
- [ ] Row `M5-discovery` passes when `prime-agent prompt` in `/home/sandbox/harness` prints `/home/sandbox/harness/AGENTS.md` and `/home/sandbox/harness/.agents/skills/prd/SKILL.md`.
- [ ] Row `M6-clean` passes when `git -C /home/sandbox/harness status --porcelain` in the sandbox prints the same lines before and after rows `M3` to `M5`.
- [ ] Row `M7-uninstall` passes when `agro harness uninstall prime-agent` exits 0, and `command -v prime-agent` then exits 1.
- [ ] Row `M8-state-kept` passes when `~/.prime/agent` exists in the sandbox after row `M7`.
- [ ] The check and the driver environment carry no API key, token, or `.env` file into the VM.
- [ ] The branch `feat/1500-prime-agent-harness` holds US-001 on the remote before the run.
- [ ] The operator approves the run before the advisor starts the driver.
- [ ] The advisor starts `AGRO_REF=feat/1500-prime-agent-harness bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/prime-agent-harness/checks/prime-agent-branch.sh` detached in a named tmux session.
- [ ] The driver log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.
- [ ] After the VM run, the advisor builds the task-branch CLI and runs its `harness install prime-agent` in this sandbox. The command exits 0.
- [ ] With the operator's provider API key in this sandbox environment, `prime-agent -p "<prompt that names the prd skill>"` in `/home/sandbox/harness` exits 0. The output shows that Prime Agent read `/home/sandbox/harness/.agents/skills/prd/SKILL.md`.
- [ ] `herdr agent start prime --cwd /home/sandbox/harness -- prime-agent` starts a pane, and `herdr agent list` names that pane. The advisor closes the pane after the check.
- [ ] After the local checks, `agro harness uninstall prime-agent` exits 0. The advisor deletes `~/.prime` with operator approval.
- [ ] No transcript shows an API key value.
- [ ] `.agro/tasks/prime-agent-harness/evidence/manual-review.md` holds each `RESULT` line, `SUMMARY fails=0`, and the local transcript with each command, its output, and its exit status.

## Summary

AGRO installs each optional harness through one catalog entry in `.agro/cli/src/lib/harnesses/catalog.ts`. The `agro harness install` verb runs the entry `installArgv` as the `sandbox` user into the prefix `/home/sandbox/.local`. The CI job `optional-harness-install` in `.github/workflows/sandbox-compatibility.yml` installs each installable entry. The job requires the binary under `/home/sandbox/.local` and a dotted version from `--version`.

Prime Agent is the MIT-licensed coding agent at `https://github.com/PrimeIntellect-ai/prime-agent`. The upstream installer at `https://app.primeintellect.ai/prime-agent/install.sh` verifies a SHA256 checksum. The installer accepts `PRIME_AGENT_VERSION`, `PRIME_AGENT_RUST_PREFIX`, and `PRIME_AGENT_UV_BIN_DIR`. The installer requires glibc 2.35 or newer. The sandbox image runs Debian glibc 2.41.

A council and a spike on 2026-10-21 verified these facts in this sandbox with version 0.10.0:

1. The pinned installer exited 0. The installer wrote `~/.local/bin/prime-agent`, `~/.local/share/prime-agent/`, and `~/.prime/agent/`.
2. `prime-agent --version` printed `0.10.0`.
3. `prime-agent prompt` loaded `/home/sandbox/harness/AGENTS.md`.
4. `prime-agent prompt` listed 22 of 24 canonical skills through `/home/sandbox/harness/.agents/skills`. The two absent skills set `disable-model-invocation: true`.
5. The install changed no tracked file.

AGRO added Prime Agent once in #839 from #838 and retired it in #918. Issue #918 names three causes. This plan answers each cause:

1. The old integration added a provider surface at `.prime/agent/`. This plan adds no provider surface, because Prime Agent reads `.agents/skills`.
2. The old integration was an on-demand harness. This plan adds an installable entry that the `optional-harness-install` CI job verifies.
3. The old integration inferred skill loading from upstream documentation. This plan observes skill discovery with `prime-agent prompt` in US-003 and US-004.

Issue #918 states that a future integration can return through a new, validated proposal. This plan is that proposal.

The selected approach is a catalog-tier harness in the shape of fx (`ddc95c43`). The task adds no Dockerfile change, no `link-providers.sh` change, no gateway, and no `agro.json` key.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | `HARNESS_CATALOG`, `HARNESS_PREFIX_TOKEN` | Holds the new `prime-agent` entry. |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | installable list (line 71), host-prefix `it.each` (line 355), shipped-argv table (line 316), uninstall tests (lines 405 to 460) | Locks the entry, the pin, and the removal paths. |
| `.agro/scripts/link-providers.sh` | `provider_links` (lines 22 to 26) | Exposes `.agents/skills`. No change. |
| `.github/workflows/sandbox-compatibility.yml` | job `optional-harness-install` (lines 61 to 161) | Installs and verifies each installable entry. No change. |
| `docs/harnesses/prime-agent.md` | new page | Operator documentation. |
| `docs/harnesses/overview.md` | install sentence (line 7), agent table (line 90) | Lists the harness. |
| `docs/README.md`, `README.md`, `CHANGELOG.md` | harness links, `## [Unreleased]` | Lists the harness and records the change. |
| `.agro/skills/remote-sandbox/scripts/run.sh` | driver | Runs the US-003 check. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install prime-agent` | new catalog id | Installs Prime Agent 0.10.0 into the harness prefix. |
| `agro harness uninstall prime-agent` | new catalog id | Removes `bin/prime-agent` and `share/prime-agent` under the prefix. |
| `agro harness list --json` | new row | Lists `prime-agent` as installable. |

## Storage

The install writes only under the harness prefix: `bin/prime-agent` and `share/prime-agent/`. Prime Agent writes its sessions, credentials, and Python kernel environment to `~/.prime/agent/`. That directory is in the persistent home volume, so the directory survives `agro recreate`. The uninstall verb keeps `~/.prime/agent/`, because the directory holds operator credentials and sessions. The docs page gives the removal command.

## Architectural Decisions

- **Source of truth:** the catalog entry owns the install, verify, and uninstall commands. The tests copy the expected argv from the entry shape.
- **Shared primitives:** Prime Agent reads `AGENTS.md` and `.agents/skills` natively. AGRO adds no mirror and no new link.
- **uv location:** `PRIME_AGENT_UV_BIN_DIR="{{prefix}}/bin"` keeps a fallback `uv` install inside the prefix for a host-prefix install. The sandbox image already has `/usr/local/bin/uv`, so the installer skips the `uv` install there.
- **Persistence:** interactive sessions run in a Herdr pane. The Prime Agent daemon socket is under `/tmp`, so the daemon does not survive a container restart. The saved sessions in `~/.prime/agent` survive.
- **Pin:** the entry pins 0.10.0, the version that the spike verified. Upstream published 0.10.1 on 2026-10-21. A later task moves the pin after a new validation.
- **Remote validation:** both checks stay in the task folder, as in fx. US-003 tests the upstream installer on the released image. US-004 tests the task-branch CLI through `AGRO_REF`, because the released image has no `prime-agent` entry. The task adds no row to `.agro/skills/remote-sandbox/checks/agro-rows.sh`.
- **Credentials:** the `remote-sandbox` skill sends no API token into a VM. The authenticated run and the Herdr launch therefore run in this sandbox.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | installable list, shipped argv, host prefix, version pin, registration | Entry shape, pin, and prefix substitution |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | existing docs-page, sandbox-user, and uninstall-prefix tests | The new entry passes the generic contract |
| `.github/workflows/sandbox-compatibility.yml` | `optional-harness-install` | Container install, restart survival, binary path, dotted version |
| `.agro/tasks/prime-agent-harness/checks/prime-agent-harness.sh` | rows `P1` to `P7` on exe.dev | Installer, pin, discovery, clean tree, uninstall |
| `.agro/tasks/prime-agent-harness/checks/prime-agent-branch.sh` | rows `M1` to `M8` on exe.dev | Task-branch install verb, discovery, clean tree, uninstall, retained state |
| `.agro/tasks/prime-agent-harness/evidence/manual-review.md` | US-004 transcript | Branch rows, authenticated skill load, Herdr launch |

Write the US-001 test rows first. The rows fail until the catalog entry exists.

## Design Principles

- Change the canonical surface only. Patch no provider mirror.
- Keep the smallest change that passes the contract. Copy the fx shape.
- Install only as the `sandbox` user into the prefix.
- Run interactive work in Herdr.
- Write no explanatory comment in tracked code.

## Out of Scope

- A Dockerfile, entrypoint, or `banner.sh` change.
- A gateway, a tmux service, or a workspace script for Prime Agent.
- A `tracingWriter` for Prime Agent.
- A Herdr provider integration.
- A change to the `HARNESSES` list in `.agro/skills/behavioral-training/scripts/lib/inventory.mjs`.
- A new row in `.agro/skills/remote-sandbox/checks/agro-rows.sh`.
- AGRO hook support inside Prime Agent.

## Open Questions

None. The operator chose one authenticated `prime-agent -p` turn in US-004, because issue #918 named authenticated skill loading as unobserved.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] The task diff does not change `.devcontainer/` or `.agro/scripts/link-providers.sh`.
- [ ] The `optional-harness-install` CI job passes and prints `prime-agent --version` output `0.10.0`.
- [ ] `.agro/tasks/prime-agent-harness/evidence/exedev-validation.md` records `SUMMARY fails=0`.
- [ ] `.agro/tasks/prime-agent-harness/evidence/manual-review.md` holds the US-004 transcript.

## Lessons

Filled by the advisor before undraft.
