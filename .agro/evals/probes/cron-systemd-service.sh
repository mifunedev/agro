#!/usr/bin/env bash
# tier: A
# source: issue #956 (systemd PID 1; cron supervision leaves tmux) 2026-09-04
# desc: systemd supervises cron-runtime.ts directly via agro-cron.service, and the retired cron-watchdog / cron-system tmux supervision is gone from every active boot, health, and maintenance path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UNIT="$ROOT/.devcontainer/agro-cron.service"
BOOTSTRAP="$ROOT/.devcontainer/agro-bootstrap.service"
DOCKERFILE="$ROOT/.devcontainer/Dockerfile"
ENTRYPOINT="$ROOT/.devcontainer/entrypoint.sh"
HEALTHCHECK="$ROOT/.agro/scripts/sandbox-healthcheck.sh"
RUNTIME="$ROOT/.agro/scripts/cron-runtime.ts"

for file in "$UNIT" "$BOOTSTRAP" "$DOCKERFILE" "$ENTRYPOINT" "$HEALTHCHECK" "$RUNTIME"; do
  [[ -f "$file" ]] || { echo "SKIPPED: required file absent: $file" >&2; exit 2; }
done

missing=()

grep -qF "ExecStart=/usr/local/bin/node --experimental-strip-types /home/sandbox/harness/.agro/scripts/cron-runtime.ts" "$UNIT" \
  || missing+=("agro-cron.service must ExecStart cron-runtime.ts under node --experimental-strip-types from .agro/")
grep -qE '^User=sandbox$' "$UNIT" || missing+=("agro-cron.service must run as User=sandbox")
grep -qE '^WorkingDirectory=/home/sandbox/harness$' "$UNIT" \
  || missing+=("agro-cron.service must set WorkingDirectory=/home/sandbox/harness — CRONS_DIR is cwd-relative")
grep -qE '^Restart=on-failure$' "$UNIT" || missing+=("agro-cron.service must set Restart=on-failure")
grep -qE '^RestartSec=' "$UNIT" || missing+=("agro-cron.service must set RestartSec=")
grep -qE '^StartLimitIntervalSec=' "$UNIT" && grep -qE '^StartLimitBurst=' "$UNIT" \
  || missing+=("agro-cron.service must bound its restart loop with StartLimitIntervalSec/StartLimitBurst — at RestartSec=5 the systemd defaults never trip, so a permanent failure such as 'another instance is running' would retry forever instead of surfacing as a failed unit")
grep -qF 'ExecReload=/bin/kill -HUP $MAINPID' "$UNIT" \
  || missing+=("agro-cron.service ExecReload must send SIGHUP to the main PID")
grep -qE '^Requires=agro-bootstrap.service$' "$UNIT" \
  || missing+=("agro-cron.service must Require agro-bootstrap.service")
grep -qE '^After=agro-bootstrap.service$' "$UNIT" \
  || missing+=("agro-cron.service must be ordered After agro-bootstrap.service")
grep -qE '^KillMode=process$' "$UNIT" \
  || missing+=("agro-cron.service must use KillMode=process so a scheduler restart never kills the shared tmux server or in-flight fires")
grep -qE '^WantedBy=multi-user.target$' "$UNIT" || missing+=("agro-cron.service must be WantedBy=multi-user.target")

grep -qF 'systemctl enable agro-bootstrap.service agro-cron.service' "$DOCKERFILE" \
  || missing+=("Dockerfile must enable both AGRO units in the image")
grep -qF 'COPY .devcontainer/agro-bootstrap.service .devcontainer/agro-cron.service /usr/lib/systemd/system/' "$DOCKERFILE" \
  || missing+=("Dockerfile must install both unit files into /usr/lib/systemd/system/")

grep -qF 'systemctl mask cron.service' "$DOCKERFILE" \
  || missing+=("Dockerfile must mask the Debian cron.service so no second scheduler runs")
grep -qF 'ssh.service ssh.socket' "$DOCKERFILE" \
  || missing+=("Dockerfile must mask distro ssh units so they cannot bypass the entrypoint's access.ssh gate")

grep -qF 'require_unit agro-cron.service' "$HEALTHCHECK" \
  || missing+=("sandbox-healthcheck.sh must treat agro-cron.service state as scheduler liveness")
grep -qF 'require_unit agro-bootstrap.service' "$HEALTHCHECK" \
  || missing+=("sandbox-healthcheck.sh must require the bootstrap oneshot")

grep -qF 'tmuxSessionName' "$RUNTIME" \
  || missing+=("cron-runtime.ts lost per-fire tmux session naming — this issue retires scheduler tmux, not tmux: true fires")

for token in cron-watchdog cron-system CRON_WATCHDOG_INTERVAL; do
  for file in "$ENTRYPOINT" "$HEALTHCHECK" "$UNIT" "$BOOTSTRAP"; do
    if grep -qF "$token" "$file"; then
      missing+=("retired token '$token' still present in ${file#"$ROOT"/}")
    fi
  done
done

if [[ -e "$ROOT/.agro/evals/probes/cron-watchdog.sh" ]]; then
  missing+=("the retired cron-watchdog probe is back — its subject no longer exists")
fi
if [[ -e "$ROOT/.agro/scripts/maintenance/restart-agro-tmux.sh" ]]; then
  missing+=("the retired tmux restart runbook is back — it recreated the scheduler sessions")
fi

if (( ${#missing[@]} )); then
  printf 'REGRESSION: systemd cron supervision contract broken:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: agro-cron.service supervises cron-runtime.ts as sandbox with SIGHUP reload and on-failure restart, both units are enabled, distro cron/ssh are masked, health reads systemd, and no cron-watchdog or scheduler-level cron-system tmux supervision remains" >&2
exit 0
