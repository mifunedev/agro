# PRD: Retire agro node into agro hands

Status: DRAFT

## User Stories

### US-001: Console hands accept operator authority and a per-call provider

**Description:** As an operator on a host without a brain token, I want `agro hands` to use my `agro auth login` credentials and to accept `--provider console|exedev`. Then I can manage console VMs on any host without `agro node`.

**Acceptance Criteria:**

- [ ] `agro hands` accepts `--provider console` and `--provider exedev` (also `--provider=<id>`) before or after the verb, and the flag overrides `hands.provider` in the host config.
- [ ] `agro hands list --provider desktop` exits 1 with an error that names `console` and `exedev`.
- [ ] For the console provider, the token source order is `AGRO_CONSOLE_TOKEN`, then the brain token file, then the credentials file that `agro auth login` writes. The URL order is `AGRO_CONSOLE_URL`, then the brain console URL file when the brain token file supplies the token, then the credentials file URL, then `https://console.mifune.dev`.
- [ ] With no token from any source, a console verb exits 2. The message names the brain token path and `agro auth login`.
- [ ] Tests in `.agro/cli/src/commands/__tests__/hands.test.ts` cover each source order row, the missing-token exit 2, and the `--provider` override of a host config that selects `exedev`.
- [ ] `agro run -- pnpm typecheck` exits 0 and `agro run -- pnpm test` exits 0.

### US-002: Console hands create, list, and destroy cover the node flags

**Description:** As an operator, I want `agro hands create` to take `--profile`, `--docker`, `--t3`, `--code-server`, `--ssh-key`, and `--json` for console hands so that every `agro node create` request has a hands form.

**Acceptance Criteria:**

- [ ] `agro hands create` accepts `--profile agro|sandbox` (default `sandbox`), `--docker`, `--t3`, `--code-server`, repeatable `--ssh-key <uuid>`, and `--json`. Each app flag without `--profile agro` exits 1 with `<flag> requires --profile agro`.
- [ ] The create request body sends `profile`, `docker: true`, `t3: true`, `runtimeSettings: { codeServerEnabled: true }`, and `sshKeyIds` exactly as `agro node create` sent them on `ef52a983`.
- [ ] Without `--ssh-key` and without a brain token file, `create` finds `~/.ssh/id_ed25519.pub` in `GET /api/ssh-keys` or registers it with `POST /api/ssh-keys`. Then `create` sends the key id. On a brain, `create` sends `sshKeyIds` only for `--ssh-key`.
- [ ] HTTP 422 `DISPOSABLE_PROFILE_UNSUPPORTED` prints `only a sandbox node can be disposable: drop --disposable, or use --profile sandbox`.
- [ ] `create --json` prints one JSON line with `id`, `index`, `alias`, `name`, `status`, `spec`, `sshHost`, and `ssh`. The `ssh` field holds `ssh sandbox@<sshHost>` or `null`. When the console returns a node id and the wait then fails or times out, `create --json` prints that line before it exits 1.
- [ ] Console `list --json` rows add `name` and `profile`.
- [ ] Console `destroy` prints `destroy needs the admin role in agro-console` when the console returns HTTP 403.
- [ ] With the exedev provider, `--profile`, `--docker`, `--t3`, `--code-server`, and `--ssh-key` exit 1 before any `ssh exe.dev` call. The refusal says that the flag applies only to console hands.
- [ ] Tests in `.agro/cli/src/commands/__tests__/hands.test.ts` cover each row above. The ported cases from `.agro/cli/src/__tests__/node.test.ts` for profile flags, SSH key resolution, and `--json` pass against `runHands`.
- [ ] `agro run -- pnpm typecheck` exits 0 and `agro run -- pnpm test` exits 0.

### US-003: Add agro hands check

**Description:** As an operator, I want `agro hands check [--ssh-key <uuid>]...` so that the validation preflight keeps a GET-only check of the SSH key, the free tier, and the credit.

**Acceptance Criteria:**

- [ ] `HANDS_VERBS` in `.agro/cli/src/command-table.ts` includes `check`.
- [ ] For the console provider, `agro hands check` sends only `GET` requests. It prints the same `ok`, `warn`, and `fail` lines as `agro node check` on `ef52a983`, with `agro hands check` in place of `agro node check`.
- [ ] `agro hands check` exits 0 only when no line starts with `fail `.
- [ ] With the exedev provider, `agro hands check` exits 1 with `check applies only to console hands`.
- [ ] Each `agro node check` case of `.agro/cli/src/__tests__/node.test.ts` passes as a `runHands(["check", ...])` case in `.agro/cli/src/commands/__tests__/hands.test.ts`.
- [ ] `agro run -- pnpm typecheck` exits 0 and `agro run -- pnpm test` exits 0.

