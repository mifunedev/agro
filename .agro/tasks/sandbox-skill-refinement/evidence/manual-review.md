# Sandbox skill refinement: manual review evidence

## Scope and provenance

The advisor inspected the bounded implementation diff and the final prerequisite wording.
Eight genuinely new decision contexts read immutable revision `1d17ba3c262ee1777f261d24b7ddd1be5269cf8e`.
Each context received one unchanged case, the output vocabulary, and source-reading instructions.
No context received an oracle, peer output, earlier score, or target score.
The advisor captured actual replies without editing routes, owners, commands, or notes.
The old batch remains in Git history at `ddd4889fe09826247a865ca55a7bae92d4ea3ab6`.
The new batch is not a metadata-only relabel of old responses.

The complete instruction-input SHA256 is `d92ff76bf9614973f9c77d7a9fed903bd27a9a855a7619ea97b2d648abec74ee`.
The unchanged cases SHA256 is `afbbb95cab11756a6b5cbbb6e2b34a672513f2dc667f25e6d017bd7d879d8bab`.
The input list covers the dispatcher, seven references, and two linked public documents.
All ten input files match the immutable replay revision byte-for-byte.
Native transcripts show twenty source-only `git show` calls, unique handles, and the recorded model names.

## Positive verification

Prerequisites: a Docker-capable host, AGRO with `agro run`, and this PR checkout with installed dependencies.
Location: the isolated PR worktree on the host. Execution occurs inside a disposable container.
Tested source snapshot: `a213be5cc333c9ac71b5aec8677a0b0fdf3bbd14`.

```bash
agro run -- timeout 600s sh -c 'set -eu; pnpm run lint; pnpm typecheck; pnpm build; pnpm test'
```

Advisor monitor #18 exited 0. Its final output was:

```text
Test Files 125 passed (125)
Tests 3352 passed (3352)
```

Typecheck and build passed. The root lint command prints a message; the repository defines no root lint.
The final suite skipped no test.
Monitor #16 separately passed all 43 skill/routing tests without filtering.
The observed-record gate and both public-document mutation tests ran.
Four new documentation guards first failed against the old instructions; native worker output records four failures and six passes.
The repaired source passed all ten skill guards.

Monitor #19 separately passed all 270 focused contract tests in eight files, with exit 0.
Those files cover image selection, identity, environment, transfer, failure handling, cleanup, and discovery.
`execution-contracts.json` records the focused command and selected actual passing assertions.
These fixtures do not prove live provider behavior.

## Routing decisions

All eight new responses match the frozen routes and required owners on their first attempts.
`routing-run.json` records handles, observed models, prompt hashes, source reads, and capture limits.
`.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` records the actual replies.
The grader rejects missing, duplicate, unknown, wrong-route, wrong-owner, malformed, stale, nonfresh, and execution-claim records.
Synthetic unit fixtures cannot satisfy the observed-record gate.

Suggested commands remain unexecuted and ungraded. Allowed extra owners remain unpenalized.
Do not execute a suggestion without validating its command and installed capabilities.
The result establishes a bounded routing sample, not a general task-success rate.

## Failure path from fresh state

The following literal wrapper ran inside a new disposable container.
It verified that the output path was absent before invocation.
The invalid-provider branch creates local state but reaches no provider operation.

```bash
agro run -- timeout 120s bash -c 'set -euo pipefail; test ! -e /tmp/agro-pr1619-round3-negative; printf "Fresh output absent before invocation: yes\n"; if MATRIX_OUT=/tmp/agro-pr1619-round3-negative REMOTE_SANDBOX_ADAPTERS= bash .agro/skills/sandbox/scripts/run.sh invalid-provider; then printf "Unexpected provider acceptance\n"; exit 1; else case $? in 2) printf "Invalid-provider exit status: 2\n" ;; *) printf "Unexpected failure status\n"; exit 1 ;; esac; fi; test -d /tmp/agro-pr1619-round3-negative/.state; if find /tmp/agro-pr1619-round3-negative/.state -type f -print -quit | grep -q .; then exit 1; fi; printf "Provider state files: 0; no provider operation reached\n"'
```

Observed output:

```text
Fresh output absent before invocation: yes
usage: run.sh <console|exedev|msb|vercel> [<check>|--preflight]
Invalid-provider exit status: 2
Provider state files: 0; no provider operation reached
```

The driver exited 2. The wrapper exited 0 after checking that failure.
The temporary state existed only inside the disposable container.

## Preservation and cleanup

`preservation.json` records exact blobs and modes for all sixteen moved machinery files against the PR base.
Independent checks confirmed those pairs, tracked provider links, payload inclusion, and retired entrypoints.
All sixteen explicit `bash -n` checks passed inside `agro run`.
Six complete changed documents passed STE. Manual review checked conditions, actors, and antecedents.
Provider-link and diff checks passed.
The PR excludes runtime, dependency, and `agro.json` changes.
The operator's main-checkout changes remain untouched.

Verification containers use `docker run --rm` through `agro run`.
Unit fixtures use isolated temporary paths and cleanup.
Decision contexts created no workload or provider resource.

## Limits

No live PostgreSQL-service, egress-boundary, microVM, or provider-VM validation occurred.
Fixture success does not establish those live boundaries or effective monitor cancellation.
An initial launcher rejected `pipefail` before any test; the successful run used an explicit Bash wrapper.
A safety guard rejected an unverifiable compound shell source.
The advisor followed its remedy with literal check commands, not another tool or generated script.
The task published no external skill registry and merged no PR.
Final-head GitHub CI remains a separate readiness gate.
