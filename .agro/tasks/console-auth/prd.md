# PRD: agro auth for agro-console

Status: DRAFT

## User Stories

### US-001: Store device authorizations in agro-console

**Description:** As the console maintainer, I want a table for pending CLI device authorizations so that the device flow keeps its state on the server.

**Acceptance Criteria:**

- [ ] The migration `packages/db/migrations/0054_cli_device_auth` creates the table `cli_device_authorizations`.
- [ ] The table holds the device-code hash, the user code, the client host name, the status, the approving user, the org, the minted token ID, the last poll time `last_polled_at`, the creation time, and the expiry time.
- [ ] The status column accepts only `pending`, `approved`, `denied`, and `consumed`.
- [ ] The table stores the SHA-256 hash of the device code and never the device code itself.
- [ ] `packages/db/src/repositories/cli-device-auth.repository.ts` exports create, find-by-user-code, find-by-device-code-hash, approve, deny, and consume functions.
- [ ] `packages/shared/src/models/cli-device-auth.ts` holds the zod models for the rows and the request bodies.
- [ ] `pnpm test` in `mifunedev/agro-console` exits 0, and the layering test includes the new files.

### US-002: Add the device-flow API to agro-console

**Description:** As the agro CLI, I want endpoints that start a device authorization and return a token after approval. A headless host then signs in without a copied token.

**Acceptance Criteria:**

- [ ] `POST /api/cli/device` accepts `{ "clientName": "<string>" }` without authentication.
- [ ] `POST /api/cli/device` returns `device_code`, `user_code`, `verification_uri`, `expires_in`, and `interval`.
- [ ] `interval` is `5`, the default interval of RFC 8628.
- [ ] `expires_in` is `900`. A row expires 900 seconds after its creation.
- [ ] Each `user_code` holds 8 letters from the alphabet `BCDFGHJKLMNPQRSTVWXZ`, printed as two groups of 4 with a `-` between them.
- [ ] A poll that arrives less than `interval` seconds after the previous poll of the same device code returns HTTP 400 with the code `slow_down`. Each poll writes `last_polled_at`.
- [ ] `POST /api/cli/device/token` with a pending device code returns HTTP 400 with the code `authorization_pending`.
- [ ] `POST /api/cli/device/token` with a denied device code returns HTTP 400 with the code `access_denied`.
- [ ] `POST /api/cli/device/token` with an expired device code returns HTTP 400 with the code `expired_token`.
- [ ] `POST /api/cli/device/token` with an approved device code mints a token with `createApiToken`, then returns the token, the token ID, the token prefix, and the console login.
- [ ] The minted token has the name `agro-cli@<clientName>`, the approving user, and the org that the approval recorded.
- [ ] The poll changes the row from `approved` to `consumed` with a conditional update before the mint. Two concurrent polls mint at most one token.
- [ ] After the first successful token response, the row has the status `consumed`. A second request with the same device code returns HTTP 400 with the code `expired_token`.
- [ ] The routes, the controller, and the service follow the five layers in `AGENTS.md` of `mifunedev/agro-console`.
- [ ] A red test for each response code exists before the implementation. `pnpm test` exits 0 after the implementation.

### US-003: Add the device approval page to agro-console

**Description:** As an operator, I want a console page where I enter the user code and approve the CLI. The console then mints a token for that host.

**Acceptance Criteria:**

- [ ] The page `/device` requires a signed-in session. The existing `apps/web/middleware.ts` matcher already covers `/device`.
- [ ] The page accepts a user code, then shows the client host name and the active org.
- [ ] The page shows Approve and Deny buttons.
- [ ] Approve records the approving user and the active org, then marks the row `approved`. Approve mints no token.
- [ ] Deny marks the row `denied`. A denied row mints no token.
- [ ] A user code that is unknown, expired, or not `pending` shows an error message and mints no token.
- [ ] Only a caller with the role `operator` or higher can approve.
- [ ] After the CLI poll succeeds, the new token appears on the existing `/tokens` page with the name `agro-cli@<clientName>`.
- [ ] Verify in browser using agent-browser skill.

