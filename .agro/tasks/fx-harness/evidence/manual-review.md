# fx manual review

Story US-005, task fx-harness, issue #1339.

The credential-free exe.dev run is in [exedev-validation.md](./exedev-validation.md). This file records the signed-in run. The exe.dev run has no credential and cannot show that behavior.

## Environment

- Location: the local AGRO sandbox.
- CLI: built from branch `feat/1339-fx-harness` with `npm --prefix .agro/cli run build`. The commands run it as `node .agro/cli/dist/agro.js` from the task worktree.
- fx session directory: `/home/sandbox/harness`, the main checkout. fx reads parent `AGENTS.md` files only up to the home directory.
- The operator approved the run. The operator signed in with `fx login` and `fx login codex` in a Herdr pane. This file records no credential.
- Exit status of the install: the pipe in the installer hides the status in zsh, because zsh does not set PIPESTATUS. The advisor re-ran the install and read exit status 0.

## Manual review steps

- Install exit status: zsh does not set PIPESTATUS, so the pipe in the installer hides the status. The advisor ran the install again and read exit status 0.

**A. Install and list**

1. Run `agro harness install fx`. Expected: the output ends with `fx: installed` and a docs link. Expected exit status: 0.
2. Run `fx --version`. Expected output: `0.0.13`. Expected exit status: 0.
3. Run `agro harness list`. Expected: the `fx` row shows `installable` and `yes`. Expected exit status: 0.

**B. Signed-in session**

Prerequisite: run `fx login` and `fx login codex` first.

1. Run `fx status --json` from `/home/sandbox/harness`. Expected: `"auth":"Codex subscription"` and `"workspace":"/home/sandbox/harness"`. Expected exit status: 0.
2. Run `fx ask` with the prompt in the transcript below. Expected: the answer quotes one rule from the root `AGENTS.md`, lists the skills, states one `git` entry, and reports no context-limit shortening. Expected exit status: 0.

**C. Cleanup**

1. Run `agro harness uninstall fx`. Expected exit status: 0.
2. Run `command -v fx`. Expected: no output. Expected exit status: 1.

The uninstall removes only the binary. The fx credentials in `~/.fx/` remain.

## Transcript

### Install

```text
$ node .agro/cli/dist/agro.js harness install fx
agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.
installing fx into the sandbox…
installed fx 0.0.13
/home/sandbox/.local/bin/fx
fx: installed — see https://github.com/mifunedev/agro/blob/main/docs/harnesses/fx.md for authentication
exit=0 (re-run to read the status; zsh does not set PIPESTATUS)
```

### Version

```text
$ fx --version
0.0.13
exit=0
```

### Harness list

```text
$ node .agro/cli/dist/agro.js harness list
agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.
HARNESS          KIND         INSTALLED
claude-code      installable  yes
codex            installable  yes
pi               installable  yes
opencode         installable  no
grok-build       installable  no
hermes           installable  no
muse-code        installable  no
antigravity-cli  installable  yes
fx               installable  yes
t3code           on-demand    no
exit=0
```

### Status

```text
$ cd /home/sandbox/harness && fx status --json
{"kind":"status","model":"gpt-6.1-sol","model_origin":"settings","model_source":"Codex subscription","update_channel":"stable","build_channel":"stable","build_revision":"4d966e272cfc","auth":"Codex subscription","connected_providers":["vercel-ai-gateway","codex"],"auth_refreshable":true,"permission_mode":"auto","workspace":"/home/sandbox/harness","history_turns":0,"session_permission_grants":0,"agent_step_limit":0,"ultrafast_requested":false,"mcp":{"connection_check":"not_checked","servers":[{"name":"debugmcp","source":"workspace","scope":"workspace","admission":"pending","required":false,"transport":"http","connection":"not_checked","authentication":"not_checked"}],"configuration_issues":[],"inspection_error":null}}
exit=0
```

### Ask

````text
$ cd /home/sandbox/harness && fx ask --no-save "Do not edit files or run commands. Answer from the context you already have. 1) Quote one rule from the root AGENTS.md word for word. 2) List every skill name in your skill catalog, one per line, exactly as the catalog shows it, including duplicates. 3) State how many catalog entries are named git. 4) State whether the skill catalog or any instruction file was shortened or omitted because of a context limit."
fx ask: skipped unapproved project MCP servers: debugmcp. Approve with fx mcp trust approve <name> before retrying.
1) Root `AGENTS.md` rule:

> Do not add explanatory comments to tracked code.

2) Skill names, in catalog order:

```text
agent-browser
architect
audit
builder
ci-status
cloudflared
compact-handoff
council
delegate
escalate
git
health-check
herdr
prd
prompt-miner
release
remote-sandbox
ste
supervisor
t3
typesafe-ai
worktrees
```

3) **1** catalog entry is named `git`.

4) The supplied context does not indicate any context-limit shortening or omission. I cannot verify omissions outside that context. The catalog contains skill metadata, not the full skill instruction files.exit=0

````

### Uninstall

```text
$ node .agro/cli/dist/agro.js harness uninstall fx
removing fx from /home/sandbox/.local…
fx: removed from /home/sandbox/.local
exit=0
$ command -v fx
exit=1
```

## Checks

- The quoted rule exists word for word in the root `AGENTS.md`. `grep -c 'Do not add explanatory comments to tracked code.' /home/sandbox/harness/AGENTS.md` printed 1.
- `.agro/skills/` holds 22 skill directories. Each directory has a `SKILL.md`. fx listed 22 names. Each name appears once. The names match the directory names.
- fx stated no context-limit shortening or omission.
- `fx ask` printed `skipped unapproved project MCP servers: debugmcp`. The skill catalog is not affected.

## Decision results

| Decision | Result | Basis |
|---|---|---|
| 1. Duplicate skills | `confirmed` | One `git` entry. No skill appears twice, so `.agents/skills` and `.claude/skills` add no duplicate. No follow-up issue for option B. |
| 2. Skill catalog budget | `confirmed` | fx reported no truncation. The docs omit `context_limits.skill_catalog_bytes`. |
