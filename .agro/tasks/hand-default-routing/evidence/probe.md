# Probe (US-001), 2026-11-14

## Brain agro-supervisor
```
docker active: inactive
docker server: 
kvm: crw-rw---- 1 root kvm 10, 232 Nov 12 14:56 /dev/kvm
msb: msb 0.7.13
groups: exedev adm dialout cdrom floppy sudo audio dip video plugdev docker kvm
agro run — Run a command in an ephemeral container

Usage:
  agro run [--isolation container|microvm] [--image <ref>] [--sandbox <name>] -- <command...>
```

## Hand agro-sbx-dev-001
```
docker active: active
docker server: 29.1.3
kvm: crw-rw---- 1 root kvm 10, 232 Nov  9 01:03 /dev/kvm
msb: msb 0.7.13
groups: exedev adm dialout cdrom floppy sudo audio dip video plugdev docker kvm
agro run — Run a command in an ephemeral container

Usage:
  agro run [--isolation container|microvm] [--image <ref>] [--sandbox <name>] -- <command...>
```

## agro hands list --json (brain)
```
[{"name":"agro-sbx-dev-001","status":"running","sshHost":"agro-sbx-dev-001.exe.xyz"}]
```
## microVM smoke
```
brain: agro run --isolation microvm -- true -> exit 0
hand: agro run --isolation microvm -- true -> exit 0
```
