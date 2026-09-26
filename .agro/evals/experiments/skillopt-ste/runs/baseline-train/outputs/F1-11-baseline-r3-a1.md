# Repair a sandbox boot blocked by a security advisory

This runbook recovers an **existing** workspace volume. The boot of that volume
aborts because a package manifest runs a security audit as an install lifecycle
hook. This runbook does not delete or recreate the volume. The procedure edits
exactly one file, the workspace `package.json`. After the edit, a restart boots
the sandbox to completion.

This runbook applies to each workspace volume whose `package.json` still
carries `"pnpm:devPreinstall": "pnpm run security:audit"`. Every volume seeded
from `ghcr.io/mifunedev/agro:0.9.0` or `ghcr.io/mifunedev/agro:<second-tag>`
carries this hook. On 2026-09-08, `ghcr.io/mifunedev/agro:latest` resolved to
the same image id as `0.9.0`. That image id is `bbfdaf6bb8ca`, with digest tag
`sha-823aabbd…`. Thus a volume seeded from `latest` on or before 2026-09-08
also carries the hook. `latest` is a moving tag. A later release repoints
`latest`. This paragraph records a dated observation, not a standing property.

## What you see

`agro shell <name>` opens a container with no setup. Inside the container,
`systemctl status` reports this state:

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

`agro-cron.service` reports `Dependency failed`. `/tmp/pnpm-install.log`
ends with a `pnpm:devPreinstall` audit table that names an advisory. The log
then ends with this line:

```
 ELIFECYCLE  Command failed with exit code 1.
```

## Why the boot fails

The manifest connects the audit to a pnpm install lifecycle hook. pnpm runs
that hook on every `pnpm install`. The sandbox entrypoint runs
`pnpm install --prefer-offline` in two cases:

- `node_modules` is absent.
- The manifest fingerprint changed.

`pnpm audit` queries the live advisory database. If a new advisory covers a
pinned version, this sequence occurs:

1. The audit exits 1.
2. The hook fails.
3. The install fails.
4. The entrypoint aborts the boot.

`GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The `0.9.0` manifest
pins vitest `^3.2.6`. Thus every boot from that manifest fails. The boot
continues to fail while the advisory stands.

## Your data is safe and reachable

systemd is PID 1 in the sandbox. `agro-bootstrap.service` is `Type=oneshot`.
A failed oneshot does not stop PID 1. Thus the container stays `running`, and
`docker exec` still opens a shell as the `sandbox` user.

**Warning:** Do not delete the volume. Do not run `agro destroy`. Do not
recreate the sandbox. The recovery needs none of these actions, and each of
these actions loses state.

## Recovery needs operator action

Recovery is **not** automatic. A newer image does not repair an existing
volume. An upgrade boot never rewrites the workspace `package.json`. Thus the
hook survives the upgrade, and the new image fails the same way on that volume.
Run the procedure below once for each affected volume.

## Procedure

Run every command on the host. Replace `<name>` with the container name.

**1. Confirm the symptom.**

```bash
docker inspect --format '{{.State.Status}}' <name>            # expect: running
docker exec <name> systemctl is-failed agro-bootstrap.service   # expect: failed
docker exec <name> tail -3 /tmp/pnpm-install.log
```

**2. Delete the one hook that blocks the install.**

Run the following block exactly as written. If the manifest does not match the shape
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

**The block refuses, and changes nothing, in each of these cases:**

- `package.json` is a symlink or is not a regular file. The block does not
  follow the link. The block does not write through the link.
- `pnpm:devPreinstall` is absent. Your failure has a different cause.
- `pnpm:devPreinstall` holds a value other than `pnpm run security:audit`. An
  example is `pnpm run security:audit && ./my-checks.sh`. A key deletion
  destroys your command. The block does not parse, split, or partially rewrite
  a combined hook. Edit the combined hook yourself, then run the block again.

Each refusal exits `2` and leaves `package.json` byte-for-byte unchanged.

**3. Restart the sandbox.**

```bash
docker restart <name>
```

**4. Verify the boot.**

```bash
docker exec <name> systemctl is-active agro-bootstrap.service   # expect: active
docker exec <name> systemctl is-active agro-cron.service        # expect: active
```

`agro shell <name>` now opens a working sandbox.

## What the procedure preserves

An observation run on a volume seeded from the real published image recorded
this state. The run compared the state before the failed boot with the state
after the recovered boot.

| State | Result |
|-------|--------|
| Uncommitted change in the harness checkout | Preserved; content hash unchanged and `git status` still reports it modified |
| Task folders under the control-plane `tasks/` directory | Preserved; content hash unchanged |
| `~/.config/gh` credentials | Preserved; the host entry, user, and OAuth token do not change, and the file keeps mode `0600` |
| `.env` | Preserved; content hash unchanged and the file keeps mode `0600` |
| Your own keys and scripts inside `package.json` | Preserved; a custom `scripts` entry and a custom top-level key both survive intact, and the file keeps mode `0644`, its owner, and its inode |

The `gh` CLI normalizes `hosts.yml` on first use during boot. The CLI appends a
`users:` block for the account that `hosts.yml` already holds. The credential
values do not change. The file mode does not change.

## What the edit does to `package.json`

The step 2 block writes exactly one file, `package.json`. This section states
each effect of that write.

**The block keeps the mode, the owner, and the inode.** The block writes back
through the existing file with `cat "$tmp" > package.json`, not with `mv`. An
`mv` replacement gives the file the `0600` mode and the ownership of the
`mktemp` file. A recovery run recorded these values:

- Mode: `644` before and `644` after.
- Owner: `sandbox:sandbox` before and after.
- Inode: the same before and after.

**`jq` rewrites the whole file, so `jq` sets the formatting.** On the published
`0.9.0` manifest, this rewrite changes no formatting. `jq --indent 2 '.'`
round-trips that file byte for byte. A `diff` showed that the recovered file
differs from the original by exactly the one removed line.

If you reformatted your own `package.json`, `jq` changes the formatting. A
different indent, tabs, or a missing trailing newline are examples. `jq` writes
a two-space indent and a trailing newline. `jq` keeps the key order and every
value, including the keys and scripts that you added. After the edit, run
`git diff -- package.json` and read each change.

Step 2 writes nothing else. Step 3 restarts the sandbox. The boot now succeeds
and writes the same state as any successful boot:

- `node_modules` appears because the install completes.
- `gh` normalizes `hosts.yml` as the previous section states. The host entry,
  user, and OAuth token do not change. The file keeps mode `0600`.

## After recovery

The hook removal restores the boot. The hook removal does not remove the
vulnerable dependency. Update the checkout to a source revision that pins
vitest `>=4.1.11`. The current source makes three changes:

- The source removes the hook.
- The source pins vitest `^4.1.11`.
- The source runs `pnpm run security:audit` as an explicit CI step and an
  explicit release step.

The probe
[`.agro/evals/probes/pnpm-audit-ci-gate.sh`](../.agro/evals/probes/pnpm-audit-ci-gate.sh)
checks this CI step.

## Scope

This runbook repairs an existing seeded volume only. This runbook does not
repair a published image. The `0.9.0` build has image id `bbfdaf6bb8ca` and the
tag `sha-823aabbd…`. That build carries the hook in
`/opt/agro-seed/package.json`, and nobody can edit that build. A cold boot
that seeds a fresh volume from that build fails on first boot. That volume
needs this same procedure or an image from a later release.

`latest` is a moving tag. On 2026-09-08, `latest` resolved to that same build.
Before you assume either result, check what `latest` resolves to:

```bash
docker pull ghcr.io/mifunedev/agro:latest
docker run --rm --entrypoint bash ghcr.io/mifunedev/agro:latest \
  -c 'jq -r ".scripts[\"pnpm:devPreinstall\"] // \"absent\"" /opt/*-seed/package.json'
```

If the command prints `absent`, that image cold-boots and needs nothing from
this runbook.
[`release-requirements-1019-boot-fix.md`](release-requirements-1019-boot-fix.md)
lists the requirements for a fixed release.

The probe
[`.agro/evals/probes/sandbox-boot-advisory-recovery.sh`](../.agro/evals/probes/sandbox-boot-advisory-recovery.sh)
guards the recovery path.
