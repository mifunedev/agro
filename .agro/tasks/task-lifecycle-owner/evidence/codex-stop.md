# Codex Stop hook evidence (US-003)

Result: Codex supports the `Stop` event. The `Stop` entry in `.codex/hooks.json` and the wrapper `.codex/hooks/task-next-stop.sh` stay.

## Installed version

```text
$ command codex --version
codex-cli 0.162.1
```

## Static evidence

- `command codex features list` prints `hooks  stable  true`. `.codex/config.toml` sets `[features] hooks = true`.
- The binary embeds the JSON schema `stop.command.input`. The required keys are `cwd`, `hook_event_name` (const `Stop`), `last_assistant_message`, `model`, `permission_mode`, `session_id`, `stop_hook_active`, `transcript_path`, and `turn_id`.
- The binary embeds the JSON schema `stop.command.output`. The keys are `continue`, `decision` (enum `block`), `reason`, `stopReason`, `suppressOutput`, and `systemMessage`. The `reason` description reads: "Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema."
- The binary also has a separate `SubagentStop` event, so a Codex subagent does not fire `Stop`.
- Codex runs a project hook only for a trusted project and a trusted hook. The binary holds the strings `Hooks need review`, `New hook - review required`, and `Trust all and continue`. `~/.codex/config.toml` stores the trust as `[hooks.state."<path>:<event>:<i>:<j>"] trusted_hash`. The `exec` flag `--dangerously-bypass-hook-trust` skips the hook trust for one invocation.

## Executed run

Fixture: a new git repository at `<scratchpad>/codex-stop-fixture` with `.codex/config.toml` (`model_reasoning_effort = "low"`, `[features] hooks = true`) and this `.codex/hooks.json`:

```json
{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash <fixture>/log-stop.sh"}]}]}}
```

`log-stop.sh` appends its stdin to `<scratchpad>/stop.log` and prints nothing.

Attempt 1 and attempt 2 did not load the project config. The header showed `reasoning effort: medium`, and `stop.log` stayed absent. The `hook: Stop` line came from the user-level tracing plugin hook.

```text
$ command codex exec "Reply with OK and nothing else."
$ command codex exec --dangerously-bypass-hook-trust -c 'projects."<fixture>".trust_level="trusted"' "Reply with OK and nothing else."
```

Attempt 3 trusted the fixture project for one invocation. Exit status 0.

```text
$ command codex exec --dangerously-bypass-hook-trust -c 'projects={"<fixture>"={trust_level="trusted"}}' "Reply with OK and nothing else."
reasoning effort: low
hook: SessionStart
hook: SessionStart Completed
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
```

The fixture `Stop` hook fired one time. `stop.log` holds one payload with these keys:

```text
cwd,hook_event_name,last_assistant_message,model,permission_mode,session_id,stop_hook_active,transcript_path,turn_id
```

Payload values: `hook_event_name` is `Stop`, `stop_hook_active` is `false`, `last_assistant_message` is `OK`, and `cwd` is the fixture path.

## Consequences

- The canonical hook reads `cwd` from the payload. Codex sends `cwd`, so the hook runs `next.sh` in the session directory.
- Codex accepts `{"decision":"block","reason":"..."}` per `stop.command.output`. This run did not execute a block, because the brief allowed one minimal run.
- In this repository, the operator trusts the new `Stop` hook one time in the Codex TUI. Until then, Codex does not run the hook.
