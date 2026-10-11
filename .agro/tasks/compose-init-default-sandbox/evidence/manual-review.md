# Manual review evidence: Compose init is the default sandbox PID 1

Story: US-006 of `.agro/tasks/compose-init-default-sandbox/prd.md`. Issue #1393. PR #1399.

Shape: server, CLI, or API (`.agro/skills/git/references/manual-review.md`).

Each output below is from an observed run on 2026-10-11. This file trims long output to the lines that matter. No step creates a resource, so no step needs cleanup.

## Prerequisites

- A checkout of the AGRO harness at commit `13eaa973474d4f27a7e75685f293862d935bce35` for sections A and B. Section C uses commit `df139bfa0b402104070e0507d265a1151fec2ab4` (the PR #1399 head).
- Node 20 or newer, pnpm, git, and `gh` signed in to GitHub.
- shellcheck v0.10.0 (the CI version).
- No Docker daemon is necessary. No step starts a container, runs `docker run`, or pulls an image.

## Location

All local steps run in the sandbox, local, in the worktree `.worktrees/task/1393-us006` at `13eaa973`. The CI steps read GitHub Actions results with `gh`.

## A. Local checks

### A1. Install dependencies (prerequisite)

```bash
pnpm install --frozen-lockfile
```

Output (trimmed):

```text
Done in 972ms using pnpm v10.33.0
```

Exit status: 0.

### A2. The Compose base files grant no systemd privilege

```bash
git grep -n -E 'SYS_ADMIN|apparmor=unconfined|cgroup: private' -- .devcontainer
```

Output: no line.

Exit status: 1 (no match). Exit status 1 is the expected result.

### A3. Unit tests

```bash
npx vitest run
```

Output (trimmed):

```text
 Test Files  92 passed (92)
      Tests  2035 passed | 2 skipped (2037)
```

Exit status: 0.

### A4. Typecheck

```bash
pnpm run typecheck
```

Output:

```text
> @mifune/agro@0.20.0 typecheck
> tsc --noEmit
```

Exit status: 0.

### A5. CI shellcheck (v0.10.0)

```bash
shellcheck -S warning .devcontainer/*.sh .agro/install/*.sh .agro/scripts/*.sh .agro/skills/{audit,escalate,typesafe-ai}/scripts/*.sh .claude/hooks/*.sh
```

Output: no line.

Exit status: 0.

### A6. The Compose configuration is valid

```bash
bash .agro/scripts/docker-compose.sh config --quiet
```

Output:

```text
note: non-secret config comes from agro.json via `agro`; this direct run uses only .devcontainer/.env and the compose-file defaults
```

Exit status: 0.

### A7. The rendered Compose configuration uses Compose init

```bash
bash .agro/scripts/docker-compose.sh config | grep -E 'init:|entrypoint:|stop_signal:|cap_add|security_opt|cgroup:'
```

Output:

```text
    entrypoint:
    init: true
    stop_signal: SIGTERM
```

The `entrypoint:` list item is `- /usr/local/bin/sandbox-main.sh`. The output has no `cap_add`, `security_opt`, or `cgroup:` line.

Exit status: 0 (both pipeline stages).

### A8. Failure path

```bash
npx vitest run .agro/scripts/__tests__/sandbox-main.test.ts .agro/scripts/__tests__/sandbox-healthcheck.test.ts
```

Output (trimmed):

```text
 Test Files  2 passed (2)
      Tests  14 passed (14)
```

Exit status: 0.

These cases prove the failure path:

- `sandbox-main.test.ts`: "leaves no readiness file and warns when the entrypoint fails". A bootstrap failure leaves no readiness file, and the main script stays up.
- `sandbox-main.test.ts`: "deletes a stale readiness file before the entrypoint runs".
- `sandbox-main.test.ts`: "warns and stays up when the readiness file cannot be written".
- `sandbox-healthcheck.test.ts`: "fails under docker-init when the readiness file is missing". Under docker-init, a missing readiness file fails the healthcheck.
- `sandbox-healthcheck.test.ts`: "fails under systemd when the bootstrap oneshot is not active".
- `sandbox-healthcheck.test.ts`: "treats an unreadable PID 1 comm file as not systemd".

## B. CI on the PR head

Head: `13eaa973474d4f27a7e75685f293862d935bce35`.

### B1. All checks on PR #1399

```bash
gh pr checks 1399
```

Output:

```text
Boot Path Lint (shellcheck + hadolint)	pass	18s
Boot a legacy volume against the fresh image	pass	2m0s
Install every optional harness through the CLI	pass	5m3s
Typecheck, Build & Test	pass	49s
Validate sandbox compose and image build	pass	2m11s
Verify exact Node and pnpm parity across Debian bases	pass	19s
```

Exit status: 0.

The runs are `CI: Harness` 38159177363, `CI: Sandbox Boot Guard` 38159177364, and `CI: Sandbox Compatibility` 38159177365. Each run has `headSha` `13eaa973474d4f27a7e75685f293862d935bce35` and conclusion `success`.

### B2. `sandbox-boot-guard.yml` smoke lines

```bash
gh run view 38159177364 --log | grep -E 'sandbox boot smoke:|sandbox boot smoke ok|upgrade-smoke: .*ready'
```

Output (trimmed; this file omits the per-tool "not installed at boot" lines):

```text
upgrade-smoke: waiting up to 1200s for upgraded boot: bootstrap readiness file /run/agro/bootstrap.ready
upgrade-smoke: upgraded boot ready: container bc44873a6185cc0b3f589656da783dc87d9a580a862949c41f8c065b7ff69953, bootstrap wrote /run/agro/bootstrap.ready
sandbox boot smoke: Compose init (docker-init) is PID 1 and the bootstrap readiness file exists
sandbox boot smoke ok: sandbox (acbcd8d95bf8bc6a71304caed4c7bf61c6bdf81bc00616363eb217feb8d50e19) passed bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh, Compose init PID 1 with bootstrap readiness, Herdr runtime, bind-ownership, and installed no harness or tool at boot
```

Exit status: 0.

- Boot smoke: job "Validate sandbox compose and image build", step "Boot sandbox and verify healthcheck (asserts boot installs nothing)": success.
- Legacy-volume upgrade smoke: job "Boot a legacy volume against the fresh image", step "Upgrade a legacy workspace volume to the freshly built image": success.
- CLI-first install smoke: job "Validate sandbox compose and image build", step "Candidate CLI-first install and recreation smoke": success. The step log ends with `cli-first-install-smoke: phase all complete`.
- Optional-harness install matrix: job "Install every optional harness through the CLI" in run 38159177365: pass.

## What remains unverified

- No live sandbox was rebuilt for this review. The container boot evidence comes only from the CI runs in section B.
- The remote-sandbox VM image mode rows were not run. This includes `R05-sandbox-boot`, `R06-systemd`, `R07-container-restart`, and `R08-vm-restart`. VM image mode boots the image `CMD` (`/sbin/init`) as PID 1, so these rows prove the systemd path that this change keeps.

To run the image mode rows, get operator approval first, because each run creates billable VMs. Set up the exe.dev provider as `.agro/skills/remote-sandbox/SKILL.md` describes. Run these commands on the driver host from the harness root. Replace `<version>` with the image tag under test:

```bash
SKILL=.agro/skills/remote-sandbox
bash "$SKILL/scripts/run.sh" exedev --preflight
tmux new-session -d -s rs-image "IMAGE=ghcr.io/mifunedev/agro:<version> bash $SKILL/scripts/run.sh exedev checks/agro-rows.sh"
tmux new-session -d -s rs-sync "IMAGE=ghcr.io/mifunedev/agro:<version> bash $SKILL/scripts/restart-test.sh exedev sync"
bash "$SKILL/scripts/summarize.sh" "$MATRIX_OUT"
```

## C. Folded stories (US-007, US-008, US-009)

Story: US-010. Each output below is from an observed run on 2026-10-11.

Location: the sandbox, local, in the worktree `.worktrees/task/1393-us010`. The worktree is at `3754e50f`. That commit differs from the PR head `df139bfa` only in `prd.json`, so the code under test is the PR head code. The CI steps read GitHub Actions results with `gh`. No step starts a container or pulls an image. No step creates a resource in the repository.

### C1. US-007: The Langfuse fragment names no systemd reader

```bash
git grep -n -i systemd -- .agro/cli/src/lib/tracing docs/integrations/langfuse.md
```

Output: no line.

Exit status: 1 (git grep found no match; this is the expected result).

```bash
npx vitest run .agro/cli/src/lib/tracing
```

Output (trimmed):

```text
 Test Files  2 passed (2)
      Tests  41 passed (41)
```

Exit status: 0.

```bash
pnpm run typecheck
```

Output (trimmed):

```text
> tsc --noEmit
```

Exit status: 0.

### C2. US-008: CI lints the remote-sandbox scripts

The CI shellcheck command, `.github/workflows/ci-harness.yml` line 110, with shellcheck v0.10.0:

```bash
shellcheck -S warning .devcontainer/*.sh .agro/install/*.sh .agro/scripts/*.sh .agro/skills/audit/scripts/*.sh .agro/skills/escalate/scripts/*.sh .agro/skills/typesafe-ai/scripts/*.sh .agro/skills/remote-sandbox/adapters/*.sh .agro/skills/remote-sandbox/checks/*.sh .agro/skills/remote-sandbox/scripts/*.sh .claude/hooks/*.sh
```

Output: no line.

Exit status: 0.

Both workflows include the remote-sandbox globs:

```bash
grep -c 'remote-sandbox' .github/workflows/ci-harness.yml .github/workflows/release.yml
```

Output:

```text
.github/workflows/ci-harness.yml:1
.github/workflows/release.yml:1
```

Exit status: 0. Each count is one shellcheck line. That line holds the three globs `remote-sandbox/adapters/*.sh`, `remote-sandbox/checks/*.sh`, and `remote-sandbox/scripts/*.sh`.

```bash
npx vitest run .agro/scripts/__tests__/remote-sandbox-suite.test.ts .agro/scripts/__tests__/remote-sandbox-adapters.test.ts
```

Output (trimmed):

```text
 Test Files  2 passed (2)
      Tests  21 passed (21)
```

Exit status: 0.

Failure path. Copy `.agro/skills/remote-sandbox/checks/agro-rows.sh` without its first line (`#!/usr/bin/env bash`) to a scratch folder outside the repository. Then run shellcheck on the copy:

```bash
tail -n +2 .agro/skills/remote-sandbox/checks/agro-rows.sh > "$SCRATCH/no-shebang.sh"
shellcheck -S warning "$SCRATCH/no-shebang.sh"
```

Output (trimmed):

```text
In .../no-shebang.sh line 1:
set -uo pipefail
^-- SC2148 (error): Tips depend on target shell and yours is unknown. Add a shebang or a 'shell' directive.
```

Exit status: 1.

Cleanup: delete `"$SCRATCH/no-shebang.sh"`. This review deleted the copy after the run.

### C3. US-009: The sandbox image has shellcheck and hadolint

```bash
grep -n -E 'shellcheck|HADOLINT|hadolint|sha256sum' .devcontainer/Dockerfile
```

Output:

```text
13:    iproute2 zsh lsof htop inetutils-telnet shellcheck \
18: && command -v shellcheck >/dev/null \
37:ARG HADOLINT_VERSION=2.12.0
39:      amd64) asset=hadolint-Linux-x86_64; sha=56de6d5e5ec427e17b74fa48d51271c7fc0d61244bf5c90e828aab8362d55010 ;; \
40:      arm64) asset=hadolint-Linux-arm64; sha=5798551bf19f33951881f15eb238f90aef023f11e7ec7e9f4c37961cb87c5df6 ;; \
41:      *) echo "no pinned hadolint build for $(dpkg --print-architecture)" >&2; exit 1 ;; \
43: && curl -fsSL "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/${asset}" -o /tmp/hadolint \
44: && echo "${sha}  /tmp/hadolint" | sha256sum -c - \
45: && install -m 0755 /tmp/hadolint /usr/local/bin/hadolint \
46: && rm -f /tmp/hadolint
```

Exit status: 0.

```bash
npx vitest run .agro/scripts/__tests__/verify-sandbox-image.test.ts
```

Output (trimmed):

```text
 Test Files  1 passed (1)
      Tests  38 passed (38)
```

Exit status: 0.

CI log of run 38161083662 ("CI: Sandbox Boot Guard", head `df139bfa`, conclusion `success`):

```bash
gh run view 38161083662 --log | grep -E '/tmp/hadolint: OK|ok: hadolint --version|ok: shellcheck --version'
```

Output:

```text
Validate sandbox compose and image build	Build sandbox image locally	2026-10-11T17:47:43.6796682Z #10 0.452 /tmp/hadolint: OK
Validate sandbox compose and image build	Verify sandbox image contract	2026-10-11T17:48:21.2368436Z ok: hadolint --version -> Haskell Dockerfile Linter 2.12.0
Validate sandbox compose and image build	Verify sandbox image contract	2026-10-11T17:48:21.4428815Z ok: shellcheck --version -> version: 0.10.0
Boot a legacy volume against the fresh image	Upgrade a legacy workspace volume to the freshly built image	2026-10-11T17:48:31.8270828Z #10 0.529 /tmp/hadolint: OK
```

Exit status: 0. The `/tmp/hadolint: OK` lines are the `sha256sum -c` check in the image build. The `ok:` lines come from `verify-sandbox-image.sh`.

### C4. CI on the PR head `df139bfa`

```bash
gh pr checks 1399
```

Output:

```text
Boot Path Lint (shellcheck + hadolint)	pass	18s
Boot a legacy volume against the fresh image	pass	2m11s
Install every optional harness through the CLI	pass	5m22s
Typecheck, Build & Test	pass	49s
Validate sandbox compose and image build	pass	2m27s
Verify exact Node and pnpm parity across Debian bases	pass	20s
```

Exit status: 0.

### C5. Full unit suite

```bash
npx vitest run
```

Output (trimmed):

```text
 Test Files  92 passed (92)
      Tests  2046 passed | 2 skipped (2048)
```

Exit status: 0.
