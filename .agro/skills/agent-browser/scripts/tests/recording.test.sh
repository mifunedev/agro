#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../record.sh"
URL="file://$HERE/fixtures/responsive.html"
TMP="$(mktemp -d)"
export AGRO_EVIDENCE_ROOT="$TMP/evidence root"
TASK="rectest$$"
PROBE="$TASK-probe"
fail=0

cleanup() {
  local s
  for s in $(agent-browser session list 2>/dev/null | grep -o "$TASK-[A-Za-z0-9._-]*" || true); do
    agent-browser --session "$s" close >/dev/null 2>&1 || true
  done
  pkill -f "record.sh watchdog $TASK-" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

ok() { printf 'ok: %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fail=1; }
check() { local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }

if ! command -v agent-browser >/dev/null; then
  echo "SKIP: agent-browser not found in PATH"
  exit 0
fi
if ! launch="$(agent-browser --session "$PROBE" open about:blank 2>&1)"; then
  echo "SKIP: agent-browser cannot launch Chromium: $launch"
  exit 0
fi
agent-browser --session "$PROBE" close >/dev/null 2>&1 || true

ab() { local s="$1"; shift; agent-browser --session "$s" "$@"; }
dir_of() { printf '%s/.agro/tasks/%s/evidence/browser/%s/%s' "$AGRO_EVIDENCE_ROOT" "$TASK" "$1" "$2"; }
field() { jq -r "$2" "$1/manifest.json"; }
probe() { ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate -of csv=p=0 "$1/video.mp4"; }
start() {
  local run="$1" purpose="$2" profile="$3"
  shift 3
  bash "$SCRIPT" start --task "$TASK" --run "$run" --purpose "$purpose" --profile "$profile" \
    --scenario "Open the menu and save the form" --url "$URL" --max-seconds 30 "$@"
}
submit_form() {
  ab "$1" fill '#name' 'Ada' >/dev/null
  ab "$1" click '#save' >/dev/null
  ab "$1" wait 500 >/dev/null
  [[ "$(ab "$1" get text '#status')" == "Saved: Ada" ]]
}
duration() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1/video.mp4"; }
longer() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b + 1) }'; }
not() { ! "$@"; }
watching() { pgrep -f "[r]ecord.sh watchdog $1" >/dev/null; }
listed() { agent-browser session list 2>/dev/null | grep -qF "$1"; }
gone() {
  local _
  for _ in $(seq 50); do listed "$1" || return 0; sleep 0.1; done
  return 1
}
not_recording() { ! ab "$1" record stop >/dev/null 2>&1; }

got=0
out="$(bash "$SCRIPT" 2>&1)" || got=$?
check "no arguments exits 2" test "$got" == 2
got=0
bash "$SCRIPT" start --task "$TASK" --run bad --purpose film --profile desktop --scenario s --url "$URL" >/dev/null 2>&1 || got=$?
check "bad purpose exits 2" test "$got" == 2

fake="$TMP/fakebin"
mkdir -p "$fake/no-ffprobe" "$fake/no-ffmpeg" "$fake/no-x264"
for cmd in agent-browser jq git; do
  for d in no-ffprobe no-ffmpeg no-x264; do ln -s "$(command -v "$cmd")" "$fake/$d/$cmd"; done
done
ln -s "$(command -v ffmpeg)" "$fake/no-ffprobe/ffmpeg"
ln -s "$(command -v ffprobe)" "$fake/no-ffmpeg/ffprobe"
ln -s "$(command -v ffprobe)" "$fake/no-x264/ffprobe"
printf '#!/bin/sh\necho " V....D libopenh264 OpenH264"\n' >"$fake/no-x264/ffmpeg"
chmod +x "$fake/no-x264/ffmpeg"
for d in no-ffprobe no-ffmpeg no-x264; do
  got=0
  out="$(PATH="$fake/$d:/usr/bin:/bin" bash "$SCRIPT" start --task "$TASK" --run "$d" --purpose evidence --profile desktop --scenario s --url "$URL" 2>&1)" || got=$?
  check "$d exits 1" test "$got" == 1
  check "$d names agro tool install ffmpeg" grep -qF 'agro tool install ffmpeg' <<<"$out"
  check "$d creates no run directory" test ! -e "$(dir_of "$d" desktop)"
  check "$d opens no browser session" gone "$TASK-$d-desktop"
done

