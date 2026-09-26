# PRD: Installation-aware recovery hint for a missing lifecycle script

Status: DRAFT

## User Stories

### US-001: Recovery hint follows the installation kind

**Description:** As an operator, I want a recovery hint that matches my installation so that I reach a working fix.

**Acceptance Criteria:**

- [ ] For an image installation under /opt/oh, the `requireLifecycleScript` error names the host image refresh: `agro stop <name>`, then `agro sandbox install docker --name <name>`.
- [ ] For an image installation, the error text does not contain the string `` `agro update` ``.
- [ ] For an npm, standalone, source, or unknown installation, the error names `oh update` as the verb that re-vendors the control plane.
- [ ] The error keeps the absolute path of the missing script as its first detail, so `lifecycle.test.ts` still matches the path.
- [ ] A red test in the new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` fails against the current message before the change.
- [ ] The same test passes after the change.
- [ ] `npm run typecheck --prefix .agro/cli` exits 0.

### US-002: Error names a generation mismatch

**Description:** As an operator, I want the error to name a generation mismatch so that I diagnose version skew directly.

**Acceptance Criteria:**

- [ ] If the resolved control dir lacks `scripts/<rel>` and the other generation's control dir holds `scripts/<rel>`, the error names both paths and both generation names.
- [ ] If the other generation's control dir holds no `scripts/<rel>`, the error contains no mismatch text.
- [ ] Cases in the new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` cover the `agro` resolved generation with a `.oh` script, and the `legacy` resolved generation with a `.agro` script.
- [ ] `npx vitest run .agro/cli/src/lib/execution/__tests__/runner.test.ts` exits 0 from the repository root after the implementer adds the new file.

### US-003: Recovery runbook for an affected sandbox

**Description:** As an operator, I want a recovery section in the lifecycle docs so that I repair an affected sandbox.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` has a section that quotes the `missing lifecycle script` error.
- [ ] The section tells the operator to run `agro --version` inside the sandbox to read the installed CLI version.
- [ ] The section tells the operator to refresh the image from the host with `agro stop <name>`, then `agro sandbox install docker --name <name>`.
- [ ] The section states that `agro update` refuses an image installation, and links to the `agro update` section.
- [ ] The section does not tell the operator to write to /opt/oh inside a running sandbox.
- [ ] `CHANGELOG.md` has an entry for the corrected diagnostic.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` reports no finding on the new section.

## Summary

The reported failure comes from an old image bundle. Inside the sandbox, the `agro` executable resolves under /opt/oh to `@mifune/agro` v0.9.0. That bundle hardcodes the `.oh` control dir. Current source is v0.12.2 in `.agro/cli/package.json`.

In current source, `requireLifecycleScript` at `.agro/cli/src/lib/execution/runner.ts:70` resolves the control dir through `resolveProjectLayout` at `.agro/cli/src/lib/compat.ts:204`. Current source resolves the path correctly. The error message at `.agro/cli/src/lib/execution/runner.ts:75` still tells the operator to run `` `${activeBin()} update` ``. The advice fails for two reasons:

1. For the `agro` bin, `update` upgrades the CLI and does not vendor the payload. `printSelfUpgradeHelp` in `.agro/cli/src/cli.ts` states that `oh update` vendors the payload.
2. `classifyInstallation` at `.agro/cli/src/commands/self-upgrade.ts:122` returns `image` for each target under /opt/oh. `refuseUnsupported` at `.agro/cli/src/commands/self-upgrade.ts:185` then refuses the upgrade.

Every AGRO sandbox installs the CLI under /opt/oh. The most frequent reader of the message therefore reaches a dead end.

