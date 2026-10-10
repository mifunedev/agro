# fx exe.dev validation

Story US-002, task fx-harness, issue #1339.

## Run header

- Provider: exedev
- VM name: agro-mx-1004-221636
- Image: `ghcr.io/mifunedev/agro:latest`
- Date: 2026-10-05T04:16:36Z (run log header, UTC)
- Log path: `/tmp/claude-1000/-home-sandbox-harness/0a55622b-77fb-4c4c-be7d-7f3e5a219533/scratchpad/matrix/exedev-fx-harness-20261004-221636.log`
- Driver command, started in tmux session `rs-fx`:

```bash
IMAGE=ghcr.io/mifunedev/agro:latest bash .agro/skills/remote-sandbox/scripts/run.sh exedev .agro/tasks/fx-harness/checks/fx-harness.sh
```

Image reference: ghcr.io/mifunedev/agro:latest at 2026-10-05T04:16:36Z. The operator accepted the tag and the run time in place of the image digest.

## Result lines

```text
RESULT X0-workspace PASS .agents/skills -> /home/sandbox/harness/.agro/skills
RESULT X1-install PASS rc=0 version=v0.0.13
RESULT X2-version PASS 0.0.13 
RESULT X3-binary-path PASS /home/sandbox/.local/bin/fx
RESULT X4-status INFO rc=0 bytes=766
RESULT X5-doctor INFO rc=0 bytes=1278
RESULT X6-instructions INFO fx status and fx doctor name no instruction files
RESULT X7-skills INFO fx status and fx doctor list no skills
RESULT X8-uninstall PASS command -v fx rc=1
SUMMARY fails=0
remaining agro-matrix resources on exedev: 0
RUN DONE
```

## Raw JSON

```json
{"kind":"status","model":"spacexai/grok-4.7","model_origin":"default","update_channel":"stable","build_channel":"stable","build_revision":"4d966e272cfc","auth":"missing","auth_refreshable":false,"auth_help":"fx needs access to Vercel AI Gateway. Run fx login to sign in, fx setup to use an API key, or set AI_GATEWAY_API_KEY.","permission_mode":"auto","workspace":"/home/sandbox/harness","history_turns":0,"session_permission_grants":0,"agent_step_limit":0,"ultrafast_requested":false,"mcp":{"connection_check":"not_checked","servers":[{"name":"debugmcp","source":"workspace","scope":"workspace","admission":"pending","required":false,"transport":"http","connection":"not_checked","authentication":"not_checked"}],"configuration_issues":[],"inspection_error":null}}
{"kind":"doctor","ok_count":3,"warn_count":4,"fail_count":1,"workspace":"/home/sandbox/harness","model":"spacexai/grok-4.7","auth":"missing","auth_refreshable":false,"permission_mode":"auto","agent_step_limit":0,"checks":[{"name":"workspace","status":"ok","detail":"using workspace /home/sandbox/harness"},{"name":"config","status":"warn","detail":"no config files found; using defaults and env overrides"},{"name":"auth","status":"fail","detail":"fx needs access to Vercel AI Gateway. Run fx login to sign in, fx setup to use an API key, or set AI_GATEWAY_API_KEY."},{"name":"startup","status":"ok","detail":"resolved model=spacexai/grok-4.7, permission_mode=auto, agent_step_limit=0"},{"name":"state","status":"warn","detail":"durable state is not initialized"},{"name":"sessions","status":"warn","detail":"no saved sessions yet"},{"name":"git","status":"warn","detail":"not a git repository; pr/issue workflows will be limited"},{"name":"gh","status":"ok","detail":"GitHub CLI found in PATH"}],"mcp":{"connection_check":"not_checked","servers":[{"name":"debugmcp","source":"workspace","scope":"workspace","admission":"pending","required":false,"transport":"http","connection":"not_checked","authentication":"not_checked"}],"configuration_issues":[],"inspection_error":null}}
```

## Findings

Rows X0, X1, X2, X3, and X8 pass. The `fx --version` command prints `0.0.13` for pin `v0.0.13`.

The `fx status --json` and `fx doctor --json` commands report neither instruction files nor skills. US-005 takes Decision 1 (duplicate skills) as `deferred to US-005`. US-005 takes Decision 2 (skill catalog budget) as `deferred to US-005`.

No follow-up issue exists for Decision 1 option B. Row X7 reported no skill list, so no duplicate count exists.

Without credentials, fx reports default model `spacexai/grok-4.7`, `permission_mode` `auto`, and `auth` `missing`. Fx discovered the workspace MCP server `debugmcp` with `admission` `pending`. Fx reads the project MCP configuration. The `fx doctor` command reports the image-seed workspace as "not a git repository".
