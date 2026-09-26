# Repair a sandbox boot blocked by a security advisory

This runbook recovers an **existing** workspace volume. The boot of that volume
aborts because a package manifest runs a security audit as an install lifecycle
hook. The runbook does not delete the volume and does not recreate the volume.
The procedure edits exactly one file: the workspace `package.json`. After the
edit, the operator restarts the sandbox, and `agro-bootstrap.service` reaches
`active`.

This runbook applies to each workspace volume whose `package.json` still
carries `"pnpm:devPreinstall": "pnpm run security:audit"`. Every volume seeded
from `ghcr.io/mifunedev/agro:0.9.0` or `ghcr.io/mifunedev/agro:<second-tag>`
carries this hook. On 2026-09-08, `ghcr.io/mifunedev/agro:latest` resolved to
the same image id as `0.9.0` (`bbfdaf6bb8ca`, digest tag `sha-823aabbd…`).
Thus every volume seeded from `latest` on or before that date also carries the
hook. `latest` is a moving tag, and a later release repoints `latest`. This
paragraph records a dated observation, not a standing property.

## What you see

`agro shell <name>` opens a container with no setup complete. Inside that
container, `systemctl status` reports this output:

```
systemctl status agro-bootstrap.service
× agro-bootstrap.service - AGRO sandbox bootstrap
     Active: failed (Result: exit-code)
    Process: 53 ExecStart=/usr/local/bin/entrypoint.sh (code=exited, status=1/FAILURE)
```

The boot log ends with this exact line:

```
[entrypoint] pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot
```

`agro-cron.service` reports `Dependency failed`. `/tmp/pnpm-install.log` ends
with a `pnpm:devPreinstall` audit table. The table names an advisory. The log
then ends with this line:

```
 ELIFECYCLE  Command failed with exit code 1.
```

## Why it happens

The manifest wires the audit to a pnpm install lifecycle hook. pnpm runs that
hook on every `pnpm install`. The sandbox entrypoint runs
`pnpm install --prefer-offline` in two cases: `node_modules` is absent, or the
manifest fingerprint changed. `pnpm audit` queries the live advisory database.
If a new advisory covers a pinned version, this chain follows:

1. The audit exits with code 1.
2. The hook fails.
3. The install fails.
4. The entrypoint aborts the boot.

`GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The `0.9.0` manifest pins
vitest `^3.2.6`. Thus every boot from that manifest fails while the advisory
stands.

## Your data is safe and reachable

systemd is PID 1 in the sandbox. `agro-bootstrap.service` is `Type=oneshot`. A
failed oneshot does not stop PID 1. Thus the container stays `running`, and
`docker exec` still reaches a shell as the `sandbox` user.

Do not delete the volume. Do not run `agro destroy`. Do not recreate the
sandbox. The recovery needs none of these actions, and each action loses state.

## Recovery needs operator action

Recovery is **not** automatic. A newer image does not repair an existing
volume. An upgrade boot never rewrites the workspace's own `package.json`. Thus
the hook survives the upgrade, and the new image fails the same way on that
volume. Run the procedure below once for each affected volume.

## Procedure

Run every command on the host. Replace `<name>` with the container name.

**1. Confirm the symptom.**

```bash
docker inspect --format '{{.State.Status}}' <name>            # expect: running
docker exec <name> systemctl is-failed agro-bootstrap.service   # expect: failed
docker exec <name> tail -3 /tmp/pnpm-install.log
```

**2. Delete the one hook that blocks the install.**

Run the block below exactly as written. If the manifest does not match the shape
that this procedure repairs, the block refuses and does not guess.

```bash
docker exec -i -u sandbox <name> bash -s <<'RECOVER'
set -eu
cd "$HOME/harness"
expected='pnpm run security:audit'
[ -f package.json ] && [ ! -L package.json ] || {
  echo "refusing: $PWD/package.json is not a regular file — resolve that before retrying" >&2; exit 2; }
found=$(jq -r '.scripts["pnpm:devPreinstall"] // ""' package.json)
[ -n "$found" ] || {
  echo "refusing: package.json declares no pnpm:devPreinstall hook — this procedure does not apply" >&2; exit 2; }
[ "$found" = "$expected" ] || {
  echo "refusing: pnpm:devPreinstall is '$found', not '$expected' — it carries logic of your own; remove or relocate that yourself" >&2; exit 2; }