### US-004: Remove agro node

**Description:** As a maintainer, I want `agro node` gone from the CLI so that one command creates, lists, and deletes console VMs.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/commands/node.ts` and `.agro/cli/src/__tests__/node.test.ts` do not exist.
- [ ] `NODE_VERBS` and the `node` entry of `AGRO_COMMANDS` do not exist, and `.agro/cli/src/cli.ts` has no `runNode` import, no `node` dispatch, and no `node` help line.
- [ ] `agro node list` exits non-zero through the unknown-command path of `.agro/cli/src/cli.ts`.
- [ ] `.agro/cli/src/lib/console-api.ts` keeps each export that a remaining module imports, and `git grep -n "commands/node" -- .agro/cli` prints nothing.
- [ ] `agro run -- pnpm typecheck` exits 0 and `agro run -- pnpm test` exits 0.

### US-005: Move the validation console adapter to agro hands

**Description:** As a validation operator, I want `.agro/skills/sandbox/adapters/console.sh` to call `agro hands --provider console` so that the console matrix runs after `agro node` is gone, on a host whose config selects exedev.

**Acceptance Criteria:**

- [ ] `.agro/skills/sandbox/adapters/console.sh` calls `agro hands check --provider console`, `agro hands create --provider console --spec ... --name ... --json`, `agro hands list --provider console --json`, and `agro hands destroy --provider console <id> --yes`, and contains no `agro node`.
- [ ] `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` stubs the `hands` verbs and asserts the new call lines. Each existing console case keeps its intent: preflight key flag, stop before create on a failed check, the HTTP 409 destroy retry, and the `agro-mx-` count.
- [ ] `agro run -- pnpm test` exits 0.

### US-006: Update docs, skills, glossary, and changelog

**Description:** As a reader, I want the docs, the sandbox skill references, and the `AGENTS.md` glossary to name `agro hands` for console VMs. Then no instruction points at a removed command.

**Acceptance Criteria:**

- [ ] `git grep -n "agro node" -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints nothing.
- [ ] The hands section of `docs/lifecycle-commands.md` documents `--provider`, the operator token fallback, the new create flags, `create --json`, and `check`. The file has no `agro node` section or table row.
- [ ] The `AGENTS.md` glossary entry **console node** names `agro hands` with the console provider and operator authority.
- [ ] `.agro/skills/sandbox/references/hands.md`, `providers.md`, and `validation.md` name the hands equivalents of each removed `agro node` call.
- [ ] `CHANGELOG.md` `## [Unreleased]` records the removal of `agro node`. It also records the new `agro hands` flags and the `check` verb.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file, except for findings that exist on `origin/development` in unchanged lines.
- [ ] `agro run -- pnpm test` exits 0, except the sandbox routing replay that US-007 records again.

### US-007: Record the sandbox routing replay again

**Description:** As a maintainer, I want `decisions.json` recorded against the final instruction files so that the routing replay test proves the edited references route each case.

**Acceptance Criteria:**

- [ ] The advisor runs one fresh decision-only agent for each case R1 to R17 against the final instruction files. Each decision matches its oracle in `cases.json`.
- [ ] The provenance in `decisions.json` equals `sourceProvenance()` on the final branch head. `.agro/scripts/__tests__/helpers/sandbox-routing.ts` defines `sourceProvenance()`.
- [ ] `agro run -- pnpm test` exits 0.

### US-008: Capture manual review evidence