The selected approach keeps ownership and lifecycle unchanged. `requireLifecycleScript` classifies the running installation with `classifyInstallation(process.argv[1], ...)`. A pure helper maps the installation kind to one recovery hint. The image hint reuses the host procedure that `refuseUnsupported` already prints. A second check looks for `scripts/<rel>` under the other generation's control dir, and the error names the mismatch when that file exists.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Builds the error. Gains the installation-aware hint and the mismatch check. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation`, `defaultDeps`, `refuseUnsupported`, `Installation` | Source of the installation kind and of the image refresh wording. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout`, `GENERATIONS`, `ProjectLayout` | Resolved generation and the other generation's control dir name. |
| `.agro/cli/src/lib/product.ts` | `activeBin` | Bin name for the printed commands. |
| `.agro/cli/src/commands/lifecycle.ts` | `runGateway` and compose verbs at lines 173, 199, 276, 289, 381 | Callers. Signatures stay unchanged. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | `requireLifecycleScript` call at line 143 | Caller. Signature stays unchanged. |
| `docs/lifecycle-commands.md` | new recovery section after `## Equipping a checkout: oh update` | Operator runbook. |
| `CHANGELOG.md` | unreleased entry | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `missing lifecycle script` error text | Modified | The recovery hint depends on the installation kind. A mismatch clause appears when the other generation holds the script. |
| `requireLifecycleScript` signature | Unchanged or optional parameter | An optional injected classifier keeps tests deterministic. Existing callers pass two arguments. |
| CLI verbs and flags | Unchanged | No verb, flag, or exit code changes. |
| `docs/lifecycle-commands.md` | Added section | Recovery runbook for a sandbox with an old image bundle. |

## Storage

N/A. The change reads the filesystem and writes no state.

## Architectural Decisions

- `classifyInstallation` stays the single source of truth for the installation kind. `runner.ts` calls it and does not copy the /opt/oh prefix rule.
- `refuseUnsupported` owns the image refresh wording. Extract that wording into one exported helper, and call the helper from both sites.
- `resolveProjectLayout` stays unchanged. The mismatch check reads only the other generation's `scripts/<rel>` path.
- The fix changes no ownership boundary. The CLI does not write to /opt/oh, does not create a `.oh` symlink, and does not refresh the image at boot.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | image kind names `sandbox install docker` and omits `` `agro update` `` | US-001 |
| new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | npm, standalone, source, and unknown kinds name `oh update` | US-001 |
| new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | `agro` layout with a `.oh` script names the mismatch; the reverse case also names the mismatch | US-002 |
| new file `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | no other-generation script gives no mismatch text | US-002 |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | the case at line 124 expects the new hint instead of `` `${bin} update` `` | US-001 regression |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | the case at line 712 still matches the missing `gateway.sh` path | US-001 path detail |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | the pattern `/missing lifecycle script/` at line 31 still matches | error prefix stays stable |

Run `npm test` from the repository root. Run `npm run typecheck --prefix .agro/cli`.

## Design Principles

- Apply the smallest correct change. Change one message and add one check.
- Keep one source of truth for installation kind and for the image refresh wording.
- Add no explanatory comments to tracked code.
- Point the operator at a command that succeeds for the installation that prints the message.

## Out of Scope

- A `.oh` to `.agro` symlink.
- Automatic installation or refresh of /opt/oh at boot. That change alters ownership and needs architecture review.
- Any write to /opt/oh inside a running sandbox.
- Any change to Slack credentials.
- Changes to the v0.9.0 bundle. The operator replaces that bundle with a newer image.

## Open Questions

1. `runner.ts` imports from `self-upgrade.ts`. Does the new import form a module cycle? If a cycle forms, move `classifyInstallation` and its deps type into a module under `.agro/cli/src/lib/`.
2. For a generation mismatch, does the error also name `agro migrate --check`? Or does the error only name both paths?
3. For a source installation, is `oh update` the right hint? Or is `oh update --from <checkout>` the right hint?
4. Does the public site in the mifunedev/agro-web repository mirror `docs/lifecycle-commands.md`? If the site mirrors the file, the recovery section needs a matching change in agro-web.

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes.
- [ ] `npm test` exits 0 from the repository root.
- [ ] `npm run typecheck --prefix .agro/cli` exits 0.
- [ ] `git grep -n "to re-vendor it" -- .agro/cli/src` returns no match.
- [ ] The diff contains no write to /opt/oh, no `.oh` symlink, and no change to Slack configuration.

## Lessons

Filled by the advisor before undraft.
