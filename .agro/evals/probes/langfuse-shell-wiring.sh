#!/usr/bin/env bash
# tier: A
# source: issue #1131 US-004 — .agro/install/.zshrc is the only managed shell surface and
#         zsh reads it for INTERACTIVE shells alone, so `zsh -c` carried no credentials.
#         agro-cron.service runs /bin/bash -c with Environment=HOME only and got
#         credentials by accident, because .tmux.conf sets no default-command and
#         tmux new-session therefore spawns a login shell. cron-runtime.ts branches on
#         liveEntry.tmux, and the tmux: false path had no such luck — those fires emitted
#         zero traces, silently.
# desc: one credential fragment at ~/.config/agro/langfuse.env serves two consumers with
#       incompatible formats. systemd EnvironmentFile rejects `export`, so the fragment is
#       bare KEY=value; a shell sourcing bare KEY=value makes a shell parameter that no
#       child process inherits, so the tracked .zshenv wraps the source in set -a / set +a.
#       This probe asserts the tracked .zshenv exists, guards the source so a missing
#       fragment is not an error, exports through set -a, is copied into the image beside
#       .zshrc, and that the cron unit carries EnvironmentFile with the leading `-`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$ROOT"

ZSHENV=".agro/install/.zshenv"
DOCKERFILE=".devcontainer/Dockerfile"
UNIT=".devcontainer/agro-cron.service"
FRAGMENT='.config/agro/langfuse.env'

for f in "$DOCKERFILE" "$UNIT"; do
  [ -f "$f" ] || { echo "SKIPPED: required file absent: $f" >&2; exit 2; }
done

missing=()

if [ -f "$ZSHENV" ]; then
  grep -qE '\[ +-r +.*'"$FRAGMENT" "$ZSHENV" \
    || missing+=("$ZSHENV must guard the source with a [ -r ... ] readability test on ~/$FRAGMENT — a missing fragment is the normal pre-configuration state and must not be an error")
  grep -qE '^[[:space:]]*(\.|source) +.*'"$FRAGMENT" "$ZSHENV" \
    || missing+=("$ZSHENV must source ~/$FRAGMENT")
  grep -qE '^[[:space:]]*set -a[[:space:]]*$' "$ZSHENV" \
    || missing+=("$ZSHENV must wrap the source in 'set -a' — the fragment is bare KEY=value because systemd EnvironmentFile rejects 'export', and without set -a the shell creates parameters no child hook inherits")
  grep -qE '^[[:space:]]*set \+a[[:space:]]*$' "$ZSHENV" \
    || missing+=("$ZSHENV must restore allexport with 'set +a' after the source")
else
  missing+=("$ZSHENV is absent — .zshrc is interactive-only, so without a tracked .zshenv a non-interactive 'zsh -c' session carries no Langfuse credentials")
fi

grep -qE '^COPY --chown=sandbox:sandbox \.agro/install/\.zshenv /home/sandbox/\.zshenv$' "$DOCKERFILE" \
  || missing+=("$DOCKERFILE must COPY --chown=sandbox:sandbox .agro/install/.zshenv /home/sandbox/.zshenv beside the .zshrc copy — an untracked shell surface is the defect this closes")

grep -qE '^EnvironmentFile=-/home/sandbox/\.config/agro/langfuse\.env$' "$UNIT" \
  || missing+=("$UNIT must set EnvironmentFile=-/home/sandbox/.config/agro/langfuse.env, with the leading '-', so the cron runtime carries the credentials itself instead of relying on tmux spawning a login shell, and so a missing fragment never fails the unit")

behavior="static only (zsh absent)"
if [ -f "$ZSHENV" ] && command -v zsh >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  cp "$ZSHENV" "$tmp/.zshenv"

  noise="$(env -u LANGFUSE_BASE_URL HOME="$tmp" ZDOTDIR="$tmp" zsh -c 'exit 0' 2>&1 >/dev/null || echo 'non-zero exit status')"
  if [ -n "$noise" ]; then
    missing+=("a non-interactive 'zsh -c' is not clean when ~/$FRAGMENT is absent (got: ${noise}) — an unconfigured sandbox is the normal state, so the guard must keep the source from running at all")
  fi

  mkdir -p "$tmp/$(dirname "$FRAGMENT")"
  printf 'LANGFUSE_BASE_URL=http://probe.invalid\n' > "$tmp/$FRAGMENT"
  got="$(env -u LANGFUSE_BASE_URL HOME="$tmp" ZDOTDIR="$tmp" zsh -c 'printenv LANGFUSE_BASE_URL' 2>/dev/null || true)"
  if [ "$got" = "http://probe.invalid" ]; then
    behavior="non-interactive zsh -c exports the value to a child process"
  else
    missing+=("a non-interactive 'zsh -c' did not export LANGFUSE_BASE_URL from a bare KEY=value fragment (printenv returned '${got}') — a sourced bare assignment is a shell parameter, not an environment variable, so a hook run as a child never sees it")
  fi
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: langfuse shell wiring broken:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: tracked .zshenv guards and set -a exports ~/$FRAGMENT, the Dockerfile copies it to /home/sandbox/.zshenv, agro-cron.service carries EnvironmentFile=- for the same fragment; $behavior" >&2
exit 0