### US-004: Add token identity and self-revoke to agro-console

**Description:** As the agro CLI, I want to read the identity of my token and revoke my own token. Then `agro auth status` and `agro auth logout` work without a browser session.

**Acceptance Criteria:**

- [ ] `GET /api/me` with a valid bearer token returns `login`, `role`, `orgId`, `via`, `tokenId`, and `tokenPrefix`.
- [ ] `GET /api/me` with a signed-in session returns `login`, `role`, `orgId`, and `via`. The values of `tokenId` and `tokenPrefix` are `null`.
- [ ] `GET /api/me` without credentials returns HTTP 401.
- [ ] `DELETE /api/me/token` with a valid bearer token revokes that token and returns HTTP 200.
- [ ] After `DELETE /api/me/token`, a request with the same token returns HTTP 401.
- [ ] `DELETE /api/me/token` with a session returns HTTP 400 and revokes no token.
- [ ] `pnpm test` in `mifunedev/agro-console` exits 0.

### US-005: Store the console token per user in the agro CLI

**Description:** As an operator, I want the agro CLI to keep the console token in my user config. The project `.env` then holds no token that agents in the sandbox can read.

**Acceptance Criteria:**

- [ ] A new module `.agro/cli/src/lib/console-auth.ts` reads, writes, and deletes `$XDG_CONFIG_HOME/agro/console.json`. When `XDG_CONFIG_HOME` is unset, the path is `~/.config/agro/console.json`.
- [ ] The file holds `url`, `token`, `tokenId`, `tokenPrefix`, and `login`.
- [ ] The module writes the file with mode `0600` and creates the directory with mode `0700`.
- [ ] `resolveConsoleConfig` in `.agro/cli/src/commands/node.ts` reads `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL` from the environment first, then from the user credentials file.
- [ ] `resolveConsoleConfig` no longer reads the project `.env`.
- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` no longer holds `AGRO_CONSOLE_URL` or `AGRO_CONSOLE_TOKEN`.
- [ ] `agro secret set AGRO_CONSOLE_TOKEN` exits 1 with the existing unknown-key error.
- [ ] When no token resolves, each `agro node` verb exits 1 and prints `not logged in to agro-console: run agro auth login`.
- [ ] `npm test` at the repository root exits 0. `npm run typecheck` in `.agro/cli` exits 0.

### US-006: Add the agro auth verbs

**Description:** As an operator, I want `agro auth login`, `agro auth status`, `agro auth logout`, and `agro auth token` so that I manage the console sign-in from the CLI.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/command-table.ts` holds `AUTH_VERBS` with `login`, `status`, `logout`, and `token`.
- [ ] `.agro/cli/src/cli.ts` sends `agro auth` to `.agro/cli/src/commands/auth.ts`, and the top-level help lists `agro auth`.
- [ ] `agro auth login` calls `POST /api/cli/device` with the host name of the machine, then prints the verification URI and the user code.
- [ ] `agro auth login` polls `POST /api/cli/device/token` at the returned `interval` until the code is approved, denied, or expired.
- [ ] After approval, `agro auth login` writes the credentials file, prints `logged in to <url> as <login>`, and exits 0.
- [ ] After a denial or an expiry, `agro auth login` writes no file and exits 1.
- [ ] `agro auth login --url <url>` stores `<url>` in the credentials file. Without `--url`, the CLI uses `AGRO_CONSOLE_URL`, then `https://console.mifune.dev`.
- [ ] `agro auth status` calls `GET /api/me`, then prints the URL, the login, the role, the org, the token source (`env` or `file`), and the token prefix. The command never prints the full token.
- [ ] `agro auth status` exits 1 when no token resolves or when `GET /api/me` returns HTTP 401.
- [ ] `agro auth logout` calls `DELETE /api/me/token`, then deletes the credentials file and exits 0.
- [ ] When the token comes from `AGRO_CONSOLE_TOKEN`, `agro auth logout` exits 1 and prints `token comes from AGRO_CONSOLE_TOKEN; unset it to log out`.
- [ ] `agro auth token` prints the resolved token on stdout and exits 0. It exits 1 when no token resolves.
- [ ] `.agro/cli/src/__tests__/auth.test.ts` covers each verb with a fake `fetch`, and `npm test` at the repository root exits 0.

