# PRD: agro node create takes --profile, --docker, --t3, and --code-server

Status: DRAFT

## User Stories

### US-001: Parse and send the profile and app flags in agro node create

**Description:** As an operator, I want `agro node create` to accept `--profile agro|sandbox`, `--docker`, `--t3`, and `--code-server` so that I can create an agro-profile node from the CLI.

**Acceptance Criteria:**

- [ ] Before the change, a new test in `.agro/cli/src/__tests__/node.test.ts` for `create --profile agro` fails (red).
- [ ] `create --spec n4 --ssh-key key-1` with no new flag posts the body `{ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] }`, with no `docker`, `t3`, or `runtimeSettings` key.
- [ ] `create --profile agro --spec n4 --ssh-key key-1` posts `profile: "agro"` with no `docker`, `t3`, or `runtimeSettings` key.
- [ ] `create --profile=agro` (inline form) posts `profile: "agro"`.
- [ ] `create --profile agro --docker --t3 --code-server` posts `docker: true`, `t3: true`, and `runtimeSettings: { codeServerEnabled: true }`.
- [ ] Each of `--docker`, `--t3`, and `--code-server` alone with `--profile agro` posts only its own field.
- [ ] `create --profile desktop` exits 1, prints `--profile must be agro or sandbox` to stderr, and makes no API call.
- [ ] `create --profile` with no value exits 1, prints `--profile requires a value`, and makes no API call.
- [ ] With the profile `sandbox`, explicit or default, each of `--docker`, `--t3`, and `--code-server` exits 1, prints `<flag> requires --profile agro`, and makes no API call.
- [ ] When the console returns HTTP 422 with the code `RUNTIME_SETTINGS_DISABLED`, the command exits 1 and prints `HTTP 422 RUNTIME_SETTINGS_DISABLED: Runtime settings are disabled`.
- [ ] `nodeHelp` shows the usage line `node create --spec <spec> [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--ssh-key <uuid>]... [--name <name>] [--free-tier] [--json]` and one sentence for each new flag.
- [ ] `npx vitest run .agro/cli/src/__tests__/node.test.ts` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Document the new create flags

**Description:** As an operator, I want `docs/lifecycle-commands.md` to describe the new flags so that the documentation matches the CLI.

**Acceptance Criteria:**

- [ ] The verb table row for `agro node create` in `docs/lifecycle-commands.md` shows the same usage line as `nodeHelp`.
- [ ] The `## Remote console nodes: agro node` section states that the profile is `sandbox` by default and that `--profile agro` creates an agro-profile node.
- [ ] The section states that `--docker`, `--t3`, and `--code-server` require `--profile agro`, and that an omitted flag lets the console default apply: Docker on, T3 off, code-server off.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` reports no finding on a changed line.

### US-003: Record the manual review transcript

**Description:** As the advisor, I want a command transcript of the new behavior so that the PR `## Manual review` section has evidence.

**Acceptance Criteria:**

- [ ] `.agro/tasks/node-create-profile-flags/evidence/manual-review.md` holds the output of `node .agro/cli/dist/agro.js node --help` after `npm --prefix .agro/cli run build`, with the new usage line.
- [ ] The transcript holds the stderr and exit code of `create --profile desktop` and of `create --t3` with the default profile. Each command runs with `AGRO_CONSOLE_TOKEN=dummy AGRO_CONSOLE_URL=http://127.0.0.1:9`. Each command exits 1 with the flag error and makes no API call.
- [ ] The transcript holds the posted request bodies from the stubbed test run for `--profile agro --docker --t3 --code-server` and for the default profile.
- [ ] The story creates no live console node. The story calls no live console API.

## Summary

Issue #1437: `.agro/cli/src/commands/node.ts:303` always sends `profile: "sandbox"` in the `POST /api/nodes` body. The CLI has no flag for the profile or for the apps of a node.

The console request schema is `createNodeRequestSchema` in `mifunedev/agro-console` `packages/shared/src/models/node.ts:334`. The schema is `.strict()` and has these fields:

- `profile`: `agro` or `sandbox`. The console default is `agro`.
- `runtimeSettings`: optional `{ codeServerEnabled: boolean }`, strict.
- `t3`: boolean. The console default is `false`.
- `docker`: boolean. The console default is `true`.

The console create path accepts `t3`, `docker`, and `runtimeSettings` for both profiles. A sandbox node ignores them. The provisioner skips `startApps` for `profile === "sandbox"` (`apps/provisioner/src/services/provision.service.ts:842`). The provisioner disables T3 for a sandbox node (`provision.service.ts:523`). The runtime-settings service refuses a sandbox node with `SANDBOX_PROFILE_UNSUPPORTED` (`apps/web/server/services/runtime-settings.service.ts:214`). The create controller returns HTTP 422 `RUNTIME_SETTINGS_DISABLED` when the body has `runtimeSettings` and the console feature is off (`apps/web/server/controllers/nodes.controller.ts:109`).