tmp=$(mktemp -p .)
jq --indent 2 'del(.scripts["pnpm:devPreinstall"])' package.json > "$tmp"
[ -s "$tmp" ]
cat "$tmp" > package.json
rm -f "$tmp"
RECOVER
```

**The block refuses, and changes nothing, in these cases:**

- `package.json` is a symlink or is not a regular file. The block does not
  follow the link and does not write through the link.
- `pnpm:devPreinstall` is absent. In this case, the failure has a different
  cause, and this runbook does not apply.
- `pnpm:devPreinstall` holds a value other than `pnpm run security:audit`. An
  example is `pnpm run security:audit && ./my-checks.sh`. A deletion of the key
  would destroy your command. The block does not parse, split, or partially
  rewrite a combined hook. Resolve the combined hook yourself, then run the
  block again.

Each refusal exits with code `2`. Each refusal leaves `package.json` byte for
byte unchanged.

**3. Restart the sandbox.**

```bash
docker restart <name>
```

**4. Verify the boot.**

```bash
docker exec <name> systemctl is-active agro-bootstrap.service   # expect: active
docker exec <name> systemctl is-active agro-cron.service        # expect: active
```

The result: `agro shell <name>` now opens a working sandbox.

## What the procedure preserves

The table records observations on a volume seeded from the real published
image. The observations compare the state before the failed boot with the state
after the recovered boot:

| State | Result |
|-------|--------|
| Uncommitted change in the harness checkout | Preserved; content hash unchanged and `git status` still reports it modified |
| Task folders under the control-plane `tasks/` directory | Preserved; content hash unchanged |
| `~/.config/gh` credentials | Preserved; the host entry, user, and OAuth token stay unchanged, and the file keeps mode `0600` |
| `.env` | Preserved; content hash unchanged and the file keeps mode `0600` |
| Your own keys and scripts inside `package.json` | Preserved; a custom `scripts` entry and a custom top-level key both survive intact, and the file keeps mode `0644`, its owner, and its inode |

The `gh` CLI normalizes `hosts.yml` on first use during boot. The CLI appends a
`users:` block for the account that `hosts.yml` already holds. The credential
values do not change, and the mode does not change.

## What the edit does to `package.json`

The step 2 block writes exactly one file: `package.json`.

**The block keeps the mode, owner, and inode.** The block writes back through
the existing file with `cat "$tmp" > package.json`. The block does not use `mv`.
A replacement with `mv` would give `package.json` the `0600` mode and the
ownership of the `mktemp` file. One recovery showed these values:

- mode `644` before and `644` after
- owner `sandbox:sandbox` before and after
- the same inode before and after

**`jq` rewrites the whole file, so `jq` sets the format.** On the published
`0.9.0` manifest, this rewrite changes nothing else. `jq --indent 2 '.'`
round-trips that file byte for byte. Thus the recovered file differs from the
original file by exactly the one removed line. A `diff` run confirmed this
result.

If you reformatted your own `package.json`, `jq` normalizes the format. Examples
of a different format are a different indent, tabs, or no trailing newline. `jq`
writes a two-space indent and a trailing newline. `jq` keeps the key order and
every value, including keys and scripts that you added. After the edit, run
`git diff -- package.json` and read each change.

Step 2 writes nothing else. Step 3 restarts the sandbox. The boot now succeeds,
and the boot writes state like any successful boot:

- The install completes, so `node_modules` appears.
- `gh` normalizes `hosts.yml` as the previous section describes. The host
  entry, user, and OAuth token stay unchanged, and the file keeps mode `0600`.

## After recovery

The removal of the hook restores the boot. The removal does not remove the
vulnerable dependency. Update the checkout to a source revision that pins vitest
`>=4.1.11`. The current source removes the hook and pins vitest `^4.1.11`. The
current source runs `pnpm run security:audit` as an explicit CI step and an
explicit release step. See
[`.agro/evals/probes/pnpm-audit-ci-gate.sh`](../.agro/evals/probes/pnpm-audit-ci-gate.sh).

## Scope

This runbook repairs an existing seeded volume only. This runbook does not
repair a published image. The `0.9.0` build has image id `bbfdaf6bb8ca` and the
tag `sha-823aabbd…`. That build carries the hook in
`/opt/agro-seed/package.json`, and nobody can edit that build. A cold boot can
seed a fresh volume from that build. That cold boot fails on the first boot. The
fix is this same procedure or an image from a later release.

`latest` is a moving tag. On 2026-09-08, `latest` resolved to that same build.
Before you assume either result, check the build that `latest` resolves to:

```bash
docker pull ghcr.io/mifunedev/agro:latest
docker run --rm --entrypoint bash ghcr.io/mifunedev/agro:latest \
  -c 'jq -r ".scripts[\"pnpm:devPreinstall\"] // \"absent\"" /opt/*-seed/package.json'
```

If the command prints `absent`, that image cold-boots, and this runbook does
not apply. For the requirements of a fixed release, read
[`release-requirements-1019-boot-fix.md`](release-requirements-1019-boot-fix.md).

The probe
[`.agro/evals/probes/sandbox-boot-advisory-recovery.sh`](../.agro/evals/probes/sandbox-boot-advisory-recovery.sh)
guards the recovery path.