### US-007: Register the SSH key in agro node create

**Description:** As an operator, I want `agro node create` to find or register my SSH key so that I do not look up a key UUID.

**Acceptance Criteria:**

- [ ] `--ssh-key <uuid>` stays optional. When the operator gives one or more `--ssh-key` flags, the command uses only those keys.
- [ ] When the operator gives no `--ssh-key`, the command reads `~/.ssh/id_ed25519.pub`.
- [ ] When `~/.ssh/id_ed25519.pub` does not exist, the command exits 1 and prints `no --ssh-key given and ~/.ssh/id_ed25519.pub not found`.
- [ ] The command calls `GET /api/ssh-keys` and reuses a key whose key type and base64 body match the local key.
- [ ] When no key matches, the command calls `POST /api/ssh-keys` with the name `agro-cli@<hostname>` and the local public key.
- [ ] The command sends the found or registered key ID in `sshKeyIds`.
- [ ] `.agro/cli/src/__tests__/node.test.ts` covers the reuse case, the register case, and the missing-file case. `npm test` at the repository root exits 0.

### US-008: Update the docs and the remote-sandbox skill

**Description:** As an operator, I want the docs and the remote-sandbox skill to describe `agro auth` so that the written procedure matches the CLI.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` has a section for `agro auth` with the four verbs.
- [ ] `docs/lifecycle-commands.md` no longer tells the operator to run `agro secret set AGRO_CONSOLE_TOKEN`.
- [ ] The `agro node create` usage in `docs/lifecycle-commands.md` and in `nodeHelp` shows `--ssh-key` as optional.
- [ ] `.agro/skills/remote-sandbox/adapters/console.sh` passes `--ssh-key` only when `CONSOLE_SSH_KEY_ID` is set.
- [ ] `.agro/skills/remote-sandbox/SKILL.md` and `.agro/skills/remote-sandbox/references/providers.md` show `agro auth login` as the sign-in step and show `CONSOLE_SSH_KEY_ID` as optional.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` that states the removal of the `.env` token lookup and the new `agro auth login` step.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 for each changed Markdown file.
- [ ] `npm test` at the repository root exits 0, including `.agro/cli/src/__tests__/docs-reference.test.ts`.

### US-009: Record the manual review evidence

**Description:** As the advisor, I want a transcript of the full sign-in journey. The PR then shows the behavior, not only the tests.

**Acceptance Criteria:**

- [ ] Part 1 runs against a local console dev server with the existing dev sign-in in `apps/web/lib/dev-login.ts`.
- [ ] `.agro/tasks/console-auth/evidence/manual-review.md` holds the part 1 transcript of `agro auth login --url <local console URL>`, the browser approval, `agro auth status`, and `agro auth token | cut -c1-12`.
- [ ] The part 1 transcript holds agent-browser screenshots of the `/device` page before and after approval.
- [ ] The part 1 transcript shows `agro auth logout`, then `agro auth status` with exit code 1.
- [ ] Part 2 starts only after the console PR deploys to `https://console.mifune.dev` and the operator approves the run.
- [ ] The part 2 transcript shows `agro auth login`, then `agro node create --free-tier` with no `--ssh-key` and no `CONSOLE_SSH_KEY_ID`, then `agro node list`, then `agro node delete <id> --yes`.
- [ ] `agro node list` at the end of part 2 shows no live node from the review.
- [ ] Neither transcript holds a full token value.

