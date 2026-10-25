# PRD: Keep the sandbox password out of reach of the agent

Status: BLOCKED

## User Stories

### US-001: Red test for password exposure inside the sandbox

**Description:** As an operator, I want a failing test for the password exposure so that the fix has a red test before the change.

**Acceptance Criteria:**

- [ ] A test in `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` asserts that `.devcontainer/docker-compose.yml` and `.devcontainer/docker-compose.image-only.yml` pass no `SANDBOX_PASSWORD` entry through `environment:`.
- [ ] Before US-002, the new test fails, and the failure names `SANDBOX_PASSWORD=${SANDBOX_PASSWORD:-}`.
- [ ] The existing case "passes SANDBOX_PASSWORD with no default value" (`sandbox-privilege-boundary.test.ts:181-183`) is replaced by the new assertion, not kept beside it.

### US-002: Deliver the password without exposing the plaintext to `sandbox`

**Description:** As an operator, I want the entrypoint to set the sandbox password with no plaintext that a `sandbox` process can read. The password then keeps the agent out of root.

**Acceptance Criteria:**

- [ ] The delivery follows the option that the operator selects in Open Question 1.
- [ ] The US-001 test passes.
- [ ] `.agro/scripts/__tests__/entrypoint.test.ts` asserts the new password step, and still asserts the `passwd -l sandbox` lock path with the `agro secret set SANDBOX_PASSWORD` recovery message.
- [ ] `agro secret get SANDBOX_PASSWORD` on the host still prints the stored value.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-003: Manual review evidence

**Description:** As a reviewer, I want a transcript from a started sandbox so that the fix is proven on a real container.

**Acceptance Criteria:**

- [ ] `.agro/tasks/sandbox-password-env/evidence/manual-review.md` records, from a `sandbox` shell in a started container, the output `absent` for `if [ -n "${SANDBOX_PASSWORD:-}" ]; then echo present; else echo absent; fi`.
- [ ] The transcript records that `sudo -S true` accepts the stored password. The transcript redacts the value.
- [ ] The transcript records that the operator checked, by hand, whether the stored plaintext is readable inside the sandbox at `/home/sandbox/harness/.env` or `/home/sandbox/harness/.devcontainer/.env`.
- [ ] The story uses a sandbox only with operator approval and deletes each sandbox that it creates.

## Summary

Issue #1492 reports that every process that runs as `sandbox`, including the coding agent, can read `SANDBOX_PASSWORD`. A presence check in an agent session on 2026-10-20 printed `present`.

Verified current state:

- Compose passes the value through `environment:` (`.devcontainer/docker-compose.yml:18`, `.devcontainer/docker-compose.image-only.yml:14`). The value becomes part of the container configuration, so each `docker exec` session inherits the value. An entrypoint cannot remove a value from the container configuration.
- The entrypoint runs `chpasswd` with the value (`.devcontainer/entrypoint.sh:317-322`).
- A test enforces the current delivery (`.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts:181-183`).
- `docker-compose.sh` reads the dotenv from `agro_env_file`, which returns `<repo>/.env` or `<repo>/.devcontainer/.env` (`.agro/scripts/paths.sh:26-32`). Compose bind-mounts `<repo>` at `/home/sandbox/harness` (`.devcontainer/docker-compose.yml:13`). The stored plaintext can therefore sit inside the sandbox mount.
- The `sandbox` user has uid 1000 (`.devcontainer/Dockerfile:79`). A host file owned by host uid 1000 is readable by `sandbox` through a bind mount.
- Hooks deny agent reads of `.env` paths, but AGENTS.md names Docker as the security boundary. Hooks are not a boundary.

The fix must close two exposure paths: the container environment, and the stored plaintext inside the bind mount.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/docker-compose.yml` | `services.sandbox.environment`, `volumes` | Delivers the password today; mounts `<repo>` |
| `.devcontainer/docker-compose.image-only.yml` | `services.sandbox.environment` | Delivers the password in image-only mode |
| `.devcontainer/entrypoint.sh` | lines 317-322 | Sets or locks the `sandbox` password |
| `.agro/scripts/paths.sh` | `agro_env_file` | Locates the dotenv that holds the plaintext |
| `.agro/scripts/docker-compose.sh` | `--env-file` arguments (lines 130-134) | Feeds the dotenv to Compose |
| `.agro/cli/src/lib/secrets.ts` | `SANDBOX_PASSWORD` generation (lines 71-72), `COMPOSE_SECRET_KEYS` | Generates and stores the value |
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | lines 181-183 | Enforces the current delivery |
| `.agro/scripts/__tests__/entrypoint.test.ts` | lines 81-93 | Enforces the current password step |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Container environment | Removal | `SANDBOX_PASSWORD` leaves `environment:` |
| `agro secret get` / `set` | Unchanged | The operator interface for the value stays the same |
| `docs/security-considerations.md`, `docs/integrations/sshd.md` | Update | The docs describe the new delivery |

## Storage

The plaintext stays in the host dotenv that `agro secret` manages. The selected option decides whether that dotenv must move outside the `<repo>` bind mount.

## Architectural Decisions

This task changes a security boundary. Open Question 1 holds the delivery decision. Run `/architect` on that decision before US-002. The candidate options are:

- **A. Pass a password hash.** The CLI hashes the password on the host and passes only the hash. The entrypoint runs `chpasswd -e`. A 192-bit random password does not fall to an offline attack on its hash. Cost: Node has no built-in `crypt`, and the host does not guarantee `openssl`.
- **B. Mount a root-only secret file.** Compose mounts a file that the entrypoint reads as root. Risk: a bind-mounted file keeps its host owner, and host uid 1000 maps to `sandbox`.
- **C. Keep the current delivery.** This option leaves #1492 open and relies on hooks, which are not a boundary.

Each option must also keep the stored plaintext out of the `<repo>` bind mount, or make the stored plaintext unreadable by `sandbox`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | no `SANDBOX_PASSWORD` in `environment:` | The container environment holds no plaintext |
| `.agro/scripts/__tests__/entrypoint.test.ts` | new password step; lock path | The entrypoint sets or locks the password |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | existing generation cases | Generation and storage stay unchanged |

## Design Principles

- The plaintext reaches root only. No `sandbox` process can read the plaintext.
- `agro secret` stays the only operator interface for the value.
- Docker is the security boundary. Hooks are not a boundary.

## Out of Scope

- Other secrets in `environment:`, for example `GH_TOKEN`. The agent uses those secrets by design.
- The `agro secret get` transcript exposure. Issue #1407 closed that path with a hook.

## Open Questions

1. Which delivery option does the operator select: A, B, or another option from `/architect`?
2. Does the stored plaintext sit inside the `<repo>` bind mount in each sandbox mode? The CC Safety Net hook blocks agent access to dotenv paths, so the operator must check the mount by hand.

## Acceptance Criteria
- [ ] `jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/sandbox-password-env/prd.json` exits 0.
- [ ] `pnpm test` exits 0 on the integrated task branch.
- [ ] From a `sandbox` shell in a started container, the presence check prints `absent`.

## Lessons

Filled by the advisor before undraft.
