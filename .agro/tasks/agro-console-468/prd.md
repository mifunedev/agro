# #468 Manual recovery point on a sandbox node

Root cause: `RecoveryPointService.create()` uses the management-SSH archive transport for every node with a transport. Sandbox nodes have no management channel (ADR #417), so the capabilities check fails with exit 255.

Operator decision (option 1): `create()` skips the archive transport for `profile === "sandbox"` and falls through to `createImage`. An archive transport failure carries the SSH stderr reason in the recovery point error. Pause path unchanged; no node directive.

## US-001 Sandbox manual point takes the image path
- A sandbox node's manual recovery point calls createImage and never calls archiveCapabilities / createWorkspaceArchive. Test fails against the old code.
## US-002 Transport error carries stderr reason
- When archiveCapabilities (or createWorkspaceArchive) fails with stderr, the recovery point error includes the stderr reason (e.g. "Permission denied (publickey)").

Gates: provisioner tests (guarded), `pnpm type-check`, CI on agro runner green, PR ready.
