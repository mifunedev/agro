# PRD: Host harness commands find the registered sandbox

Status: DRAFT

## User Stories

### US-001: Resolve the sandbox container from the registry

**Description:** As a self-host user, I want `agro harness install <id>` on the host to find my running sandbox, so that the install goes into that sandbox.

**Acceptance Criteria:**

- [ ] On the host, with one registered sandbox `agro-sbx-1` and a working directory outside a checkout, `agro harness install <id>` probes the container `agro-sbx-1`, not `agro`.
- [ ] `agro harness list`, `agro harness status`, and `agro harness uninstall` use the same container name as `install`.
- [ ] A test in `.agro/cli/src/__tests__/harness.test.ts` covers the probe of a running registered sandbox from the host. The test fails before the fix.
- [ ] If `SANDBOX_NAME` or the `name` field of the project config sets the container, the commands keep that name.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

### US-002: Record the manual review on a new VM

**Description:** As a reviewer, I want a transcript from a new exe.dev VM, so that I can see the fix work on a real host.

**Acceptance Criteria:**

- [ ] `.agro/tasks/harness-probe-sandbox/evidence/manual-review.md` holds the transcript of `agro sandbox install docker`, `agro ps agro-sbx-1`, and `agro harness install claude-code` on the VM host, before and after the fix.
- [ ] The VM is destroyed after the run, and the driver log ends with `remaining agro-matrix resources on exedev: 0`.

## Summary

`runHarnessInstall` and `collectStates` in `.agro/cli/src/commands/harness.ts` resolve the project root with `resolveProjectRoot(opts.cwd)`. `targetFor` then takes the container name from `configuredContainerName(root)` and falls back to `DEFAULT_CONTAINER_NAME`, which is `agro`. `agro sandbox install docker` names a new sandbox `agro-sbx-<n>` and registers it under `~/.agro/sandboxes/<name>`. `agro ps` and `agro shell` resolve the root through `resolveSandboxRoot` in `.agro/cli/src/lib/registry.ts`, so they find the container. On a host where the working directory is not a sandbox checkout, `harness` probes the container `agro`, gets "absent", and refuses. The fix resolves the container through the same registry lookup that the lifecycle verbs use.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `targetFor`, `collectStates`, `runHarnessInstall`, `runHarnessUninstall` | Resolve the sandbox container |
| `.agro/cli/src/commands/lifecycle.ts` | `configuredContainerName`, `DEFAULT_CONTAINER_NAME`, `sandboxRoot` | The resolution that `ps` and `shell` use |
| `.agro/cli/src/lib/registry.ts` | `resolveSandboxRoot`, `listEntries` | The sandbox registry |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro harness install/list/status/uninstall` on the host | Behavior fix | The commands target the registered sandbox container |

## Storage
N/A. The fix reads the existing registry under `~/.agro/sandboxes/` and writes nothing new.

## Architectural Decisions
The sandbox registry is the source of truth for the container name on the host. `harness` uses the lifecycle resolution and adds no second lookup.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness.test.ts` | One registered sandbox `agro-sbx-1` is running, and the working directory is outside a checkout | `install` probes `agro-sbx-1` and installs into the sandbox |
| `.agro/cli/src/__tests__/harness.test.ts` | The environment holds `SANDBOX_NAME` | The configured name takes precedence |

## Design Principles
Keep one resolution path for the sandbox container. Express intent through names and tests, not comments.

## Out of Scope
`agro tool` can share the same defect. This task does not change `.agro/cli/src/commands/tool.ts`. The advisor records the defect as a lesson.

## Open Questions
None

## Acceptance Criteria
- [ ] On a new exe.dev VM, `agro harness install claude-code` on the host installs into `agro-sbx-1`.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

## Lessons

Filled by the advisor before undraft.
