# PRD: Random sandbox password

Status: DRAFT

## User Stories

### US-001: Generate one password for each Docker sandbox

**Description:** As an operator, I want a random sudo password for each Docker sandbox so that nobody can use a published default.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/secrets.ts` exports `ensureSandboxPassword(root)`. If the entry `.env` has no `SANDBOX_PASSWORD` value, the function writes a value of 32 URL-safe base64 characters from `node:crypto` `randomBytes(24)`.
- [ ] If `SANDBOX_PASSWORD` already has a value, `ensureSandboxPassword(root)` leaves the `.env` file byte-identical.
- [ ] `runSandbox()` in `.agro/cli/src/commands/lifecycle.ts` calls `ensureSandboxPassword(root)` before it provisions a `docker` entry. The OpenShell path does not call the function.
- [ ] `agro sandbox install docker --print-argv` writes no `.env` value.
- [ ] Two new entries receive two different values.
- [ ] `pnpm exec vitest run .agro/cli/src/lib/__tests__/secrets.test.ts .agro/cli/src/__tests__/lifecycle.test.ts .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-002: Remove the known default

**Description:** As an operator, I want no default password in the image and the Compose files. A sandbox without a configured password then has no usable password.

**Acceptance Criteria:**

- [ ] `.devcontainer/docker-compose.yml` and `.devcontainer/docker-compose.image-only.yml` pass `SANDBOX_PASSWORD=${SANDBOX_PASSWORD:-}`. `git grep -n test1234 -- .devcontainer .agro/cli/src .agro/scripts` prints nothing.
- [ ] If `SANDBOX_PASSWORD` is set, `.devcontainer/entrypoint.sh` sets the `sandbox` password with `chpasswd`, as today.
- [ ] If `SANDBOX_PASSWORD` is empty, `.devcontainer/entrypoint.sh` locks the `sandbox` password with `passwd -l sandbox` and prints one warning line that names `agro secret set SANDBOX_PASSWORD`.
- [ ] `.agro/scripts/__tests__/entrypoint.test.ts` asserts both branches and the order of the password step relative to the ownership repairs.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/entrypoint.test.ts .agro/scripts/__tests__/sandbox-privilege-boundary.test.ts .agro/scripts/__tests__/compose-config-path-parity.test.ts` exits 0.

### US-003: Read the password back

**Description:** As an operator, I want one command that prints the sandbox password. I use the password for `sudo` or SSH password auth without opening the secrets file.

**Acceptance Criteria:**

- [ ] `agro secret get <KEY> [--sandbox <name>]` prints the raw value of an allowed secret key and exits 0.
- [ ] For a key without a value, `agro secret get` prints nothing to stdout, prints one line to stderr, and exits 1.
- [ ] For a key outside `SECRET_KEYS`, `agro secret get` exits 1 with the existing `assertSecretKey()` message.
- [ ] `agro secret list` keeps its redacted output.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/config-secret.test.ts` exits 0.

### US-004: Update the documents

**Description:** As an operator, I want the documents to describe the generated password so that no page tells me the old default.

**Acceptance Criteria:**

- [ ] `.example.env`, `docs/installation.md`, `docs/integrations/sshd.md`, `docs/security-considerations.md`, and `docs/configuration.md` name the generated password and `agro secret get SANDBOX_PASSWORD`, and contain no `test1234`.
- [ ] `CHANGELOG.md` has one bullet under `## [Unreleased]` that names #1378.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no new finding on each changed document.

### US-005: Record manual review evidence

**Description:** As the advisor, I want a live transcript so that the PR proves the password flow on a real sandbox. This story depends on US-001 through US-004.

**Acceptance Criteria:**

- [ ] The operator approves the use of a local or exe.dev Docker sandbox before the first live command.
- [ ] `.agro/tasks/random-sandbox-password/evidence/manual-review.md` holds each command, its trimmed output, and its exit status, in the shape of `.agro/skills/git/references/manual-review.md`.
- [ ] The transcript shows that `agro secret get SANDBOX_PASSWORD --sandbox <name>` prints a value of 32 characters. The transcript redacts the value.
- [ ] The transcript shows that `sudo -S true` in the sandbox exits 0 with the generated value and exits non-zero with `test1234`.
- [ ] The transcript ends with `agro destroy <name> --yes` and an `agro sandbox list` without the entry.

## Summary

### Verified current state

