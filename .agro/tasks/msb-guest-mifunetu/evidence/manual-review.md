# Manual review: US-004

Date: 2026-11-15. Host: the brain (exe.dev VM), on the host, not in a sandbox.
CLI: branch build `node .agro/cli/dist/agro.js` at 6d235e91 (`agro run -- pnpm run build:harness`, exit 0), version 0.38.0.
Fresh state: the msb image cache held no mifunetu image before the first run.

## Preflight (read-only)

    $ msb --version
    msb 0.7.13
    $ test -r /dev/kvm -a -w /dev/kvm; echo $?
    0
    $ msb ls
    agro-console    ghcr.io/mifunedev/agro:0.33.0-msb    crashed    2026-11-08   (existing, not touched)

## Runs

    $ agro run --isolation microvm --json -- sh -c 'id -un; node -v; exit 7'
    agro run: unknown flag "--json"
    exit=1

The plan cited a `--json` flag that `agro run` does not have. The run record in
`~/.agro/runs/microvm.jsonl` gives the image reference instead.

    $ agro run --isolation microvm -- sh -c 'id -un; node -v; exit 7'
    sandbox
    v24.22.1
    exit=7

    $ agro run --isolation microvm -- pnpm run typecheck
    exit=0

    $ agro run --isolation microvm -- pnpm exec vitest run .agro/cli/src/__tests__/microvm-target.test.ts
    Test Files 1 passed (1); Tests 27 passed (27)
    exit=0

## Run records (~/.agro/runs/microvm.jsonl, this session)

    {"time":"2026-11-15T07:11:02.028Z","image":"ghcr.io/mifunedev/mifunetu:0.38.0","digest":"sha256:129632d3cc1f7ea5e9741af4ad62c9ddbb805606e82be52e8cc826de3f5dab6f","exitCode":0,"bootToExitMs":60087}
    {"time":"2026-11-15T07:12:02.308Z","image":"ghcr.io/mifunedev/mifunetu:0.38.0","digest":"sha256:129632d3cc1f7ea5e9741af4ad62c9ddbb805606e82be52e8cc826de3f5dab6f","exitCode":0,"bootToExitMs":22983}
    {"time":"2026-11-15T07:12:32.672Z","image":"ghcr.io/mifunedev/mifunetu:0.38.0","digest":"sha256:129632d3cc1f7ea5e9741af4ad62c9ddbb805606e82be52e8cc826de3f5dab6f","exitCode":7,"bootToExitMs":3138}

The first record (typecheck) includes the first pull of the mifunetu image.

## Cleanup

    $ msb image rm ghcr.io/mifunedev/mifunetu:0.38.0   (ok)
    $ msb ls   -> only the existing agro-console sandbox; no agro-run-* sandbox remains
