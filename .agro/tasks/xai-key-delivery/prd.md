# PRD: XAI_API_KEY delivery

Status: DRAFT

## User Stories

### US-001: Pass `XAI_API_KEY` through Compose

**Description:** As the operator, I want `agro secret set XAI_API_KEY` to reach the sandbox environment so that the Grok Build CLI can use the key.

**Acceptance Criteria:**

- [ ] `.devcontainer/docker-compose.yml` passes `XAI_API_KEY=${XAI_API_KEY:-}` in the `environment:` list of the sandbox service.
- [ ] `COMPOSE_SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` holds `XAI_API_KEY`, and the parity test in `.agro/cli/src/lib/__tests__/secrets.test.ts` passes.
- [ ] With `--sandbox <name>`, `runSecretSet` exits 0 for `XAI_API_KEY`, and a test covers the case.
- [ ] `docs/configuration.md` lists `XAI_API_KEY` among the keys that `--sandbox` accepts, and states that no container process reads `META_API_KEY` from a `.env` file.
- [ ] `CHANGELOG.md` has one `### Fixed` entry under `## [Unreleased]` that links #1410.
- [ ] `npx vitest run .agro/cli/src/lib/__tests__/secrets.test.ts .agro/cli/src/__tests__/config-secret.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.

### US-002: Record manual review evidence

**Description:** As the advisor, I want a transcript so that the PR shows the changed behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/xai-key-delivery/evidence/manual-review.md` holds the output and exit code of `printf '%s\n' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set XAI_API_KEY --sandbox review-box` in a temporary `AGRO_HOME`, and that exit code is 0.
- [ ] The file holds the output of `docker compose -f .devcontainer/docker-compose.yml config` with `XAI_API_KEY=dummy-not-a-secret` in the environment, trimmed to the `XAI_API_KEY` line, or the reason that the command cannot run.
- [ ] The transcript holds no real secret value.
- [ ] The story deletes each temporary directory that it creates.

## Summary

`XAI_API_KEY` is in `SECRET_KEYS`. `.agro/install/banner.sh:123` reads the key from the environment. `.example.env` states that the key passes through for non-interactive use. `.devcontainer/docker-compose.yml` does not pass the key, so the key has no delivery path. Since #1408, `agro secret set XAI_API_KEY --sandbox <name>` exits 1. This plan adds the key to the Compose `environment:` list. This branch stacks on #1408, because #1408 adds `COMPOSE_SECRET_KEYS`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/docker-compose.yml` | `environment:` | Keys that reach the container |
| `.agro/cli/src/lib/secrets.ts` | `COMPOSE_SECRET_KEYS` | Keys that `--sandbox` accepts |
| `.agro/install/banner.sh` | `XAI_API_KEY` check | Consumer |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set XAI_API_KEY --sandbox <name>` | Behavior | Exits 0 |
| Sandbox environment | Behavior | Holds `XAI_API_KEY` when the key has a value |

## Storage

N/A. The change adds no storage.

## Architectural Decisions

- Compose passes the key, like `GH_TOKEN` and `TYPESAFE_API_KEY`. The parity test keeps `COMPOSE_SECRET_KEYS` equal to the Compose list.
- `META_API_KEY` stays unexported. `docs/configuration.md` already documents that rule.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | parity holds with `XAI_API_KEY` | US-001 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `--sandbox` accepts `XAI_API_KEY` | US-001 |

## Design Principles

- Keep one source of truth for the keys that reach the container.
- Add no comments to tracked code.

## Out of Scope

- `META_API_KEY` delivery.
- A live sandbox restart.

## Open Questions

None.

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `npm run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
