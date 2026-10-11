# PRD: Secret delivery hardening

Status: DRAFT

## User Stories

### US-001: Deny agent reads through `agro secret get`

**Description:** As the operator, I want the agent hooks to deny `agro secret get` so that an agent cannot print a raw secret into its transcript.

**Acceptance Criteria:**

- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `agro secret get GH_TOKEN`.
- [ ] The hook returns `deny` for `agro secret get SANDBOX_PASSWORD --sandbox box` and for `npx agro secret get GH_TOKEN`.
- [ ] The hook returns no decision for `agro secret list` and for `agro secret set GH_TOKEN`.
- [ ] The deny message tells the agent to ask the operator to run the command.
- [ ] `.agro/scripts/__tests__/hooks.test.ts` holds a case for each command above, and `npx vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.

### US-002: Restrict `agro secret set --sandbox` to the keys that Compose passes

**Description:** As the operator, I want `agro secret set <KEY> --sandbox <name>` to refuse a key that never reaches the container so that a stored secret never fails silently.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/secrets.ts` exports `COMPOSE_SECRET_KEYS` with the values `GH_TOKEN`, `SANDBOX_PASSWORD`, and `TYPESAFE_API_KEY`.
- [ ] A test reads `.devcontainer/docker-compose.yml` and asserts that the `${KEY:-}` entries for allow-listed secret keys equal `COMPOSE_SECRET_KEYS`.
- [ ] With `--sandbox <name>`, `runSecretSet` exits 1 for `PI_SLACK_BOT_TOKEN` and writes no file.
- [ ] The refusal message names the key and tells the operator to run `agro secret set <KEY>` in the project checkout.
- [ ] With `--sandbox <name>`, `runSecretSet` exits 0 for `GH_TOKEN` and writes the entry `.env`.
- [ ] Without `--sandbox`, `runSecretSet` exits 0 for `PI_SLACK_BOT_TOKEN`.
- [ ] `npx vitest run .agro/cli/src/__tests__/config-secret.test.ts` exits 0.

### US-003: Document the delivery rule

**Description:** As the operator, I want the docs to state which keys `--sandbox` accepts so that the docs match the CLI.

**Acceptance Criteria:**

- [ ] `docs/configuration.md` states that `--sandbox` accepts only `GH_TOKEN`, `SANDBOX_PASSWORD`, and `TYPESAFE_API_KEY`.
- [ ] `docs/configuration.md` states that the container reads the other keys from the `.env` of the project checkout.
- [ ] `docs/security-considerations.md` states that the hooks deny `agro secret get` for agents.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/configuration.md` reports no new finding on a changed line.

### US-004: Record manual review evidence

**Description:** As the advisor, I want a command transcript so that the PR shows the changed behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/secret-delivery-hardening/evidence/manual-review.md` holds the hook output for `agro secret get GH_TOKEN` piped through the hook as JSON input.
- [ ] The file holds the output and exit code of `runSecretSet` for `PI_SLACK_BOT_TOKEN` with `--sandbox` in a temporary `AGRO_HOME`.
- [ ] The transcript holds no secret value.
- [ ] The story deletes each temporary directory that it creates.

## Summary

`agro secret get` is the only command that prints a raw secret (`.agro/cli/src/cli.ts:205`). `.agro/hooks/deny-env-dump.sh` has no rule for `agro`, so an agent can print `GH_TOKEN` into its transcript.

With `--sandbox <name>`, `agro secret set` writes `<entry>/.env` (`.agro/cli/src/commands/secret.ts:28-32`). `.agro/scripts/docker-compose.sh:70` passes that file to Compose with `--env-file`. The `environment:` list in `.devcontainer/docker-compose.yml:16-26` passes only `GH_TOKEN`, `SANDBOX_PASSWORD`, and `TYPESAFE_API_KEY`. The compose file has no `env_file:`. The container mounts the checkout at `/home/sandbox/harness`, not the entry. `entrypoint.sh:494`, `gateway.sh:13`, and `sandbox-healthcheck.sh:62` read the checkout `.env` through `agro_env_file`. A key such as `PI_SLACK_BOT_TOKEN` in `<entry>/.env` never reaches the container.