Selected approach: extend `parseCreate` in `node.ts` with `--profile <agro|sandbox>` and the boolean flags `--docker`, `--t3`, and `--code-server`. The CLI keeps the profile `sandbox` when `--profile` is absent. The CLI sends each app field only when the operator gives its flag. The CLI rejects an app flag with the profile `sandbox` before any API call. The existing `errorDetail` path surfaces each console error.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/node.ts` | `CreateArgs`, `parseCreate` | Parse `--profile` and the three app flags. Validate the combination. |
| `.agro/cli/src/commands/node.ts` | `runCreate` | Build the `POST /api/nodes` body from the parsed arguments. |
| `.agro/cli/src/commands/node.ts` | `nodeHelp` | Show the new usage line and flag descriptions. |
| `.agro/cli/src/commands/node.ts` | `errorDetail`, `callApi` | Surface console errors. No change. |
| `.agro/cli/src/__tests__/node.test.ts` | `describe("agro node create")` | Stubbed-fetch tests of the request body and of the validation errors. |
| `docs/lifecycle-commands.md` | verb table line 52, `## Remote console nodes: agro node` | Public documentation of the flags. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro node create` CLI | additive flags | `--profile agro\|sandbox`, `--docker`, `--t3`, `--code-server`. |
| `POST /api/nodes` request body | additive fields | `profile` comes from `--profile`. The CLI sends `docker`, `t3`, and `runtimeSettings.codeServerEnabled` only when the operator gives the flag. |
| `agro node --help` | text | New usage line and flag descriptions. |

## Storage
N/A. The CLI stores no state. The console owns node state.

## Architectural Decisions
- The console schema is the source of truth for the request fields. The CLI copies the field names and the profile values `agro` and `sandbox` from `createNodeRequestSchema`. The CLI does not import the console package.
- The default profile stays `sandbox`. The CLI sends `profile: "sandbox"` when `--profile` is absent. This keeps the current behavior of `agro node create`. The console default `agro` applies only to clients that omit the field.
- The app flags are presence flags. A given flag sends `true`. An absent flag omits the field, so the console default applies: Docker on, T3 off, code-server off. The operator decided that Docker comes standard by default, so `--docker` sends the console default explicitly.
- `--code-server` maps to `runtimeSettings: { codeServerEnabled: true }`. The CLI sends no `runtimeSettings` key without `--code-server`, so the 422 `RUNTIME_SETTINGS_DISABLED` cannot occur without the flag.
- The CLI rejects `--docker`, `--t3`, and `--code-server` with the profile `sandbox`. The console accepts the fields for a sandbox node and then ignores them. A local error is clearer than a silent no-op.
- Auth and scoping do not change. The CLI uses the same bearer token from `resolveConsoleConfig`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/node.test.ts` | default body has `profile: "sandbox"` and no app keys | The current behavior stays. |
| `.agro/cli/src/__tests__/node.test.ts` | `--profile agro`, `--profile=agro` | The profile flag in both forms. |
| `.agro/cli/src/__tests__/node.test.ts` | `--profile agro` with all three app flags, and with each flag alone | The body mapping of each app flag. |
| `.agro/cli/src/__tests__/node.test.ts` | `--profile desktop`, `--profile` with no value | Profile validation with no API call. |
| `.agro/cli/src/__tests__/node.test.ts` | each app flag with `--profile sandbox` and with the default profile | Combination validation with no API call. |
| `.agro/cli/src/__tests__/node.test.ts` | stubbed HTTP 422 `RUNTIME_SETTINGS_DISABLED` | The console error surfaces cleanly. |
| `.agro/cli/src/__tests__/node.test.ts` | help text | The usage line and flag descriptions. |

## Design Principles
- Keep one parser. Extend `parseCreate`. Do not add a parser library.
- Validate before any network call. The combination errors exit 1 before `resolveSshKeyId`.
- Add no explanatory comments to tracked code (root `AGENTS.md` § 5).
- Change only `agro node create`. Other verbs stay as they are.

## Out of Scope
- Any change to the `mifunedev/agro-console` repository. Its PR #576 is under review.
- A `--no-docker` flag or any other way to turn Docker off. The issue names only `--docker`.
- Any change to `agro node list`, `agro node delete`, or another verb.
- A live node against a console. Tests use stubbed `fetch`.

## Open Questions
None.

## Acceptance Criteria
- [ ] `agro node create --profile agro` posts `profile: "agro"` (stubbed test).
- [ ] `--docker`, `--t3`, and `--code-server` each post their console field with `--profile agro` (stubbed test).
- [ ] An absent app flag omits its field from the body (stubbed test).
- [ ] An invalid profile or an app flag with the profile `sandbox` exits 1 with no API call (stubbed test).
- [ ] `docs/lifecycle-commands.md` and `nodeHelp` show the same usage line.
- [ ] `npx vitest run .agro/cli/src/__tests__/node.test.ts` and `npm --prefix .agro/cli run typecheck` exit 0.
- [ ] CI on the PR is green.

## Lessons

1. Claim: the docs verb check in `.agro/cli/src/__tests__/docs-reference.test.ts` reads `agro <word>` inside inline code as a CLI verb. Evidence: `pnpm test` failed with `docs/lifecycle-commands.md:355 unknown verb` for the inline string `--profile must be agro or sandbox`. The repair moved the string into a `text` fenced block. Outcome: fixed in this PR (`aa9d910a`).
2. Claim: the story checks named only `node.test.ts`, so the docs verb check failed first at Close. Evidence: US-002 passed its own criteria. After that, `pnpm test` failed. Outcome: dropped. The reason is that the full suite at Close caught the failure as designed.
3. Claim: the CC Safety Net hook blocks a Python heredoc edit. Evidence: two workers reported the block and used the Edit tool. Outcome: dropped. The reason is tooling friction with a working remedy.
4. Claim: the plan named no `CHANGELOG.md` entry, though `/git` § Changelog requires one for a user-visible change. Evidence: the PR checklist review at Close found no entry. A round 2 repair of US-002 added the entry. Outcome: fixed in this PR.