d_desk="$(start pair evidence desktop --criteria AC-1 --reason "layout differs by width")"
d_mob="$(start pair evidence mobile --criteria AC-1 --reason "layout differs by width")"
check "start prints the absolute desktop directory" test "$d_desk" == "$(dir_of pair desktop)"
check "paired run has two separate directories" test "$d_desk" != "$d_mob"
check "output path contains a space" grep -qF ' ' <<<"$d_desk"
s_desk="$TASK-pair-desktop"
s_mob="$TASK-pair-mobile"
check "desktop shows inline navigation" test "$(ab "$s_desk" is visible '#links a')" == true
check "desktop hides the menu toggle" test "$(ab "$s_desk" is visible '#menu-toggle')" == false
check "mobile shows the menu toggle" test "$(ab "$s_mob" is visible '#menu-toggle')" == true
check "mobile hides the links before the toggle" test "$(ab "$s_mob" is visible '#links a')" == false
ab "$s_mob" click '#menu-toggle' >/dev/null
check "mobile toggle opens the links" test "$(ab "$s_mob" is visible '#links a')" == true
check "desktop form shows the saved state" submit_form "$s_desk"
ab "$s_mob" click '#menu-toggle' >/dev/null
check "mobile form shows the saved state" submit_form "$s_mob"

got=0
bash "$SCRIPT" stop --dir "$d_desk" --assertions pass >/dev/null || got=$?
check "desktop stop exits 0" test "$got" == 0
check "stopping desktop closes the desktop session" gone "$s_desk"
check "stopping desktop cancels its watchdog" not watching "$s_desk"
check "mobile watchdog keeps running" watching "$s_mob"
check "mobile session stays open after the desktop stop" listed "$s_mob"
ab "$s_mob" wait 3000 >/dev/null
got=0
bash "$SCRIPT" stop --dir "$d_mob" --assertions pass >/dev/null || got=$?
check "mobile stop exits 0" test "$got" == 0
check "mobile kept recording after the desktop stop" longer "$(duration "$d_mob")" "$(duration "$d_desk")"
check "desktop video is H.264 1280x720 at 30 fps" test "$(probe "$d_desk")" == "h264,1280,720,30/1"
check "mobile video is H.264 414x896 at 30 fps" test "$(probe "$d_mob")" == "h264,414,896,30/1"
check "desktop manifest is complete and passed" test "$(field "$d_desk" '.captureStatus + " " + .assertionStatus')" == "complete pass"
check "desktop manifest encodedSize comes from ffprobe" test "$(field "$d_desk" '"\(.encodedSize.width)x\(.encodedSize.height) \(.codec) \(.fps)"')" == "1280x720 h264 30"
check "mobile manifest cssViewport is 414x896" test "$(field "$d_mob" '"\(.cssViewport.width)x\(.cssViewport.height)"')" == "414x896"
check "mobile manifest records viewport-only emulation" test "$(field "$d_mob" .emulation)" == viewport-only
check "manifest records session, reason, and criteria" test "$(field "$d_mob" '[.session, .selectionReason, .criteria] | join("|")')" == "$s_mob|layout differs by width|AC-1"
for key in task run profile purpose session commit dirty scenario criteria selectionReason rerun cssViewport requestedScale effectiveScale encodedSize exportCanvas emulation fps codec contactSheet agentBrowserVersion ffmpegVersion startedAt stoppedAt captureStatus assertionStatus; do
  jq -e "has(\"$key\")" "$d_desk/manifest.json" >/dev/null || bad "manifest lacks $key"
done
check "evidence run writes no thumbnail" test ! -e "$d_desk/thumbnail.png"
check "desktop run writes a contact sheet" test -s "$d_desk/video.contact-sheet.png"
check "desktop manifest names the contact sheet" test "$(field "$d_desk" .contactSheet)" == video.contact-sheet.png

got=0
out="$(start pair evidence desktop 2>&1)" || got=$?
check "existing run directory exits 1" test "$got" == 1
check "existing run directory keeps its video" test "$(field "$d_desk" .captureStatus)" == complete

d_demo="$(start demo demo desktop --export 1080x1920 --rerun pair)"
check "demo desktop form shows the saved state" submit_form "$TASK-demo-desktop"
bash "$SCRIPT" stop --dir "$d_demo" --assertions pass >/dev/null
check "demo desktop video is H.264 1920x1080 at 30 fps" test "$(probe "$d_demo")" == "h264,1920,1080,30/1"
check "demo writes thumbnail.png" test -s "$d_demo/thumbnail.png"
check "demo writes scenario.md" grep -qF 'Open the menu and save the form' "$d_demo/scenario.md"
check "demo manifest records export canvas and rerun" test "$(field "$d_demo" '"\(.exportCanvas.width)x\(.exportCanvas.height) \(.rerun)"')" == "1080x1920 pair"