The selected approach denies `agro secret get` in the agent hook. The approach also restricts `--sandbox` writes to the keys that Compose passes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` | Agent command guard |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS`, new `COMPOSE_SECRET_KEYS` | Secret allow-list |
| `.agro/cli/src/commands/secret.ts` | `runSecretSet`, `secretsRoot` | Write path for secrets |
| `.devcontainer/docker-compose.yml` | `environment:` | Keys that reach the container |
| `.agro/scripts/paths.sh` | `agro_env_file` | File that container scripts read |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set <KEY> --sandbox <name>` | Behavior | Exits 1 for a key outside `COMPOSE_SECRET_KEYS` |
| Agent hook | Behavior | Denies `agro secret get` |
| `docs/configuration.md` | Docs | States the `--sandbox` key rule |
| `docs/security-considerations.md` | Docs | States the hook rule |

## Storage

No new storage. The entry `.env` and the checkout `.env` keep their paths and modes.

## Architectural Decisions

- `.devcontainer/docker-compose.yml` is the source of truth for the keys that reach the container. A test keeps `COMPOSE_SECRET_KEYS` equal to that list.
- The plan rejects a change that adds the other keys to the Compose `environment:` list. That change exposes the Slack tokens to every process in the container. That change also requires edits to `entrypoint.sh`, `gateway.sh`, and `sandbox-healthcheck.sh`.
- The operator keeps `agro secret get` for host use. Only the agent hook denies the command.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/hooks.test.ts` | deny `agro secret get`; allow `agro secret list` and `agro secret set` | US-001 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `--sandbox` refuses `PI_SLACK_BOT_TOKEN`; accepts `GH_TOKEN`; project root accepts `PI_SLACK_BOT_TOKEN` | US-002 |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `COMPOSE_SECRET_KEYS` equals the compose `environment:` keys | US-002 |

Write each test first. Confirm that each new test fails before the change.

## Design Principles

- Make the silent failure loud.
- Keep one source of truth for the keys that reach the container.
- Add no comments to tracked code.
- Edit the canonical hook in `.agro/hooks/`. Do not edit a provider mirror.

## Out of Scope

- A user-level secrets file.
- New keys in the Compose `environment:` list.
- `XAI_API_KEY` delivery. `.agro/install/banner.sh:123` reads the key from the environment, and Compose does not pass the key.
- `agro secret list` and `agro secret get` behavior for the operator.

## Open Questions

- Should a follow-up issue cover `XAI_API_KEY` delivery into the container?

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `.codex/hooks/deny-env-dump.sh` is unchanged.
- [ ] The PR changes no file outside the paths in Key Integration Points, the tests, the docs, and the task folder.

## Lessons

1. Claim: `agro secret set <KEY>` exits 0 and writes nothing when the piped value has no trailing newline. Evidence: `evidence/manual-review.md` side note, observed with `printf '%s' dummy-not-a-secret`. Outcome: proposed issue, not created.
2. Claim: Compose does not pass `XAI_API_KEY` into the container, and `.agro/install/banner.sh:123` reads the key from the environment. Evidence: `.devcontainer/docker-compose.yml:16-26`. Outcome: proposed issue, not created.
3. Claim: the jq branch of `.agro/hooks/deny-env-dump.sh` denies a jq program that holds a file name such as `deny-env-dump.sh` in a string literal. Evidence: the advisor's `prd.json` conversion command was denied in this task. Outcome: proposed issue, not created.
4. Claim: the worker brief named `npm ci` for the root, and the root uses pnpm. Evidence: US-001 and US-002 worker reports. Outcome: dropped, because the observation is about process and the advisor reran each check on the task branch.