- `.devcontainer/docker-compose.yml:18` and `.devcontainer/docker-compose.image-only.yml:14` pass `SANDBOX_PASSWORD=${SANDBOX_PASSWORD:-test1234}`.
- `.devcontainer/entrypoint.sh:256` runs `PW="${SANDBOX_PASSWORD:-test1234}"`, then `chpasswd`, on each boot.
- `.devcontainer/Dockerfile` grants `sandbox ALL=(ALL) ALL`, so `sudo` asks for the password.
- `SANDBOX_PASSWORD` is an allowed secret in `SECRET_KEYS` (`.agro/cli/src/lib/secrets.ts`). `setSecret()` writes the entry `.env` through `setKeyInEnv()`.
- `agro secret list` prints redacted values. No command prints a raw value.
- `docs/integrations/sshd.md` warns that the default `test1234` is weak. SSH password auth (`access.sshPasswordAuth`) uses the same secret.
- `runSandboxInstall()` calls `runSandbox()`, so one call site in `runSandbox()` covers a new install and each later provision.

### Selected approach

The CLI generates the password, and the entry `.env` stays the only store. The image keeps no default. An empty value locks the password, so an unconfigured sandbox has no usable sudo password. The operator still reaches root through `docker exec -u root`. ADR #1378 records this change as step 1.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `ensureSandboxPassword` (new), `setSecret`, `readSecret` | Generates and stores the value |
| `.agro/cli/src/commands/lifecycle.ts` | `runSandbox` | Calls `ensureSandboxPassword` before a Docker provision |
| `.agro/cli/src/commands/secret.ts` | new `get` handler, `readSecret` | Prints the raw value |
| `.agro/cli/src/cli.ts` | `secret` verb dispatch and help | Exposes `agro secret get` |
| `.devcontainer/docker-compose.yml` | `environment` | Drops the default |
| `.devcontainer/docker-compose.image-only.yml` | `environment` | Drops the default |
| `.devcontainer/entrypoint.sh` | password step | Sets or locks the password |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker` | Behaviour | Writes a random `SANDBOX_PASSWORD` when the entry has none |
| `agro secret get <KEY>` | New | Prints the raw value of an allowed secret |
| Image boot | Behaviour | Locks the password when `SANDBOX_PASSWORD` is empty |
| Documents | Update | Remove `test1234` and name `agro secret get SANDBOX_PASSWORD` |

## Storage

The value stays in the gitignored entry `.env` at `${AGRO_HOME:-~/.agro}/sandboxes/<name>/.env`, written through `setKeyInEnv()`. No new store.

## Architectural Decisions

- **Source of truth.** The entry `.env` holds the password. The image and Compose files hold no value.
- **Existing sandboxes.** The next provision writes a value for an entry without one. The next boot applies the value through `chpasswd`. An entry with a value keeps the value.
- **Scope.** Docker only. The OpenShell workload has no sudo path, because `no_new_privs` applies.
- **Retrieval.** `agro secret get` is the only command that prints a raw secret value.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | writes 32 characters when missing; keeps an existing value byte-identical; two calls on two roots differ | US-001 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | Docker provision writes the value; OpenShell provision does not | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--print-argv` writes no value | US-001 |
| `.agro/scripts/__tests__/entrypoint.test.ts` | set branch, lock branch, step order | US-002 |
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | Compose files carry no default | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `get` prints the raw value; missing value exits 1; unknown key exits 1 | US-003 |

## Design Principles

- One store for each secret: the entry `.env`.
- Fail closed: no value means no usable password.
- Never print a secret unless the operator runs `agro secret get`.
- Keep the Docker argv and boot order unchanged apart from the password step.

## Out of Scope

- Removal of sudo from the image.
- Egress control and credential isolation (ADR #1378, later steps).
- Password rotation on a schedule.
- The OpenShell runtime.

## Open Questions

None. The operator confirmed `agro secret get` as the retrieval command on 2026-10-10.

## Acceptance Criteria

- [ ] `git grep -n test1234 -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints nothing.
- [ ] `pnpm test` exits 0, and `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] A new Docker sandbox has a random 32-character password, and `sudo` rejects `test1234`.
- [ ] `.agro/tasks/random-sandbox-password/evidence/manual-review.md` holds the US-005 transcript.

## Lessons

1. **Claim:** `agro sandbox upgrade` provisions through `runSandbox()`, so an existing entry without a password gains a password at the next upgrade. **Evidence:** the US-001 upgrade test in `.agro/cli/src/__tests__/sandbox.test.ts`. **Outcome:** fixed in this PR; `docs/installation.md` and `docs/configuration.md` state the behaviour.
2. **Claim:** `agro secret list` shows the first five characters of each secret value. **Evidence:** step 8 of `evidence/manual-review.md`. **Outcome:** issue #1396.
3. **Claim:** A single-line search for a code span misses a code span across a line break. **Evidence:** the advisor reopened US-004 after a single-line `grep -c` missed `agro secret get SANDBOX_PASSWORD` in `docs/security-considerations.md`. **Outcome:** dropped, because the observation concerns the advisor process, not the product.
