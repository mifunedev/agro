#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: record.sh start --task <slug> --run <id> --purpose evidence|demo --profile desktop|mobile
                       --scenario <text> --url <url> [--criteria <text>] [--reason <text>]
                       [--width <px> --height <px>] [--scale <n>] [--device <name>]
                       [--fps <n>] [--max-seconds <n>] [--export <w>x<h>] [--rerun <run>]
                       [--state <file>]
       record.sh stop --dir <dir> --assertions pass|fail|none
EOF
  exit 2
}

die() {
  echo "record.sh: $1" >&2
  exit 1
}

slug='^[A-Za-z0-9][A-Za-z0-9._-]*$'
int='^[1-9][0-9]*$'

require_tools() {
  if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null \
    || ! grep -qw libx264 <<<"$(ffmpeg -hide_banner -encoders 2>/dev/null)"; then
    die "ffmpeg, ffprobe, and the libx264 encoder are required. Run: agro tool install ffmpeg"
  fi
  command -v jq >/dev/null || die "jq is required"
  command -v agent-browser >/dev/null || die "agent-browser is required. Run: agro tool install agent-browser --yes"
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

start() {
  local task="" run="" purpose="" profile="" scenario="" url="" criteria="" reason=""
  local width="" height="" scale="" device="" fps=30 max_seconds=120 export_canvas="" rerun="" state=""
  while (( $# )); do
    (( $# >= 2 )) || usage
    case "$1" in
      --task) task="$2" ;;
      --run) run="$2" ;;
      --purpose) purpose="$2" ;;
      --profile) profile="$2" ;;
      --scenario) scenario="$2" ;;
      --url) url="$2" ;;
      --criteria) criteria="$2" ;;
      --reason) reason="$2" ;;
      --width) width="$2" ;;
      --height) height="$2" ;;
      --scale) scale="$2" ;;
      --device) device="$2" ;;
      --fps) fps="$2" ;;
      --max-seconds) max_seconds="$2" ;;
      --export) export_canvas="$2" ;;
      --rerun) rerun="$2" ;;
      --state) state="$2" ;;
      *) usage ;;
    esac
    shift 2
  done
  [[ "$task" =~ $slug && "$run" =~ $slug && -n "$scenario" && -n "$url" ]] || usage
  [[ "$purpose" == evidence || "$purpose" == demo ]] || usage
  [[ "$profile" == desktop || "$profile" == mobile ]] || usage
  { [[ "$fps" =~ $int ]] && (( fps <= 60 )); } || usage
  [[ "$max_seconds" =~ $int ]] || usage
  [[ -z "$width" || "$width" =~ $int ]] && [[ -z "$height" || "$height" =~ $int ]] || usage
  [[ -z "$scale" || "$scale" =~ ^[0-9]+(\.[0-9]+)?$ ]] || usage
  [[ -z "$export_canvas" || "$export_canvas" =~ ^[1-9][0-9]*x[1-9][0-9]*$ ]] || usage
  [[ -z "$rerun" || "$rerun" =~ $slug ]] || usage
  [[ -z "$device" || -z "$width$height$scale" ]] || usage
  [[ -z "$state" || -f "$state" ]] || die "state file not found: $state"

  require_tools

  if [[ "$profile" == mobile ]]; then
    width="${width:-414}" height="${height:-896}"
  elif [[ "$purpose" == demo ]]; then
    width="${width:-1920}" height="${height:-1080}"
  else
    width="${width:-1280}" height="${height:-720}"
  fi
  scale="${scale:-1}"

  local root
  root="${AGRO_EVIDENCE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null)}" || true
  [[ -n "$root" ]] || die "run inside a git repository or set AGRO_EVIDENCE_ROOT"
  mkdir -p "$root"
  root="$(cd "$root" && pwd)"
  local dir="$root/.agro/tasks/$task/evidence/browser/$run/$profile"
  local session="$task-$run-$profile"
  mkdir -p "$(dirname "$dir")"
  mkdir "$dir" 2>/dev/null || die "$dir already exists; use a new --run"

  local commit="" dirty=null
  if commit="$(git rev-parse HEAD 2>/dev/null)"; then
    [[ -n "$(git status --porcelain 2>/dev/null)" ]] && dirty=true || dirty=false
  else
    commit=""
  fi

  local ab=(agent-browser --session "$session") state_flag=()
  [[ -n "$state" ]] && state_flag=(--state "$state")
  local emulation=viewport-only setup=(set viewport "$width" "$height" "$scale") record_flags=(--fps "$fps" --contact-sheet)
  if [[ -n "$device" ]]; then
    emulation="device:$device"
    setup=(set device "$device")
  fi
  [[ "$purpose" == demo && "$profile" == desktop ]] && record_flags+=(--cursor)

  local viewport out
  if ! out="$("${ab[@]}" "${state_flag[@]}" "${setup[@]}" 2>&1)" \
    || ! out="$("${ab[@]}" open "$url" 2>&1)" \
    || ! viewport="$("${ab[@]}" eval 'innerWidth + "x" + innerHeight' 2>&1)" \
    || ! out="$("${ab[@]}" record start "$dir/video.mp4" "${record_flags[@]}" 2>&1)"; then
    "${ab[@]}" close >/dev/null 2>&1 || true
    rm -rf "$dir"
    die "browser setup failed: ${out:-$viewport}"
  fi
  viewport="${viewport//\"/}"

  jq -n \
    --arg task "$task" --arg run "$run" --arg profile "$profile" --arg purpose "$purpose" \
    --arg session "$session" --arg commit "$commit" --argjson dirty "$dirty" \
    --arg scenario "$scenario" --arg url "$url" --arg criteria "$criteria" --arg reason "$reason" \
    --arg rerun "$rerun" --arg viewport "$viewport" --arg scale "$scale" --arg device "$device" \
    --arg export "$export_canvas" --arg emulation "$emulation" --argjson fps "$fps" \
    --arg abVersion "$(agent-browser --version | awk '{print $NF}')" \
    --arg ffVersion "$(ffmpeg -version | awk 'NR == 1 {print $3}')" \
    --arg startedAt "$(now)" '
    def nullable: if . == "" then null else . end;
    def size: split("x") | {width: (.[0] | tonumber), height: (.[1] | tonumber)};
    {
      task: $task, run: $run, profile: $profile, purpose: $purpose, session: $session,
      commit: ($commit | nullable), dirty: $dirty,
      scenario: $scenario, url: $url, criteria: ($criteria | nullable),
      selectionReason: ($reason | nullable), rerun: ($rerun | nullable),
      cssViewport: ($viewport | size),
      requestedScale: (if $device == "" then ($scale | tonumber) else null end),
      effectiveScale: null, encodedSize: null,
      exportCanvas: (if $export == "" then null else ($export | size) end),
      emulation: $emulation, fps: $fps, codec: null, contactSheet: null,
      agentBrowserVersion: $abVersion, ffmpegVersion: $ffVersion,
      startedAt: $startedAt, stoppedAt: null,
      captureStatus: "incomplete", assertionStatus: "none"
    }' >"$dir/manifest.json"

  setsid bash "${BASH_SOURCE[0]}" watchdog "$session" "$dir" "$max_seconds" </dev/null >/dev/null 2>&1 &
  echo "$!" >"$dir/.watchdog"
  echo "$dir"
}

