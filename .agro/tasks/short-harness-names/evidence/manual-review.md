# Manual review: short canonical harness names

The advisor ran each command in the task worktree on branch
`feat/1529-short-harness-names` at `478879e6`, inside the sandbox
`agro-sbx-local`. The CLI is the build from `pnpm run build:harness`, which
exited 0. No command created a resource.

## 1. List the harnesses

```console
$ node .agro/cli/dist/agro.js harness list
HARNESS      KIND         INSTALLED
claude       installable  yes
codex        installable  yes
pi           installable  yes
opencode     installable  no
openclaw     installable  no
grok         installable  no
hermes       installable  no
muse         installable  no
antigravity  installable  yes
fx           installable  no
prime-agent  installable  no
t3code       on-demand    no
[exit 0]
```

## 2. Use each supported name

```console
$ node .agro/cli/dist/agro.js harness status grok-build
HARNESS  KIND         INSTALLED
grok     installable  no
[exit 0]
$ node .agro/cli/dist/agro.js harness status agy
HARNESS      KIND         INSTALLED
antigravity  installable  yes
[exit 0]
$ node .agro/cli/dist/agro.js harness status antigravity-cli
HARNESS      KIND         INSTALLED
antigravity  installable  yes
[exit 0]
$ node .agro/cli/dist/agro.js harness status muse-code
HARNESS  KIND         INSTALLED
muse     installable  no
[exit 0]
```

No supported name prints a deprecation line.

## 3. Use the deprecated alias

```console
$ node .agro/cli/dist/agro.js harness status claude-code
agro harness: "claude-code" is a deprecated alias for "claude"; the alias stops working in 0.29.0
HARNESS  KIND         INSTALLED
claude   installable  yes
[exit 0]
```