## Summary

Today each `agro node` verb reads `AGRO_CONSOLE_TOKEN` from the environment, then from the project `.env` (`resolveConsoleConfig` in `.agro/cli/src/commands/node.ts`). The operator mints the token by hand in the console, because `POST /api/tokens` accepts only a browser session (`TOKENS_SESSION_ONLY` in `apps/web/lib/tokens-api.ts` of `mifunedev/agro-console`). The project `.env` sits in the workspace, so the sandbox can read the token. `agro node create` also requires `--ssh-key <uuid>`, so the operator registers a key in the console UI and copies the UUID.

The selected approach has three parts:

1. agro-console gets an RFC 8628 device-authorization flow, a `/device` approval page, `GET /api/me`, and `DELETE /api/me/token`.
2. The agro CLI gets `agro auth login|status|logout|token` and stores the token at `~/.config/agro/console.json`. The `.env` lookup goes away. The env var `AGRO_CONSOLE_TOKEN` stays for CI and for the remote-sandbox driver.
3. `agro node create` finds or registers `~/.ssh/id_ed25519.pub` when the operator gives no `--ssh-key`. `GET /api/ssh-keys` and `POST /api/ssh-keys` already accept a bearer token with the role `operator` (`apps/web/lib/ssh-keys-api.ts`).

The work spans two repositories and ships as two PRs from this one plan. US-001 to US-004 change `mifunedev/agro-console`. That PR merges and deploys first. US-005 to US-008 change `mifunedev/agro`. That PR stays draft until the console endpoints are live. The CLI tests use a fake `fetch`, so the deploy order does not block them.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/node.ts` | `resolveConsoleConfig`, `readProjectSecret`, `CONSOLE_CONFIG_MISSING`, `parseCreate`, `runCreate`, `callApi`, `nodeHelp` | Token lookup, create flags, API client |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Remove the two console keys |
| `.agro/cli/src/command-table.ts` | `NODE_VERBS`, new `AUTH_VERBS` | Verb table |
| `.agro/cli/src/cli.ts` | top-level help, dispatch near `first === "node"` | Route `agro auth` |
| `.agro/cli/src/commands/auth.ts` | new `runAuth` | The four auth verbs |
| `.agro/cli/src/lib/console-auth.ts` | new read, write, delete functions | User credentials file |
| `.agro/skills/remote-sandbox/adapters/console.sh` | `console_env`, `console_create` | Make `CONSOLE_SSH_KEY_ID` optional |
| agro-console `apps/web/lib/auth.ts` | `requireRole`, token branch with `via: "token"` | Caller identity for `/api/me` |
| agro-console `apps/web/lib/tokens-api.ts` | `createTokenHandler`, `requireSessionOperator` | Pattern for the token mint |
| agro-console `apps/web/lib/api-tokens.ts` | `generateToken`, `hashToken`, `formatPrefix` | Token creation helpers |
| agro-console `packages/db/src/index.ts` | `createApiToken`, `revokeApiToken` | Token persistence |
| agro-console `apps/web/middleware.ts` | `config.matcher` | Leaves `/api` public and covers `/device` with the session gate |
| agro-console `scripts/layering.test.mjs` | `RULES`, `LEGACY` | Layer contract for new files |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro auth login [--url <url>]` | New CLI verb | Device-code sign-in |
| `agro auth status` | New CLI verb | Identity check against `GET /api/me` |
| `agro auth logout` | New CLI verb | Server revoke, then file delete |
| `agro auth token` | New CLI verb | Print the resolved token |
| `agro node create` | Changed CLI flag | `--ssh-key` becomes optional |
| `agro secret set AGRO_CONSOLE_TOKEN` | Removed | The key leaves the allowlist |
| `POST /api/cli/device` | New API | Start a device authorization |
| `POST /api/cli/device/token` | New API | Poll for the token |
| `GET /api/me` | New API | Caller identity |
| `DELETE /api/me/token` | New API | Revoke the calling token |
| `/device` | New console page | Approve or deny a user code |

