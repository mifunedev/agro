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
readonly SESSION=prd-efficiency-optimize
readonly STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency"

usage() {
  cat >&2 <<'USAGE'
Usage: optimize/run.sh [--dry-run] [--detach] [--proposer-smoke]

Install SkillOpt at the pinned revision into optimize/.venv, then run the
SkillOpt loop on .agro/skills/prd/SKILL.md with the train split only. The
original SKILL.md is the file at experiment.json base_revision; its sha256 must
equal pins.baseline_skill_md. Each candidate is a commit under
refs/prd-efficiency/cand-<k> and runs through
run-batch.sh --arm candidate --arm-rev candidate=<sha> --split train
--repeats 1 --phase optimize.

Score: for each train case, hard is 1 only when the latest episode passes
verify-prd.sh and costs efficiency_threshold (default 0.80) or less of the
baseline-train median cost of that case. The loop stops at
budget.max_candidates (default 6) candidates, at budget.optimize_attempts
(default 140) optimize episodes, or when the optimize cost plus the episode
reserve would pass budget.phases.optimize.max_usd. The last step writes
runs/optimize/candidates.jsonl and runs/optimize/frozen.json: the highest train
hard rate; a tie goes to the smaller diff.

The loop starts only when runs/baseline-train/summary.json is current, records
only the experiment.json model, and has a median cost for each train case, and
when pins.baseline_skill_md is set.

--proposer-smoke  Make exactly one proposer call through optimize/proposer-claude
                  on 3 train rows of runs/baseline-train, check that SkillOpt
                  parses and applies the returned patch, and write
                  runs/proposer-smoke/result.json and proposer-usage.jsonl.
                  A real smoke refuses to run again while result.json exists.
--dry-run         Use optimize/fake-claude for the episodes and for the
                  proposer. Write all state under
                  $XDG_STATE_HOME/agro/prd-efficiency/<mode>-dry-run/, use the
                  ref namespace refs/prd-efficiency-dry-run, and delete its refs
                  at the end. Copy runs/baseline-train when it exists and
                  PRD_EFFICIENCY_RUNS_DIR is unset; else make a fake baseline
                  with run-batch.sh. Print each real command line at the end.
--detach          Start the run in the new detached tmux session
                  prd-efficiency-optimize. The session stays open after the run.

Test-only overrides (need --dry-run): PRD_EFFICIENCY_TEST_CASES (train case ids),
PRD_EFFICIENCY_MANIFEST (another manifest for the split check),
PRD_EFFICIENCY_REF_NS, PRD_EFFICIENCY_FAKE_PLANS (plans that the fake episode
writes, default ../prd-grounding/runs/screen/outputs).
USAGE
}

original_args=("$@")
dry_run=0
detach=0
smoke=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) dry_run=1; shift ;;
    --detach) detach=1; shift ;;
    --proposer-smoke) smoke=1; shift ;;
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
  for name in XDG_STATE_HOME PRD_EFFICIENCY_RUNS_DIR PRD_EFFICIENCY_TIMEOUT_S PRD_EFFICIENCY_JOBS; do
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
mode=optimize
[ "$smoke" -eq 1 ] && mode=proposer-smoke

clean_refs() {
  local ref
  while read -r ref; do
    [ -n "$ref" ] && git -C "$EXP_DIR" update-ref -d "$ref"
  done < <(git -C "$EXP_DIR" for-each-ref --format='%(refname)' "$1/")
}