d_fail="$(start failed demo mobile)"
ab "$TASK-failed-mobile" fill '#name' 'Ada' >/dev/null
check "unsubmitted form keeps the initial state" test "$(ab "$TASK-failed-mobile" get text '#status')" == "Not saved"
got=0
bash "$SCRIPT" stop --dir "$d_fail" --assertions fail >/dev/null || got=$?
check "failed assertion stop exits 0" test "$got" == 0
check "failed assertion video is finalized" test "$(probe "$d_fail")" == "h264,414,896,30/1"
check "failed assertion manifest" test "$(field "$d_fail" '.captureStatus + " " + .assertionStatus')" == "complete fail"

d_time="$(start timeout evidence desktop --max-seconds 2)"
sleep 4
check "watchdog stopped the recording" not_recording "$TASK-timeout-desktop"
got=0
bash "$SCRIPT" stop --dir "$d_time" --assertions none >/dev/null 2>&1 || got=$?
check "timeout stop exits 0" test "$got" == 0
check "timeout manifest" test "$(field "$d_time" '.captureStatus + " " + .assertionStatus')" == "timeout none"
check "timeout video lasts under 4 s" awk -v d="$(duration "$d_time")"'BEGIN { exit !(d > 0 && d < 4) }'

d_inc="$(start broken evidence desktop)"
ab "$TASK-broken-desktop" wait 1000 >/dev/null
check "encoder killed mid-capture" pkill -KILL -f "[f]fmpeg .*$d_inc/video.mp4"
got=0
bash "$SCRIPT" stop --dir "$d_inc" --assertions none >/dev/null 2>&1 || got=$?
check "unreadable video exits 1" test "$got" == 1
check "unreadable video manifest is incomplete" test "$(field "$d_inc" .captureStatus)" == incomplete

d_scale="$(start scale evidence desktop --scale 2)"
ab "$TASK-scale-desktop" wait 500 >/dev/null
bash "$SCRIPT" stop --dir "$d_scale" --assertions none >/dev/null
printf 'observed: --scale 2 css %s encoded %s effectiveScale %s\n' \
  "$(field "$d_scale" '"\(.cssViewport.width)x\(.cssViewport.height)"')" \
  "$(field "$d_scale" '"\(.encodedSize.width)x\(.encodedSize.height)"')" \
  "$(field "$d_scale" .effectiveScale)"
check "--scale 2 manifest records requested and effective scale" \
  test "$(field "$d_scale" '"\(.requestedScale) \(.effectiveScale == (.encodedSize.width / .cssViewport.width))"')" == "2 true"

d_dev="$(start device evidence mobile --device "iPhone 12")"
check "device profile shows the menu toggle" test "$(ab "$TASK-device-mobile" is visible '#menu-toggle')" == true
bash "$SCRIPT" stop --dir "$d_dev" --assertions pass >/dev/null
printf 'observed: --device "iPhone 12" css %s encoded %s effectiveScale %s\n' \
  "$(field "$d_dev" '"\(.cssViewport.width)x\(.cssViewport.height)"')" \
  "$(field "$d_dev" '"\(.encodedSize.width)x\(.encodedSize.height)"')" \
  "$(field "$d_dev" .effectiveScale)"
check "--device manifest records device emulation" test "$(field "$d_dev" .emulation)" == "device:iPhone 12"
check "--device manifest effectiveScale matches encoded width" \
  test "$(field "$d_dev" '.effectiveScale == (.encodedSize.width / .cssViewport.width)')" == true

state="$TMP/state.json"
printf '{"cookies":[],"origins":[{"origin":"file://","localStorage":[{"name":"user","value":"ada"}],"sessionStorage":[]}]}' >"$state"
d_state="$(start state evidence desktop --state "$state")"
check "--state loads localStorage into the recorded session" test "$(ab "$TASK-state-desktop" eval "localStorage.getItem('user')")" == '"ada"'
bash "$SCRIPT" stop --dir "$d_state" --assertions pass >/dev/null
check "--state recording completes" test "$(field "$d_state" .captureStatus)" == complete
got=0
start nostate evidence desktop --state "$TMP/missing.json" >/dev/null 2>&1 || got=$?
check "missing --state file exits 1" test "$got" == 1
check "missing --state file creates no run directory" test ! -e "$(dir_of nostate desktop)"

check "no test session remains" gone "$TASK-"

exit "$fail"