## Storage

- agro-console: a new Postgres table `cli_device_authorizations` in migration `0054_cli_device_auth`. Follow the pattern of the existing migrations in `packages/db/migrations/` and the repository pattern in `packages/db/src/repositories/`.
- agro CLI: the JSON file `~/.config/agro/console.json` on the host that runs the CLI. Mode `0600`. One console URL and one token per user.
- The minted token uses the existing API-token table through `createApiToken`. No change to that table.

## Architectural Decisions

- The device code is the only secret that the unauthenticated poll endpoint accepts. The server stores only its SHA-256 hash.
- The console adds no general rate limiter. The user-code entropy, the session requirement on `/device`, and the per-code `slow_down` response limit abuse.
- The approval records the approving user and the active org of that session. The poll mints the token for that user and org. The server never stores the raw token, so the mint cannot happen at approval time.
- The poll endpoint returns the token one time. After that, the row is `consumed`.
- The CLI resolves the token in this order: `AGRO_CONSOLE_TOKEN`, then the user credentials file. No other source exists.
- The credentials file lives outside every workspace, so a sandbox mount of the project never exposes the token.
- `agro auth` owns sign-in only. SSH-key registration stays in `agro node create`, because the key belongs to the host that opens the SSH connection.
- `agro node delete` still needs the admin role. This task does not change roles.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| agro-console `packages/db/src/__tests__/migrations.test.ts` | table, status check, hash column | US-001 |
| agro-console `apps/web/server/controllers/__tests__/cli-device.controller.test.ts` | pending, denied, expired, approved, consumed, `slow_down` | US-002 |
| agro-console `apps/web/server/services/__tests__/cli-device.service.test.ts` | approve, deny, unknown code, non-pending code, role below `operator` | US-002, US-003 |
| agro-console `apps/web/server/controllers/__tests__/me.controller.test.ts` | token caller, session caller, no caller, self-revoke, session revoke refusal | US-004 |
| `.agro/cli/src/lib/__tests__/console-auth.test.ts` | path with and without `XDG_CONFIG_HOME`, file mode `0600`, delete | US-005 |
| `.agro/cli/src/__tests__/node.test.ts` | env before file, no `.env` lookup, not-logged-in message, SSH key reuse, register, missing file | US-005, US-007 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `AGRO_CONSOLE_TOKEN` rejected | US-005 |
| `.agro/cli/src/__tests__/auth.test.ts` | login approved, denied, expired; status ok and 401; logout file and env; token | US-006 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | `agro auth` in the docs | US-008 |

Commands: `npm test` and `npm run typecheck --prefix .agro/cli` in `mifunedev/agro`. `pnpm test` in `mifunedev/agro-console`.

## Design Principles

- Keep one source of truth for the token on each host: the env var for automation, the credentials file for people.
- Delete the `.env` path. Do not keep a warning shim.
- Match `gh auth` names, so that the verbs need no explanation.
- Write no comments in tracked code. Express intent through names and tests.
- Follow the five layers of `mifunedev/agro-console`. Add no new legacy handler.

## Out of Scope

- Snapshot verbs and node lifecycle verbs (`pause`, `resume`, `restart`).
- `agro key` verbs for SSH keys.
- `agro auth login --with-token`.
- More than one console profile.
- Token expiry and refresh.
- Changes to the admin requirement of `agro node delete`.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each story in this plan has `passes: true` in `.agro/tasks/console-auth/prd.json`.
- [ ] A fresh host reaches a running node with `agro auth login`, then `agro node create --free-tier`, and with no other setup step.
- [ ] No code path in `.agro/cli/src` reads `AGRO_CONSOLE_TOKEN` from a project `.env`.
- [ ] `npm test` in `mifunedev/agro` and `pnpm test` in `mifunedev/agro-console` exit 0.

## Lessons

Filled by the advisor before undraft.