**Description:** As a reviewer, I want a command transcript of the hands console flow and the removed node command. Then I can accept the change without a live console spend.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-agro-node/evidence/manual-review.md` holds a transcript of the built CLI entry point. The transcript runs `agro node list` and `agro hands --help`. With `--provider console`, it runs `agro hands check`, `create --profile agro --t3 --json`, `list --json`, and `destroy --yes`.
- [ ] The console calls go to a local stub HTTP server on a free port. The transcript sets `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL` inline, under a new temp `HOME` with no credentials file. The transcript creates no live console resource.
- [ ] The story stops the stub server. The story then deletes the temp `HOME` and reports.

## Summary

`agro node` (`.agro/cli/src/commands/node.ts`) and the console provider of `agro hands` (`.agro/cli/src/lib/hands/console-provider.ts`) both call `POST /api/nodes`, `GET /api/nodes`, and `DELETE /api/nodes/<id>` through `.agro/cli/src/lib/console-api.ts`. This task removes `agro node` and moves each capability that only `agro node` has into `agro hands`.

Gap list. These `agro node` capabilities have no `agro hands` equivalent on `11e1b35b`:

| `agro node` capability | `agro hands` home |
|---|---|
| Operator credentials from `agro auth login` (hands exits 2 without `~/.agro/brain-token`) | US-001: token fallback to the credentials file |
| Per-call provider (this brain host config sets `hands.provider` to `exedev`) | US-001: `--provider console\|exedev` |
| `create --profile agro\|sandbox` | US-002 |
| `create --docker`, `--t3`, `--code-server` | US-002 |
| `create --ssh-key <uuid>`... and the `~/.ssh/id_ed25519.pub` registration | US-002 |
| `create --json` with the node id on a failed wait | US-002 |
| `list --json` fields `name` and `profile` | US-002 |
| `delete` HTTP 403 admin hint | US-002, on `destroy` |
| `check [--ssh-key <uuid>]...` | US-003 |

These capabilities already exist: `create --spec`, `--name`, `--disposable`, `list --json`, and `delete <id> --yes` as `destroy <uuid> --yes`. Every gap has a hands home, so the task is not blocked.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/hands.ts` | `runHands`, `parseCreate`, `runList`, `runDestroy`, `handsHelp` | Verb parse, provider choice, output |
| `.agro/cli/src/lib/hands/console-provider.ts` | `createConsoleProvider`, `toHand` | Console create body, list rows, destroy errors |
| `.agro/cli/src/lib/hands/provider.ts` | `HandRequest`, `Hand`, `resolveHandProviderId` | Shared request and row types, provider choice |
| `.agro/cli/src/lib/console-api.ts` | `resolveBrainConsoleConfig`, `resolveConsoleConfig` | Token and URL source order |
| `.agro/cli/src/command-table.ts` | `HANDS_VERBS`, `NODE_VERBS`, `AGRO_COMMANDS` | Verb registry |
| `.agro/cli/src/cli.ts` | `runNode` dispatch, top-level help | Command registration |
| `.agro/cli/src/commands/node.ts` | `runCheck`, `resolveSshKeyId`, `parseCreate` | Source of the moved behavior, then deleted |
| `.agro/skills/sandbox/adapters/console.sh` | `console_preflight`, `console_create`, `console_status`, `console_destroy`, `console_list` | Validation adapter |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | console cases | Adapter stubs |
| `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` | provenance, decisions | Routing replay |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro node` | Removed | The command and its help line go away |
| `agro hands --provider` | Added | Per-call provider override |
| `agro hands create` | Added flags | `--profile`, `--docker`, `--t3`, `--code-server`, `--ssh-key`, `--json` (console only) |
| `agro hands check` | Added verb | GET-only preflight (console only) |
| `agro hands list --json` | Added fields | `name`, `profile` on console rows |
| Console token sources | Extended | Fallback to the `agro auth login` credentials file |
| `AGENTS.md` glossary | Changed | **console node** names `agro hands` |

## Storage
N/A. The task reads the existing credentials file, brain token file, and host config. It writes no new state.

## Architectural Decisions
- One command manages console VMs: `agro hands`. `lib/console-api.ts` stays the single console HTTP client.
- Authority comes from the token source. A brain token file means brain authority. The `agro auth login` credentials file means operator authority. `AGRO_CONSOLE_TOKEN` overrides both.
- SSH key registration runs only without a brain token file, because a brain hand uses the brain key path that `agro hands` uses today.
- `--provider` overrides the host config for one call. The host config stays the default.
- Console-only flags refuse on the exedev provider, like `--spec` and `--disposable` do today.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/commands/__tests__/hands.test.ts` | token source order, missing token exit 2, `--provider` override | US-001 |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | profile and app flags, SSH key resolution, 422 disposable line, `--json` on success and failure, list fields, 403 destroy | US-002 |
| `.agro/cli/src/commands/__tests__/hands-exedev.test.ts` | console-only flag refusals and `check` refusal | US-002, US-003 |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | ported `agro node check` cases | US-003 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | docs name only real commands | US-004, US-006 |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | console adapter call lines | US-005 |
| `.agro/scripts/__tests__/sandbox-routing*.test.ts` | replay provenance and oracle match | US-007 |

## Design Principles
- Delete the duplicate path. Do not keep `agro node` as an alias.
- Add only the hands flags that a removed node capability needs.
- No explanatory comments in tracked code. Prose follows `/ste`.

## Out of Scope
- Changes to the exedev provider beyond the console-only refusals.
- Changes to `fork`, `pause`, `resume`, `exec`, or `fetch`.
- Any live console resource. The manual review uses a local stub server.

## Open Questions
None

## Acceptance Criteria
- [ ] `git grep -n "agro node" -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints nothing.
- [ ] Each row of the Summary gap list has a passing test in the story that owns the row.
- [ ] `agro run -- pnpm typecheck` exits 0 and `agro run -- pnpm test` exits 0 on the final branch head.
- [ ] CI is green on the PR.

## Lessons
