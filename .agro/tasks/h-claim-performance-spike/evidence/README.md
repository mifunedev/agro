# Evidence: H claim performance spike

## Source

The files `driver.sh`, `e1-seq.sh`, `lib/`, `verdict.py`, `fixtures/`, and `arms/h/after-claim.sh` are copies from `.agro/tasks/warm-pool-pause-protocol/evidence/` in the worktree `.worktrees/task/1557-warm-pool-pause-protocol`.

- Source commit: `aadd3ee3cd147c01a72fed9f81a84b6faee5f333`.
- At that commit, git tracks only `verdict.py` and `fixtures/` of the copied files. The other files are untracked local evidence. The sha256 values of the copied files before the US-001 change are:

| File | sha256 |
|---|---|
| `driver.sh` | `b4937236562af6014e7cbccdc4119b1cd88da4ab389b92a1845660fe6cde1d05` |
| `e1-seq.sh` | `b5bfe30af1c4bfa27bcfb9ebb3a0e25bdfe38acaee690573823cd4878e69473e` |
| `verdict.py` | `aec6eca647ba34bcb494c0413f542635860b7eee77c3318e717700c5367e68e0` |
| `arms/h/after-claim.sh` | `0892f00a9e8709654d70fb0a61093efdfa2bb98e4487ce744b1447db8554a428` |
| `fixtures/test.sh` | `3d5bdcfbc968de81230c4a5d030989c91960d2dea61f30558056859b0e4929ab` |

The baseline hook sha256 `0892f00a…` is the `hook_sha256` of the earlier H runs.

## Lever switches

Set the switches in the environment of `driver.sh` or `e1-seq.sh`. The driver validates them, passes them to the hook, and writes the lever set to the run record as `levers`.

| Switch | Values | Default | Effect |
|---|---|---|---|
| `H_STREAM` | `0`, `1` | `0` | `1` fetches, hashes, and extracts in one pass. |
| `H_PARALLEL_APT` | `0`, `1` | `0` | `1` starts the apt install of the missing packages before the fetch. The hook waits for it in the `install` step. |
| `H_ARCHIVE` | `A0`, `A1` | `A0` | Selects the archive variant. The pin is `archives.json[<variant>]` (`bytes`, `sha256`). The URL file is `<scratchpad>/h-url-<variant>`. `L2A_URL_FILE` overrides the URL file. |

The lever set has the form `stream:<0|1>,apt:<0|1>,archive:<A0|A1>`. The hook writes it to the local `start` line and to its JSON result. `e1-seq.sh` counts only runs of the current lever set and the current hook sha256.

Example:

```sh
H_STREAM=1 H_ARCHIVE=A1 PIN_AGRO_VERSION=0.28.0 bash driver.sh e1 h agro --docker
python3 -I verdict.py --steps
```

With the three switches unset, the hook runs the baseline steps: download to a file, size and sha256 check, `tar --list` allowlist check, and `tar --extract --skip-old-files` into `/`.

When `gh` and `libatomic1` are both installed on the node, the hook skips apt. The `install` line then has `apt_added=none apt=skipped`. The `install` line always has `apt=<inline|parallel|skipped>` and `apt_ms=<ms>`, the time in apt or in the wait for the parallel apt.

## Stream mode

`curl | tee <sha fifo> <count fifo> | zstd -dc | tar --extract --directory=<stage> --verbose --index-file=<listing>`

- The stage is `/var/tmp/agro-l2a-stage`, a new root-owned 0700 directory. The pipeline writes only to the stage. No active path receives a file before every check passes.
- After the pipeline, the hook compares the byte count and the sha256 with the pin. A difference fails the run with `step=verify result=fail`. A curl error with an intact `tee` fails the run with `step=fetch result=fail`. A `zstd` or `tar` error fails the run with `step=extract result=fail`.
- The hook applies the member allowlist and the unsafe-member check of the baseline to the `tar` index file. The index file lists the same names as `tar --list`.
- After all checks pass, the hook hard-links each staged entry into its target directory with `cp -a --link --update=none`. If the stage and a target directory are on different file systems, the hook copies without `--link`. `--update=none` keeps existing files, the same as `--skip-old-files`.
- Every failure path runs `fail`, which removes the stage, the listing, the fifos, and the URL file. Only the stage held the extracted files, so a failed run leaves no extracted file active.
- Difference from the baseline: `cp -a` sets the owner and mode of an existing target directory from the archive entry. `tar --skip-old-files` keeps them. The archive is pinned and verified, so this changes metadata only.

## Step names

The remote lines have the form `<ts> remote step=<name> elapsed_ms=<ms since remote start> result=<ok|fail> ...`. `verdict.py --steps` computes the duration of each step as the elapsed delta from the previous remote `ok` line.

| Mode | Lines in order |
|---|---|
| Baseline | `fetch`, `verify`, `extract`, `install`, `docker`, `apps-started`, `apps-up`. With Docker on, `docker` follows the start-apps wait. |
| Stream | `fetch`, `verify`, `extract`, `stream`, `install`, `docker`, `apps-started`, `apps-up` |

Stream convention:

- `fetch` ends when the one-pass pipeline ends. Its duration covers the download, the hash, the decompression, and the extraction into the stage.
- `verify` covers the byte count and sha256 comparison.
- `extract` covers the allowlist check and the move into place.
- `stream` is a summary line with the same elapsed value as `extract`. Its duration is the sum of `fetch`, `verify`, and `extract`. The summary line does not advance the delta chain.

`verdict.py --steps` adds these columns from the run record and the local log stamps:

| Column | Formula |
|---|---|
| `bind` | `claim_start - t_request` |
| `ssh` | `ssh_s - bind` |
| `pre_hook` | local `start` stamp - (`t_request` + `ssh_s`) |
| `handoff` | local `url-handoff ok` stamp - local `start` stamp |
| `session` | local `done` stamp - `url-handoff ok` stamp - last remote elapsed |
| `probe` | `usable_s` - (local `done` stamp - `t_request`) |

The columns sum to `usable_s`. The report keeps only `e1 h agro` runs that pass the drop rules and did not fail. The hook revision rule drops a run whose `hook_sha256` differs from the current hook file. The rule ignores the lever set. The report groups runs by `levers` in the run record, then by `levers` in the hook result, then by `levers=` in the log `start` line, else by `none`.

Without `--fixture`, `--steps` reports each run folder that exists, in this order: `runs-apt-at-claim`, `runs-attribution`, `runs`. Each table header and each `dropped` or `failed` line starts with the folder name, so equal lever sets in different folders stay separate. `--base DIR` reads the folders from `DIR` instead of `evidence/`. With `--fixture DIR`, `--steps` reads only `DIR`. The E1 to E7 report reads only `runs/`.

## E2 package allowance

`residue/allowed.json` lists the package names that the operator allowed on a warm `sandbox` node. E2 treats an `h_extra` entry `pkg:<name> ...` as allowed when `<name>` is in the list. E2 passes when every extra entry is allowed and no agro file is beyond the noise floor. A missing file allows no package.

## Tests

`bash fixtures/test.sh` checks the earlier fixtures, `fixtures/steps/` (two lever sets and one run of an old hook revision), `fixtures/multi/` (the `--base` folder report with `runs/` and `runs-attribution/`), and the local part of the hook against `fixtures/hook/` (a fake `ssh` and an `archives.json` copy for tests only).
