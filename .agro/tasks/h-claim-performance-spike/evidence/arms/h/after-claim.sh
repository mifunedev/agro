#!/bin/sh
set -u
test $# -eq 2 || { echo "usage: after-claim.sh <ip> <logfile>" >&2; exit 64; }
ip=$1
log=$2
case ${DRIVER_DOCKER-} in
  true) docker_state=on ;;
  false) docker_state=off ;;
  *) echo "DRIVER_DOCKER must be true or false" >&2; exit 64 ;;
esac
case ${H_STREAM:-0} in
  0 | 1) stream=${H_STREAM:-0} ;;
  *) echo "H_STREAM must be 0 or 1" >&2; exit 64 ;;
esac
case ${H_PARALLEL_APT:-0} in
  0 | 1) parallel_apt=${H_PARALLEL_APT:-0} ;;
  *) echo "H_PARALLEL_APT must be 0 or 1" >&2; exit 64 ;;
esac
case ${H_ARCHIVE:-A0} in
  A0 | A1) variant=${H_ARCHIVE:-A0} ;;
  *) echo "H_ARCHIVE must be A0 or A1" >&2; exit 64 ;;
esac
levers="stream:$stream,apt:$parallel_apt,archive:$variant"
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
meta=$here/../../archives.json
url_file=${L2A_URL_FILE:-/tmp/claude-1001/-home-sandbox--agro-workspaces-harness/d98b3078-879c-41de-8f1d-36914b416edf/scratchpad/h-url-$variant}
test -s "$url_file" || { echo "missing url file" >&2; exit 66; }
pin() {
  python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]][sys.argv[3]])' "$meta" "$variant" "$1"
}
sha256=$(pin sha256) || { echo "no sha256 for $variant in $meta" >&2; exit 66; }
bytes=$(pin bytes) || { echo "no bytes for $variant in $meta" >&2; exit 66; }
key=${L2A_SSH_KEY:-$HOME/.ssh/id_ed25519}
remote() {
  ssh -i "$key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "sandbox@$ip" "$@"
}
stamp() {
  printf '%s local %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$*" >>"$log"
}
stamp "start ip=$ip sha256=$sha256 bytes=$bytes docker=$docker_state levers=$levers"
tr -d '\n' <"$url_file" | remote 'sudo install -m 0600 -o root -g root /dev/stdin /run/agro-l2a-url' || { stamp "url-handoff failed"; exit 1; }
stamp "url-handoff ok"
remote "sudo bash -s -- $sha256 $bytes $docker_state $stream $parallel_apt" >>"$log" 2>&1 <<'REMOTE'
set -u
sha256=$1
bytes=$2
docker_state=$3
stream=$4
parallel_apt=$5
work=/var/tmp
root=/
archive=$work/agro-l2a.tar.zst
listing=$work/agro-l2a.listing
stage=$work/agro-l2a-stage
pipes=$work/agro-l2a-pipes
t0=$(date +%s%3N)
step() {
  printf '%s remote step=%s elapsed_ms=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$1" "$(( $(date +%s%3N) - t0 ))" "${2-}"
}
fail() {
  step "$1" "result=fail ${2-}"
  rm -rf /run/agro-l2a-url "$archive" "$listing" "$stage" "$pipes"
  exit 1
}
fetch() {
  { printf 'url = "'; cat /run/agro-l2a-url; printf '"\n'; } | curl --config - --fail --silent --show-error --proto =https --tlsv1.2 --connect-timeout 10 --max-filesize "$bytes" "$@"
}
allowed='^(home/sandbox/(\.nvm|\.local|\.agro|\.t3)(/|$)|home/sandbox/agro\.code-workspace$|etc/agro/code-server\.yaml$|etc/systemd/system/agro-(code-server|t3|tailscaled)\.service$|usr/local/libexec/agro-(code-server-apply|code-server-enabled|init-editor-user-settings\.js|t3-project|gateway-session|install-zmx)$|usr/local/bin/zmx$)'
check_listing() {
  test "$(LC_ALL=C grep -Evc "$allowed" "$listing")" -eq 0 || fail extract "unexpected member"
  test "$(LC_ALL=C grep -Ec '(^|/)[.][.](/|$)|^/|//' "$listing")" -eq 0 || fail extract "unsafe member"
}
preexisting() {
  for p in usr/local/bin/zmx usr/local/libexec/agro-install-zmx usr/local/libexec/agro-gateway-session; do
    test -e "$root$p" && printf '%s,' "/$p"
  done
}
activate() {
  local parent entry link=--link
  for parent in home/sandbox etc/agro etc/systemd/system usr/local/libexec usr/local/bin; do
    test -d "$stage/$parent" || continue
    mkdir -p "$root$parent" || return 1
    test "$(stat -c %d "$stage")" = "$(stat -c %d "$root$parent")" || link=
    for entry in "$stage/$parent"/* "$stage/$parent"/.[!.]*; do
      test -e "$entry" || test -L "$entry" || continue
      cp -a $link --update=none "$entry" "$root$parent/" || return 1
    done
  done
}
apt_install() {
  local apt_get="apt-get -o DPkg::Lock::Timeout=600"
  env DEBIAN_FRONTEND=noninteractive $apt_get install -y $missing || { $apt_get update && env DEBIAN_FRONTEND=noninteractive $apt_get install -y $missing; }
}
test "$(id -u sandbox)" = 1001 || fail preflight "sandbox uid $(id -u sandbox) != 1001"
missing=$(for p in gh libatomic1; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || printf '%s ' "$p"; done)
missing=${missing% }
apt_pid=
if test -n "$missing" && test "$parallel_apt" = 1; then
  apt_install </dev/null >/dev/null 2>&1 &
  apt_pid=$!
fi
if test "$docker_state" = on; then
  systemctl enable --now docker.socket docker.service containerd.service </dev/null >/dev/null 2>&1 &
else
  systemctl disable --now docker.socket docker.service containerd.service </dev/null >/dev/null 2>&1 &
fi
docker_pid=$!
if test "$stream" = 1; then
  rm -rf "$stage" "$pipes" "$listing"
  install -d -m 0700 -o root -g root "$stage" "$pipes" || fail fetch "stage setup"
  mkfifo "$pipes/sha" "$pipes/count" || fail fetch "fifo setup"
  sha256sum <"$pipes/sha" >"$pipes/sha.out" &
  hash_pid=$!
  wc -c <"$pipes/count" >"$pipes/count.out" &
  count_pid=$!
  fetch --output - | tee "$pipes/sha" "$pipes/count" | zstd -dc | tar --extract --file=- --directory="$stage" --numeric-owner --same-owner --same-permissions --verbose --index-file="$listing" --quoting-style=escape
  pipe="${PIPESTATUS[*]}"
  wait "$hash_pid" "$count_pid"
  rm -f /run/agro-l2a-url
  read -r curl_rc tee_rc _ <<<"$pipe"
  got_bytes=$(tr -d '[:space:]' <"$pipes/count.out")
  got_sha=$(cut -d ' ' -f 1 <"$pipes/sha.out")
  test "$curl_rc" = 0 || test "$tee_rc" != 0 || fail fetch "curl exit $curl_rc pipe=$pipe"
  step fetch "result=ok mode=stream bytes=$got_bytes"
  test "$got_bytes" = "$bytes" || fail verify "size mismatch bytes=$got_bytes pipe=$pipe"
  test "$got_sha" = "$sha256" || fail verify "sha256 mismatch pipe=$pipe"
  step verify "result=ok mode=stream sha256=$sha256"
  test "$pipe" = "0 0 0 0" || fail extract "pipe=$pipe"
  check_listing
  kept=$(preexisting)
  activate || fail extract "activate failed"
  rm -rf "$stage" "$pipes" "$listing"
  step extract "result=ok mode=stream kept_existing=${kept:-none}"
  step stream "result=ok"
else
  fetch --output "$archive" || fail fetch "curl exit $?"
  rm -f /run/agro-l2a-url
  step fetch "result=ok bytes=$(wc -c <"$archive")"
  test "$(wc -c <"$archive")" -eq "$bytes" || fail verify "size mismatch"
  test "$(sha256sum <"$archive" | cut -d ' ' -f 1)" = "$sha256" || fail verify "sha256 mismatch"
  step verify "result=ok sha256=$sha256"
  tar --list --file="$archive" --use-compress-program=zstd --quoting-style=escape >"$listing" || fail extract "list failed"
  check_listing
  kept=$(preexisting)
  tar --extract --file="$archive" --directory="$root" --use-compress-program=zstd --numeric-owner --same-owner --same-permissions --skip-old-files || fail extract "tar exit $?"
  rm -f "$archive" "$listing"
  step extract "result=ok kept_existing=${kept:-none}"
fi
apt_t=$(date +%s%3N)
if test -n "$apt_pid"; then
  wait "$apt_pid" || fail install "apt $missing"
  apt_mode=parallel
elif test -n "$missing"; then
  apt_install </dev/null >/dev/null 2>&1 || fail install "apt $missing"
  apt_mode=inline
else
  apt_mode=skipped
fi
apt_ms=$(( $(date +%s%3N) - apt_t ))
for line in 'export NVM_DIR="$HOME/.nvm"' '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'; do
  grep -qxF "$line" /home/sandbox/.bashrc 2>/dev/null || printf '%s\n' "$line" >>/home/sandbox/.bashrc
done
install -d -o root -g root -m 0700 /var/lib/agro
test -e /var/lib/agro/runtime-settings-apply.lock || install -o root -g root -m 0600 /dev/null /var/lib/agro/runtime-settings-apply.lock
systemctl daemon-reload || fail install "daemon-reload"
step install "result=ok apt_added=${missing:-none} apt=$apt_mode apt_ms=$apt_ms"
helper() {
  env SSH_ORIGINAL_COMMAND="$1" SSH_CONNECTION=claim /usr/local/libexec/agro-code-server-apply </dev/null >/dev/null 2>&1
}
wait "$docker_pid"
docker_rc=$?
waited=0
until helper "runtime-settings apply --generation 1 --action enable"; do
  test "$waited" -lt 120 || fail apps-up "runtime-settings apply"
  sleep 1
  waited=$((waited + 1))
done
if test "$docker_state" = on; then
  start_apps="start-apps --docker --t3"
else
  test "$docker_rc" = 0 || fail docker "disable failed"
  if id -nG sandbox | tr ' ' '\n' | grep -qx docker; then gpasswd -d sandbox docker >/dev/null || fail docker "gpasswd failed"; fi
  ! systemctl is-active --quiet docker.service || fail docker "docker still active"
  step docker "result=ok docker=off"
  start_apps="start-apps --t3"
fi
waited=0
until helper "$start_apps"; do
  test "$waited" -lt 120 || fail apps-up "$start_apps"
  sleep 1
  waited=$((waited + 1))
done
if test "$docker_state" = on; then
  docker info >/dev/null 2>&1 || fail docker "docker info failed"
  step docker "result=ok docker=on"
fi
step apps-started "result=ok"
deadline=$(( $(date +%s) + 180 ))
while :; do
  ws=no
  setpriv --reuid=sandbox --regid=sandbox --init-groups -- env -i HOME=/home/sandbox PATH=/home/sandbox/.local/bin:/usr/bin:/bin bash -lc 'agro workspace list' 2>/dev/null | grep -qE '^harness[[:space:]]' && ws=yes
  cs=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8080/)
  t3=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3773/)
  if test "$ws:$cs:$t3" = yes:200:200; then
    step apps-up "result=ok workspace_harness=$ws code_server=$cs t3=$t3"
    exit 0
  fi
  test "$(date +%s)" -lt "$deadline" || fail apps-up "workspace_harness=$ws code_server=$cs t3=$t3"
  sleep 0.5
done
REMOTE
status=$?
stamp "done exit=$status"
test "$status" -eq 0 && printf '{"archive_sha256":"%s","docker":"%s","archive":"%s","levers":"%s"}\n' "$sha256" "$docker_state" "$variant" "$levers"
exit "$status"
