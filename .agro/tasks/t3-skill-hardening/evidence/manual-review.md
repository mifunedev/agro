# Manual review: T3 skill hardening

The worker ran each command below in the worktree `.worktrees/skill/t3-skill-hardening`. No command started a real `t3`, `tmux`, `tailscale`, or `herdr` process. No command stopped or restarted the `agent-t3code` or `agent-tailscaled` tmux sessions. Each pairing token shows as `<token>`.

## `bash .agro/skills/t3/scripts/t3-code.sh help`

Exit status: 0.

```text
Usage: t3-code.sh [start|status|url|pair|logs|stop|attach|doctor|help] [options]

Actions:
  start    Run the preflight, then start `t3 serve` in tmux, or report the existing session (default)
  status   Show session status and recent output
  url      Print the latest pairing URL found in the log/pane
  pair     Mint a fresh pairing URL against the already-running server (no restart)
  logs     Print recent log lines
  stop     Kill the tmux session
  attach   Print the tmux attach command (does not attach)
  doctor   Run the preflight checks and report actionable errors
  help     Show this help

Options:
  --session <name>       tmux session name (default: agent-t3code)
  --port <port>          expected T3 Code port (default: 3773)
  --log <path>           log path (default: /tmp/<session>.log)
  --tailscale            publish over Tailscale Serve (HTTPS on the tailnet)
  --tailscale-port <p>   alternate Tailscale Serve HTTPS port (default: 443)
```

## Red run before the fix

The worker ran `pnpm vitest run .agro/scripts/__tests__/t3-code.test.ts` against the unmodified `t3-code.sh` at `70e0c5f5`. Exit status: 1. Four tests failed. The test for `start` without `--tailscale` passed, because that behavior does not change.

```text
     × start launches t3 serve without HERDR_* variables 36ms
     × start --tailscale launches t3 serve without HERDR_* variables 32ms
     × pair runs t3 pair without HERDR_* variables 42ms
     × start --tailscale runs t3 pair once and reports the tailnet URL with the QR output 35ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  .agro/scripts/__tests__/t3-code.test.ts > t3-code.sh Herdr environment > start launches t3 serve without HERDR_* variables
 FAIL  .agro/scripts/__tests__/t3-code.test.ts > t3-code.sh Herdr environment > start --tailscale launches t3 serve without HERDR_* variables
AssertionError: expected 'HERDR_PANE_ID\nHERDR_ENV\nHERDR_TAB_I…' to be '' // Object.is equality
 FAIL  .agro/scripts/__tests__/t3-code.test.ts > t3-code.sh Herdr environment > pair runs t3 pair without HERDR_* variables
AssertionError: expected 'HERDR_PANE_ID\nHERDR_ENV\nHERDR_TAB_I…' to be '' // Object.is equality
 FAIL  .agro/scripts/__tests__/t3-code.test.ts > t3-code.sh pairing URL > start --tailscale runs t3 pair once and reports the tailnet URL with the QR output
AssertionError: expected null to be '--yes t3 pair --tailscale\n' // Object.is equality
      Tests  4 failed | 1 passed (5)
```

## `pnpm vitest run .agro/scripts/__tests__/t3-code.test.ts` after the fix

Exit status: 0.

```text

 RUN  v4.1.11 /home/sandbox/harness/.worktrees/skill/t3-skill-hardening


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  10:08:50
   Duration  595ms (transform 23ms, setup 0ms, import 36ms, tests 207ms, environment 0ms)

```