if [ "$dry_run" -eq 1 ]; then
  base="$STATE_ROOT/$mode-dry-run"
  ref_ns="${PRD_EFFICIENCY_REF_NS:-refs/prd-efficiency-dry-run}"
  rm -rf "$base"
  clean_refs "$ref_ns"
  mkdir -p "$base/bin" "$base/proposer-bin"
  runs_dir="${PRD_EFFICIENCY_RUNS_DIR:-$base/runs}"
  mkdir -p "$runs_dir"
  ln -s "$OPT_DIR/fake-claude" "$base/bin/claude"
  export FAKE_CLAUDE_STATE="${FAKE_CLAUDE_STATE:-$base/fake-state}"
  export PRD_EFFICIENCY_FAKE_PLANS="${PRD_EFFICIENCY_FAKE_PLANS-$EXP_DIR/../prd-grounding/runs/screen/outputs}"
  export PRD_EFFICIENCY_REAL_CLAUDE="${real_claude:-claude}"
  export PRD_EFFICIENCY_DRY_RUN=1
  export PRD_EFFICIENCY_DRY_LOG="$base/real-commands.log"
  : >"$PRD_EFFICIENCY_DRY_LOG"
  export PRD_EFFICIENCY_EPISODE_PATH="$base/bin:$PATH"
  export PRD_EFFICIENCY_EPISODE_XDG="$base/xdg"
  export PRD_EFFICIENCY_PROPOSER_CLAUDE="${real_claude:-claude}"
  export PRD_EFFICIENCY_PROPOSER_EXEC="$OPT_DIR/fake-claude"
  if [ ! -d "$runs_dir/baseline-train" ]; then
    if [ -z "${PRD_EFFICIENCY_RUNS_DIR:-}" ] && [ -d "$EXP_DIR/runs/baseline-train" ]; then
      cp -R "$EXP_DIR/runs/baseline-train" "$runs_dir/baseline-train"
      rm -f "$runs_dir/baseline-train/summary.json"
    else
      selection=(--split train)
      [ -n "${PRD_EFFICIENCY_TEST_CASES:-}" ] && selection=(--cases "$PRD_EFFICIENCY_TEST_CASES")
      printf 'optimize: dry run: fake baseline-train with run-batch.sh %s\n' "${selection[*]}"
      env PATH="$PRD_EFFICIENCY_EPISODE_PATH" XDG_STATE_HOME="$PRD_EFFICIENCY_EPISODE_XDG" PRD_EFFICIENCY_RUNS_DIR="$runs_dir" \
        bash "$EXP_DIR/run-batch.sh" --run-id baseline-train --arm baseline "${selection[@]}" --repeats 1 --phase baseline_train >/dev/null
    fi
    PRD_EFFICIENCY_RUNS_DIR="$runs_dir" bash "$EXP_DIR/summarize.sh" baseline-train >/dev/null
  fi
else
  base="$STATE_ROOT/optimize"
  ref_ns="refs/prd-efficiency"
  runs_dir="${PRD_EFFICIENCY_RUNS_DIR:-$EXP_DIR/runs}"
  for name in PRD_EFFICIENCY_TEST_CASES PRD_EFFICIENCY_MANIFEST PRD_EFFICIENCY_REF_NS; do
    if [ -n "${!name:-}" ]; then
      printf 'optimize: %s is test-only; use it with --dry-run\n' "$name" >&2
      exit 2
    fi
  done
  if [ -z "$real_claude" ]; then
    printf 'optimize: claude is not on PATH\n' >&2
    exit 1
  fi
  if [ "$smoke" -eq 1 ] && [ -e "$runs_dir/proposer-smoke/result.json" ]; then
    printf 'optimize: %s exists; the real proposer smoke runs once. Move it away to run again.\n' "$runs_dir/proposer-smoke/result.json" >&2
    exit 1
  fi
  mkdir -p "$base/proposer-bin"
  export PRD_EFFICIENCY_EPISODE_PATH="$PATH"
  export PRD_EFFICIENCY_PROPOSER_CLAUDE="$real_claude"
  unset PRD_EFFICIENCY_PROPOSER_EXEC PRD_EFFICIENCY_DRY_RUN PRD_EFFICIENCY_DRY_LOG PRD_EFFICIENCY_EPISODE_XDG
fi
ln -sfn "$OPT_DIR/proposer-claude" "$base/proposer-bin/claude"

export PRD_EFFICIENCY_OPT_STATE="$base"
export PRD_EFFICIENCY_RUNS_DIR="$runs_dir"
export PRD_EFFICIENCY_REF_NS="$ref_ns"
export PRD_EFFICIENCY_PROPOSER_MODEL="$model"
export CLAUDE_CLI_BIN="$base/proposer-bin/claude"
export CLAUDE_CODE_EXEC_PATH="$base/proposer-bin/claude"
export CLAUDE_SETTING_SOURCES=project
export PATH="$base/proposer-bin:$PATH"
driver_args=()
if [ "$smoke" -eq 1 ]; then
  export PRD_EFFICIENCY_PROPOSER_LOG="$base/proposer-smoke-$(date -u +%Y%m%dT%H%M%SZ)-$$.jsonl"
  export PRD_EFFICIENCY_PROPOSER_MAX_CALLS=1
  driver_args=(--proposer-smoke)
  log_dir="$runs_dir/proposer-smoke"
else
  export PRD_EFFICIENCY_PROPOSER_LOG="$base/proposer-usage.jsonl"
  log_dir="$runs_dir/optimize"
fi
mkdir -p "$log_dir"

set +e
PYTHONDONTWRITEBYTECODE=1 "$VENV/bin/python" "$OPT_DIR/driver.py" "${driver_args[@]}" 2>&1 | tee -a "$log_dir/$mode.log"
rc="${PIPESTATUS[0]}"
set -e

if [ "$dry_run" -eq 1 ]; then
  clean_refs "$ref_ns"
  printf '\noptimize: dry run done (exit %s); refs under %s deleted. Real command lines (the dry run used optimize/fake-claude for each):\n' "$rc" "$ref_ns"
  awk '!seen[$0]++' "$PRD_EFFICIENCY_DRY_LOG"
fi
exit "$rc"
