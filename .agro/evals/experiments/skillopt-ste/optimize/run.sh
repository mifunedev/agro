#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
readonly SELF
OPT_DIR="$(dirname "$SELF")"
readonly OPT_DIR
EXP_DIR="$(dirname "$OPT_DIR")"
readonly EXP_DIR
readonly VENV="$OPT_DIR/.venv"
readonly REQUIREMENTS="$OPT_DIR/requirements.txt"
readonly SESSION=skillopt-ste
readonly STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste"

usage() {
  cat >&2 <<'USAGE'
Usage: optimize/run.sh [--dry-run] [--detach]

Install SkillOpt at the pinned revision into optimize/.venv, then run the
SkillOpt loop on .agro/skills/ste/SKILL.md with the training split only.
Each candidate runs through run-batch.sh. The loop stops after 8 candidates or
240 optimize attempts. The last step writes runs/optimize/frozen.json.

--dry-run  Run the whole loop with optimize/fake-claude for the episodes and
           for the proposer. Write all state under
           $XDG_STATE_HOME/agro/skillopt-ste/optimize-dry-run/. Print each
           real command line at the end.
--detach   Start the run in the new detached tmux session skillopt-ste. The
           session stays open after the run ends.
USAGE
}

original_args=("$@")
dry_run=0
detach=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) dry_run=1; shift ;;
    --detach) detach=1; shift ;;
    *) printf 'optimize: unknown argument: %s\n' "$1" >&2; usage; exit 2 ;;
  esac
done

inside_session() {
  [ -n "${TMUX:-}" ] && [ "$(tmux display-message -p '#S' 2>/dev/null)" = "$SESSION" ]
}

if [ "$detach" -eq 1 ] && ! inside_session; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    printf 'optimize: tmux session %s already exists; attach with: tmux attach -t %s\n' "$SESSION" "$SESSION" >&2
    exit 1
  fi
  forward=()
  for arg in "${original_args[@]}"; do
    [ "$arg" = --detach ] || forward+=("$arg")
  done
  env_args=(-e "PATH=$PATH")
  for name in XDG_STATE_HOME SKILLOPT_STE_RUNS_DIR SKILLOPT_STE_TIMEOUT_S; do
    if [ -n "${!name:-}" ]; then
      env_args+=(-e "$name=${!name}")
    fi
  done
  printf -v command '%q ' bash "$SELF" "${forward[@]}"
  command+='; printf "\noptimize/run.sh exited %s. Press Enter to close the session.\n" "$?"; read -r _'
  tmux new-session -d -s "$SESSION" -c "$EXP_DIR" "${env_args[@]}" "$command"
  printf 'optimize: started in tmux session %s; attach with: tmux attach -t %s\n' "$SESSION" "$SESSION"
  exit 0
fi

stamp="$(sha256sum "$REQUIREMENTS" | cut -d' ' -f1)"
if [ ! -x "$VENV/bin/python" ] || [ "$(cat "$VENV/.agro-requirements-sha256" 2>/dev/null || true)" != "$stamp" ]; then
  if [ ! -x "$VENV/bin/python" ]; then
    uv venv --quiet "$VENV"
  fi
  uv pip install --quiet --python "$VENV/bin/python" -r "$REQUIREMENTS"
  printf '%s\n' "$stamp" >"$VENV/.agro-requirements-sha256"
fi

real_claude="$(command -v claude || true)"
model="$(jq -r '.model' "$EXP_DIR/experiment.json")"

if [ "$dry_run" -eq 1 ]; then
  base="$STATE_ROOT/optimize-dry-run"
  ref_ns="${SKILLOPT_STE_REF_NS:-refs/skillopt-ste-dry-run}"
  rm -rf "$base"
  while read -r ref; do
    [ -n "$ref" ] && git -C "$EXP_DIR" update-ref -d "$ref"
  done < <(git -C "$EXP_DIR" for-each-ref --format='%(refname)' "$ref_ns/")
  mkdir -p "$base/bin" "$base/proposer-bin"
  runs_dir="${SKILLOPT_STE_RUNS_DIR:-$base/runs}"
  if [ ! -f "$runs_dir/baseline-train/episodes.jsonl" ]; then
    mkdir -p "$runs_dir"
    cp -R "$EXP_DIR/runs/baseline-train" "$runs_dir/baseline-train"
  fi
  ln -s "$OPT_DIR/fake-claude" "$base/bin/claude"
  export FAKE_CLAUDE_STATE="${FAKE_CLAUDE_STATE:-$base/fake-state}"
  export SKILLOPT_STE_REAL_CLAUDE="${real_claude:-claude}"
  export SKILLOPT_STE_DRY_RUN=1
  export SKILLOPT_STE_DRY_LOG="$base/real-commands.log"
  : >"$SKILLOPT_STE_DRY_LOG"
  export SKILLOPT_STE_EPISODE_PATH="$base/bin:$PATH"
  export SKILLOPT_STE_PROPOSER_CLAUDE="${real_claude:-claude}"
  export SKILLOPT_STE_PROPOSER_EXEC="$OPT_DIR/fake-claude"
else
  base="$STATE_ROOT/optimize"
  ref_ns="refs/skillopt-ste"
  runs_dir="${SKILLOPT_STE_RUNS_DIR:-$EXP_DIR/runs}"
  if [ -n "${SKILLOPT_STE_TEST_DOCS:-}" ]; then
    printf 'optimize: SKILLOPT_STE_TEST_DOCS is test-only; use it with --dry-run\n' >&2
    exit 2
  fi
  if [ -z "$real_claude" ]; then
    printf 'optimize: claude is not on PATH\n' >&2
    exit 1
  fi
  mkdir -p "$base/proposer-bin"
  export SKILLOPT_STE_EPISODE_PATH="$PATH"
  export SKILLOPT_STE_PROPOSER_CLAUDE="$real_claude"
  unset SKILLOPT_STE_PROPOSER_EXEC SKILLOPT_STE_DRY_RUN SKILLOPT_STE_DRY_LOG
fi
ln -sfn "$OPT_DIR/proposer-claude" "$base/proposer-bin/claude"

export SKILLOPT_STE_OPT_STATE="$base"
export SKILLOPT_STE_RUNS_DIR="$runs_dir"
export SKILLOPT_STE_REF_NS="$ref_ns"
export SKILLOPT_STE_PROPOSER_MODEL="$model"
export SKILLOPT_STE_PROPOSER_LOG="$base/proposer-usage.jsonl"
export CLAUDE_CLI_BIN="$base/proposer-bin/claude"
export CLAUDE_CODE_EXEC_PATH="$base/proposer-bin/claude"
export CLAUDE_SETTING_SOURCES=project
export PATH="$base/proposer-bin:$PATH"
mkdir -p "$runs_dir/optimize"

set +e
PYTHONDONTWRITEBYTECODE=1 "$VENV/bin/python" "$OPT_DIR/driver.py" 2>&1 | tee -a "$runs_dir/optimize/optimize.log"
rc="${PIPESTATUS[0]}"
set -e

if [ "$dry_run" -eq 1 ]; then
  printf '\noptimize: dry run done. Real command lines (the dry run used optimize/fake-claude for each):\n'
  awk '!seen[$0]++' "$SKILLOPT_STE_DRY_LOG"
fi
exit "$rc"
