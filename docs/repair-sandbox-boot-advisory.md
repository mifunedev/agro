# Repair a sandbox boot blocked by a security advisory

This runbook recovers an **existing** workspace volume whose boot aborts because
a package manifest runs a security audit as an install lifecycle hook. It does
not delete or recreate the volume. The edit it asks you to make touches exactly
one file, the workspace `package.json`; the restart that follows then boots the
sandbox normally.

Applies to any workspace volume whose `package.json` still carries
`"pnpm:devPreinstall": "pnpm run security:audit"`. Every volume seeded from
`ghcr.io/mifunedev/openharness:0.9.0` or `ghcr.io/mifunedev/agro:0.9.0` carries
it. As of 2026-09-08, `ghcr.io/mifunedev/agro:latest` resolved to the same image
id as `0.9.0` (`bbfdaf6bb8ca`, digest tag `sha-823aabbd…`), so volumes seeded
from `latest` on or before that date carry it too. `latest` is a moving tag: a
later release repoints it, and this paragraph is a dated observation, not a
standing property.

## What you see

`agro shell <name>` gives you a container with nothing set up. Inside it:

```
systemctl status openharness-bootstrap.service
× openharness-bootstrap.service - Open Harness sandbox bootstrap
     Active: failed (Result: exit-code)
    Process: 53 ExecStart=/usr/local/bin/entrypoint.sh (code=exited, status=1/FAILURE)
```

The boot log ends with this exact line:

```
[entrypoint] pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot
```

`openharness-cron.service` reports `Dependency failed`. `/tmp/pnpm-install.log`
ends with a `pnpm:devPreinstall` audit table naming an advisory, then:

```
 ELIFECYCLE  Command failed with exit code 1.
```

## Why it happens

The manifest wires the audit to a pnpm install lifecycle hook. pnpm runs that
hook on every `pnpm install`. The sandbox entrypoint runs
`pnpm install --prefer-offline` whenever `node_modules` is absent or the
manifest fingerprint changed. `pnpm audit` queries the live advisory database.
When a new advisory covers a pinned version, the audit exits 1, the hook fails,
the install fails, and the entrypoint aborts the boot.

`GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The `0.9.0` manifest pins
vitest `^3.2.6`, so a boot from that manifest fails every time, and will keep
failing for as long as the advisory stands.

## Your data is safe and reachable

systemd is PID 1 in the sandbox. `openharness-bootstrap.service` is
`Type=oneshot`. A failed oneshot does not stop PID 1, so the container stays
`running` and `docker exec` still reaches a shell as the `sandbox` user.

Do not delete the volume. Do not run `agro destroy`. Do not recreate the
sandbox. None of that is needed, and all of it loses state.

## Recovery needs operator action

Recovery is **not** automatic. A newer image does not repair an existing
volume: an upgrade boot never rewrites the workspace's own `package.json`, so
the hook survives the upgrade and the new image fails the same way on that
volume. Run the procedure below once per affected volume.

## Procedure

Run every command on the host. Replace `<name>` with the container name.

**1. Confirm the symptom.**

```bash
docker inspect --format '{{.State.Status}}' <name>            # expect: running
docker exec <name> systemctl is-failed openharness-bootstrap.service   # expect: failed
docker exec <name> tail -3 /tmp/pnpm-install.log
```

**2. Delete the one hook that blocks the install.**

Run this block exactly as written. It refuses rather than guessing whenever the
manifest is not the shape this procedure repairs.

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

**It refuses, and changes nothing, when:**

- `package.json` is a symlink or is not a regular file. The block does not
  follow the link and does not write through it.
- `pnpm:devPreinstall` is absent. The failure you are looking at is not this one.
- `pnpm:devPreinstall` holds anything other than `pnpm run security:audit` — for
  example `pnpm run security:audit && ./my-checks.sh`. Deleting the key would
  destroy your command. The block will not parse, split, or partially rewrite a
  combined hook. Resolve it yourself, then re-run.

Each refusal exits `2` and leaves `package.json` byte-for-byte unchanged.

**3. Restart the sandbox.**

```bash
docker restart <name>
```

**4. Verify the boot.**

```bash
docker exec <name> systemctl is-active openharness-bootstrap.service   # expect: active
docker exec <name> systemctl is-active openharness-cron.service        # expect: active
```

`agro shell <name>` now works.

## What the procedure preserves

Verified by observation on a volume seeded from the real published image,
before the failed boot and after the recovered boot:

| State | Result |
|-------|--------|
| Uncommitted change in the harness checkout | Preserved; content hash unchanged and `git status` still reports it modified |
| Task folders under the control-plane `tasks/` directory | Preserved; content hash unchanged |
| `~/.config/gh` credentials | Preserved; the host entry, user, and OAuth token are unchanged, and the file keeps mode `0600` |
| `.env` | Preserved; content hash unchanged and the file keeps mode `0600` |
| Your own keys and scripts inside `package.json` | Preserved; a custom `scripts` entry and a custom top-level key both survive intact, and the file keeps mode `0644`, its owner, and its inode |

The `gh` CLI normalizes `hosts.yml` on first use during boot: it appends a
`users:` block for the already-present account. The credential values do not
change and the mode does not change.

## What the edit does to `package.json`

Step 2's block writes exactly one file, `package.json`. Be precise about it.

**Mode, owner, and inode are preserved.** The block writes back through the
existing file with `cat "$tmp" > package.json` rather than `mv`. Replacing the
file with `mv` would hand it `mktemp`'s `0600` mode and `mktemp`'s ownership.
Observed across a recovery: mode `644` before and `644` after, owner
`sandbox:sandbox` before and after, same inode.

**`jq` rewrites the whole file, so formatting is `jq`'s.** On the published
`0.9.0` manifest that costs nothing: `jq --indent 2 '.'` round-trips that file
byte for byte, so the recovered file differs from the original by exactly the
one removed line, verified by `diff`. If you have reformatted your own
`package.json` — a different indent, tabs, no trailing newline — `jq` normalises
it to two-space indent with a trailing newline. Key order and every value are
preserved, including keys and scripts you added yourself. Run
`git diff -- package.json` after the edit and read what changed.

That is all step 2 writes. Step 3 then restarts the sandbox, and a boot that now
succeeds writes state as any normal boot does: `node_modules` appears because
the install completes, and `gh` normalises `hosts.yml` as described above — the
host entry, user, and OAuth token are unchanged, and the file keeps mode `0600`.

## After recovery

Removing the hook restores the boot. It does not remove the vulnerable
dependency. Update the checkout to a source revision that pins vitest
`>=4.1.11`. Current source removes the hook, pins vitest `^4.1.11`, and runs
`pnpm run security:audit` as an explicit CI and release step instead — see
[`.agro/evals/probes/pnpm-audit-ci-gate.sh`](../.agro/evals/probes/pnpm-audit-ci-gate.sh).

## Scope

This runbook repairs an existing seeded volume only. It does not repair a
published image. The `0.9.0` build — image id `bbfdaf6bb8ca`, also tagged
`sha-823aabbd…` — carries the hook in `/opt/oh-seed/package.json`, and that
build cannot be edited. A cold boot that seeds a fresh volume from it fails on
first boot and needs this same procedure, or an image from a later release.

`latest` is a moving tag. As of 2026-09-08 it resolved to that same build, so
check what `latest` resolves to before assuming either way:

```bash
docker pull ghcr.io/mifunedev/agro:latest
docker run --rm --entrypoint bash ghcr.io/mifunedev/agro:latest \
  -c 'jq -r ".scripts[\"pnpm:devPreinstall\"] // \"absent\"" /opt/*-seed/package.json'
```

`absent` means that image cold-boots and needs nothing from this runbook. What
a fixed release requires is in
[`release-requirements-1019-boot-fix.md`](release-requirements-1019-boot-fix.md).

The recovery path is guarded by
[`.agro/evals/probes/sandbox-boot-advisory-recovery.sh`](../.agro/evals/probes/sandbox-boot-advisory-recovery.sh).
