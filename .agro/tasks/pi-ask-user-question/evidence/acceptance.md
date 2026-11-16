# Advisor acceptance

## US-001

Integrated revision: `2befdf9710c6ff27961c201e0cc85ab625226bbf`.
The advisor inspected both files in the worker commit.
The advisor detached the main checkout at that revision for acceptance.
Inside `agro run --`, `pnpm install --frozen-lockfile` exited 0.
A fresh temporary installation of Pi `1.5.2` and package `2.15.0` completed with exit 0.
The advisor reran `probe.mjs` from the main checkout; exit 0.

Observed assertions:

```text
PASS manifest discovery + real extension loader + tool and reconciler registration
PASS structured option answer
PASS structured custom answer
PASS dialog cancellation
PASS no-UI removal, idempotence, execution backstop, RPC restoration and sibling preservation
PASS all checks; no session prompt or model API invoked
CLEANUP_OK
```

The probe uses the real published extension and Pi loader.
It substitutes host dialog responses and active-tool storage.
It does not prove terminal rendering or RPC transport.

## US-002

Integrated revision: `0d3e34b5bc07858817128dafabb70433882395ac`.
The advisor inspected all four changed files.
Only the package pin, expected package list, Pi guide, and changelog changed.
The worker recorded a red settings test before the configuration change: one failure and three passes, exit 1.
After the configuration change, the worker recorded four passes, exit 0.

The advisor detached the main checkout at the integrated revision and ran these commands through `agro run --`:

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts
bash .agro/scripts/link-providers.sh --check
bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/pi.md
```

All commands exited 0.
The settings test reported four passes.
The provider check reported `Providers OK`.
A separate Node assertion confirmed exactly one question-package pin.
The advisor confirmed the task revision has no `agro.json` diff from `development`.
A byte comparison confirmed operator configuration restoration after acceptance.

## US-003

Integrated revision: `e0b340f330ae55591cf5e4d0f50d9b752775a392`.
The advisor inspected the script and transcript.
The advisor detached the main checkout at that revision and ran these commands through `agro run --`:

```sh
pnpm install --frozen-lockfile
bash .agro/tasks/pi-ask-user-question/evidence/manual-review.sh
bash -n .agro/tasks/pi-ask-user-question/evidence/manual-review.sh
bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/pi-ask-user-question/evidence/manual-review.md
```

All commands exited 0.
The fresh root was `/tmp/agro-question-review.e6RuL5/install`.
Pi `1.5.2` installed package `2.15.0` through `pi install --local`.
`pi list` showed the exact project pin.
The real package probe passed structured option/custom answers, cancellation, and no-UI checks.
The missing-source failure printed `Error: Path does not exist` and exited 1 as expected.
Cleanup reported `/tmp/agro-question-review.e6RuL5 absent; exit 0`.
The script verified no personal settings file existed.
A byte comparison confirmed operator configuration restoration.

## Main-checkout preservation

The main checkout started on `development` with operator-local `agro.json` changes.
The advisor copied that file to an isolated local preservation worktree and committed the copy without pushing it.
A byte comparison confirmed the preserved file matched the original.
The safety guard blocked `git restore -- agro.json` before execution.
The advisor followed the guard's named-stash remedy instead of bypassing it.
The stash captured only `agro.json` and had a task-specific name.
The acceptance trap returned to `development` and applied the exact captured stash object.
A second byte comparison confirmed the original operator configuration returned unchanged.
The task branch contains no `agro.json` change.