watchdog() {
  sleep "$3"
  touch "$2/.timeout"
  agent-browser --session "$1" record stop >/dev/null 2>&1 || true
}

stop() {
  local dir="" assertions=""
  while (( $# )); do
    (( $# >= 2 )) || usage
    case "$1" in
      --dir) dir="$2" ;;
      --assertions) assertions="$2" ;;
      *) usage ;;
    esac
    shift 2
  done
  [[ -n "$dir" && "$assertions" =~ ^(pass|fail|none)$ ]] || usage
  [[ -f "$dir/manifest.json" ]] || die "$dir has no manifest.json"
  require_tools
  dir="$(cd "$dir" && pwd)"
  local manifest="$dir/manifest.json" video="$dir/video.mp4"
  local session purpose
  session="$(jq -r .session "$manifest")"
  purpose="$(jq -r .purpose "$manifest")"

  if [[ -f "$dir/.watchdog" ]]; then
    kill -- "-$(cat "$dir/.watchdog")" 2>/dev/null || true
    rm -f "$dir/.watchdog"
  fi
  local status=complete
  if [[ -f "$dir/.timeout" ]]; then
    status=timeout
    rm -f "$dir/.timeout"
    echo "record.sh: the watchdog stopped the recording at the time limit" >&2
  fi
  agent-browser --session "$session" record stop >/dev/null 2>&1 || [[ "$status" == timeout ]] \
    || echo "record.sh: no recording was in progress for session $session" >&2
  agent-browser --session "$session" close >/dev/null 2>&1 || true

  local probe update=(--arg stoppedAt "$(now)" --arg assertions "$assertions")
  if ! probe="$(ffprobe -v error -select_streams v:0 \
      -show_entries stream=codec_name,width,height,avg_frame_rate -show_entries format=duration \
      -of json "$video" 2>&1)" || [[ "$(jq '.streams | length' <<<"$probe" 2>/dev/null)" != 1 ]]; then
    jq "${update[@]}" '.stoppedAt = $stoppedAt | .assertionStatus = $assertions | .captureStatus = "incomplete"' \
      "$manifest" >"$manifest.tmp" && mv "$manifest.tmp" "$manifest"
    die "ffprobe cannot read $video; captureStatus is incomplete: $probe"
  fi

  local sheet=""
  [[ -s "$dir/video.contact-sheet.png" ]] && sheet=video.contact-sheet.png
  jq "${update[@]}" --arg status "$status" --arg sheet "$sheet" --argjson probe "$probe" '
    def round2: . * 100 | round / 100;
    $probe.streams[0] as $s
    | .stoppedAt = $stoppedAt | .assertionStatus = $assertions | .captureStatus = $status
    | .contactSheet = (if $sheet == "" then null else $sheet end)
    | .codec = $s.codec_name
    | .encodedSize = {width: $s.width, height: $s.height}
    | .fps = ($s.avg_frame_rate | split("/") | (.[0] | tonumber) / (.[1] | tonumber) | round2)
    | .effectiveScale = ($s.width / .cssViewport.width | round2)' \
    "$manifest" >"$manifest.tmp" && mv "$manifest.tmp" "$manifest"

  if [[ "$purpose" == demo ]]; then
    local half
    half="$(jq -r '.format.duration | tonumber / 2' <<<"$probe")"
    ffmpeg -v error -y -ss "$half" -i "$video" -frames:v 1 "$dir/thumbnail.png" \
      || die "ffmpeg cannot write $dir/thumbnail.png"
    jq -r '[
      "# \(.task) \(.run) \(.profile)", "",
      "- Scenario: \(.scenario)",
      "- URL: \(.url)",
      "- Purpose: \(.purpose)",
      "- Criteria: \(.criteria // "none")",
      "- Selection reason: \(.selectionReason // "none")",
      "- Rerun of: \(.rerun // "none")",
      "- Commit: \(.commit // "unknown")\(if .dirty then " (dirty)" else "" end)",
      "- CSS viewport: \(.cssViewport.width)x\(.cssViewport.height)",
      "- Encoded size: \(.encodedSize.width)x\(.encodedSize.height) at \(.fps) FPS",
      "- Export canvas: \(if .exportCanvas then "\(.exportCanvas.width)x\(.exportCanvas.height)" else "none" end)",
      "- Emulation: \(.emulation)",
      "- Capture status: \(.captureStatus)",
      "- Assertion status: \(.assertionStatus)"
    ] | join("\n")' "$manifest" >"$dir/scenario.md"
  fi

  jq -r --arg video "$video" \
    '"captureStatus=\(.captureStatus) assertionStatus=\(.assertionStatus) encodedSize=\(.encodedSize.width)x\(.encodedSize.height) video=\($video)"' \
    "$manifest"
}

case "${1:-}" in
  start) shift; start "$@" ;;
  stop) shift; stop "$@" ;;
  watchdog) shift; (( $# == 3 )) || usage; watchdog "$@" ;;
  *) usage ;;
esac
