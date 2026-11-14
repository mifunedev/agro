# Sandbox skill refinement: manual review evidence

## Scope and provenance

The advisor inspected the implementation worker's diff and the bounded provenance repair.
The eight decision contexts read immutable revision `7bbf3209a6af04513b7f7f8881dc9d10415884a6`.
Each context received one case, the output vocabulary, and source-reading instructions.
No context received the oracle, peer output, earlier scores, or a target score.
The advisor captured the actual JSON responses without editing their route, owners, commands, or notes.

The complete instruction-input SHA256 is `fd394976beb031489d88706e67e5ee0bfdf71d8927521be3968e4fb5fa3ff233`.
The cases SHA256 is `afbbb95cab11756a6b5cbbb6e2b34a672513f2dc667f25e6d017bd7d879d8bab`.
The explicit input list covers the dispatcher, seven references, and the two linked public documents that R8 read.
All ten input files still match the immutable replay revision byte-for-byte.
The provenance extension changed no response, case, model, handle, or outcome.

## Positive verification

Prerequisites: a Docker-capable host, AGRO with `agro run`, and this PR checkout with installed dependencies.
Location: the PR worktree on the host. The command executes inside a disposable container.

```bash
agro run -- sh -c 'set -eu; pnpm run lint; pnpm typecheck; pnpm build; pnpm test'
```

Observed exit status: 0 in advisor monitor #12.
Observed final output, trimmed:

```text
Test Files 125 passed (125)
Tests 3348 passed (3348)
```

The root lint command only prints that the repository has no root lint configuration.
Typecheck and build both completed successfully.
The complete suite includes the real observed-record check and the two public-document mutation tests, with no skipped test in the final summary.

A focused command also passed 270 tests in eight files.
`execution-contracts.json` records its exact command and selected actual passing assertions.
These fixture tests cover image selection, identity, environment, project transfer, failure handling, cleanup, and provider discovery.
They do not prove live provider availability.

## Routing decisions

The deterministic grader accepted all eight observed routes and required owners on their first attempts.
`routing-run.json` records actual handles, models, prompt hashes, source reads, and capture limits.
The committed fixture is `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json`.
The grader rejects missing, duplicate, unknown, wrong-route, wrong-owner, malformed, stale, nonfresh, or execution-claim records.
Its synthetic unit fixtures have a distinct kind and cannot satisfy the observed-record gate.

Suggested commands in model responses remain unexecuted and are not wording-graded.
The result establishes this bounded routing sample, not a general agent task-success rate.

## Failure path from fresh state

Location: the same host worktree, with execution inside a new disposable container.
The wrapper first confirms that the chosen output path does not exist.
The invalid-provider branch creates only local temporary state and calls no provider adapter operation.

```bash
agro run -- sh -c 'root=$(mktemp -d); export MATRIX_OUT="$root/new-output"; if test -e "$MATRIX_OUT"; then exit 1; fi; printf "Fresh output path absent before invocation: yes\n"; bash .agro/skills/sandbox/scripts/run.sh invalid-provider --preflight; rc=$?; printf "Invalid-provider exit status: %s\n" "$rc"; test "$rc" -eq 2 || exit 1; test -d "$MATRIX_OUT/.state" || exit 1; printf "Fresh temporary state created locally; no provider invocation\n"'
```

Observed output:

```text
Fresh output path absent before invocation: yes
usage: run.sh <console|exedev|msb|vercel> [<check>|--preflight]
Invalid-provider exit status: 2
Fresh temporary state created locally; no provider invocation
```

The driver exited 2. The review wrapper exited 0 after verifying that expected failure.

## Preservation and cleanup

`preservation.json` records exact Git blobs and modes for all sixteen moved machinery files against the PR base.
The provider-link check and shell syntax checks passed.
The PR excludes runtime, dependency, and `agro.json` changes.
The advisor left the operator's main-checkout changes untouched.

`agro run` removed each verification container after the command ended.
Temporary unit fixtures use isolated paths and finally cleanup.
The failure-path scratch directory existed only inside its disposable container.
The routing contexts created no provider VM or workload.

## Limits

No new live PostgreSQL-service, egress-boundary, microVM, or provider-VM validation occurred.
Existing unit and integration fixtures do not replace that live evidence.
The task did not publish the external skill registry or merge the PR.
