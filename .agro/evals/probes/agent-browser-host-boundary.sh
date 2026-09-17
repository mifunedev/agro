#!/usr/bin/env bash
# tier: A
# source: #1078 — agent-browser became host-installable. The opt-out it replaced existed
#         because `agent-browser install --with-deps` drives the operating system package
#         manager. Host installs must never do that, whatever else the entry gains.
# desc: every hostInstallArgv in the tool catalog stays clear of the OS package manager and
#       of sudo; agent-browser's host path fetches a pinned release binary behind a sha256
#       check and resolves an existing browser instead of downloading one.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TOOLS="$ROOT/.agro/cli/src/lib/tools/catalog.ts"
CMD="$ROOT/.agro/cli/src/commands/tool.ts"

if [[ ! -f "$TOOLS" ]]; then
  echo "SKIPPED: tool catalog absent: $TOOLS" >&2
  exit 2
fi
if [[ ! -f "$CMD" ]]; then
  echo "SKIPPED: tool command absent: $CMD" >&2
  exit 2
fi

missing=()

host_block=$(awk '/hostInstallArgv: Object.freeze\(\[/,/\]\),/' "$TOOLS")

if [[ -z $host_block ]]; then
  missing+=("tools/catalog.ts: no hostInstallArgv — the host path fell back to the sandbox installer")
else
  while IFS= read -r pattern; do
    [[ -z $pattern ]] && continue
    if grep -qE -- "$pattern" <<<"$host_block"; then
      missing+=("tools/catalog.ts: a hostInstallArgv matches /$pattern/ — a host install must not touch the OS package manager")
    fi
  done <<'PATTERNS'
--with-deps
\bapt(-get)?[[:space:]]
\bdpkg[[:space:]]+-i\b
\bsudo\b
\byum\b
\bdnf\b
\bapk[[:space:]]+add\b
PATTERNS

  for required in 'sha256sum -c -' 'NPM_USER_PREFIX' 'AGENT_BROWSER_EXECUTABLE_PATH'; do
    grep -qF "$required" <<<"$host_block" \
      || missing+=("tools/catalog.ts: hostInstallArgv is missing \`$required\`")
  done

  if ! grep -qE 'releases/download/v\$version/agent-browser-linux-' <<<"$host_block"; then
    missing+=("tools/catalog.ts: the host install no longer fetches a pinned agent-browser release asset")
  fi
fi

cmd_code=$(cat "$CMD")
grep -qF 'resolveToolInstallArgv(entry, true)' <<<"$cmd_code" \
  || missing+=("commands/tool.ts: the host install does not resolve a host-specific argv — it would run the sandbox installer on the host")
grep -qF 'entry.hostDownloadSize' <<<"$cmd_code" \
  || missing+=("commands/tool.ts: the download gate does not resolve a host size — the host path would quote the sandbox download")

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo 'PASS: host tool installers stay clear of the OS package manager' >&2
