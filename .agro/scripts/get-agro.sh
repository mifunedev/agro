#!/usr/bin/env bash
set -euo pipefail

trap 'printf "\n\033[0;31mERROR:\033[0m get-agro.sh aborted (exit %s) at line %s: %s\n" "$?" "$LINENO" "$BASH_COMMAND" >&2' ERR

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
banner() { printf "\n${CYAN}==> %s${NC}\n" "$*"; }
ok()     { printf "${GREEN} ✓  %s${NC}\n" "$*"; }
warn()   { printf "${YELLOW}WARN: %s${NC}\n" "$*" >&2; }
die()    { printf "${RED}ERROR: %s${NC}\n" "$*" >&2; exit 1; }
cleanup() { [ -n "${TMP:-}" ] && rm -rf "$TMP" 2>/dev/null || true; }

agro_env() {
  local agro_key="AGRO_$1" legacy_key="OH_$1" agro_value legacy_value
  agro_value="${!agro_key:-}"
  legacy_value="${!legacy_key:-}"
  if [ -n "$agro_value" ]; then
    if [ -n "$legacy_value" ] && [ "$agro_value" != "$legacy_value" ]; then
      printf 'get-agro.sh: %s and %s are both set and differ — using %s\n' "$agro_key" "$legacy_key" "$agro_key" >&2
    fi
    printf 'agro\t%s\n' "$agro_value"
    return 0
  fi
  if [ -n "$legacy_value" ]; then
    printf 'legacy\t%s\n' "$legacy_value"
    return 0
  fi
  printf 'none\t%s\n' "$2"
}

AGRO_GITHUB_REPO="$(agro_env GITHUB_REPO "" | cut -f2-)"
AGRO_GITHUB_REPO="${AGRO_GITHUB_REPO:-mifunedev/agro}"
if [[ ! "$AGRO_GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  die "AGRO_GITHUB_REPO must be <owner>/<repo>: got '$AGRO_GITHUB_REPO'"
fi
RELEASE_BASE="https://github.com/$AGRO_GITHUB_REPO/releases/latest/download"

if [ "${1:-}" = "--resolve" ]; then
  [ $# -eq 3 ] || die "--resolve takes exactly <SUFFIX> <default>"
  agro_env "$2" "$3"
  exit 0
fi

prompt_yn() {
  local __msg="$1"; local __default="${2:-y}"
  if [ "${ASSUME_YES:-false}" = true ]; then return 0; fi
  if [ "${ASSUME_NO:-false}" = true ]; then return 1; fi
  local __bracket
  if [ "$__default" = "y" ] || [ "$__default" = "Y" ]; then __bracket="[Y/n]"; else __bracket="[y/N]"; fi
  if [ -r /dev/tty ]; then
    local __reply
    printf "  %s %s: " "$__msg" "$__bracket"
    read -r __reply </dev/tty || __reply=""
    __reply="${__reply:-$__default}"
    case "$__reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
  else
    warn "No TTY available — using default for: $__msg"
    case "$__default" in [Yy]*) return 0 ;; *) return 1 ;; esac
  fi
}

print_help() {
  cat <<HELPEOF
AGRO — install the standalone 'agro' CLI

Usage:
  curl -fsSL $RELEASE_BASE/get-agro.sh | bash
  curl -fsSL -o get-agro.sh $RELEASE_BASE/get-agro.sh
  # Review get-agro.sh in your editor or pager, then:
  bash get-agro.sh

Installs the prebuilt single-file 'agro' artifact to ~/.local/bin/agro. Nothing
is cloned or built on this host. Then: agro sandbox install docker

Prerequisites:
  curl
  Node.js >= 20   (to RUN 'agro'; if missing, this script offers to install nvm + Node 22)

Flags:
  -y, --yes            Accept prompts (e.g. auto-install nvm + Node 22).
  -n, --no             Decline prompts.
  -h, --help           Show this help and exit.

Env vars:
  AGRO_BIN_DIR         Where to install 'agro' (default: ~/.local/bin)
  AGRO_JS_URL          Prebuilt artifact URL
                       (default: $RELEASE_BASE/agro.js)
  AGRO_GITHUB_REPO     <owner>/<repo> whose latest GitHub release hosts the artifacts
                       (default: mifunedev/agro)
  AGRO_NVM_VERSION     nvm version tag for the Node install (default: v0.40.3)
  AGRO_ASSUME_YES      Non-empty accepts prompts (same as --yes)

  Each AGRO_<NAME> falls back to the legacy OH_<NAME> spelling. When both are
  set and differ, the AGRO value wins and a warning names the two keys.

Alternative:
  npm install -g @mifune/agro

Examples:
  curl -fsSL $RELEASE_BASE/get-agro.sh | bash -s -- --yes
  AGRO_BIN_DIR=/usr/local/bin bash get-agro.sh
HELPEOF
}

ASSUME_YES="${ASSUME_YES:-}"
if [ -z "$ASSUME_YES" ] && [ -n "$(agro_env ASSUME_YES "" | cut -f2-)" ]; then ASSUME_YES=true; fi
ASSUME_YES="${ASSUME_YES:-false}"
ASSUME_NO="${ASSUME_NO:-false}"
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true ;;
    -n|--no)  ASSUME_NO=true ;;
    -h|--help) print_help; exit 0 ;;
    --yes=*|--no=*) die "Flags do not take =value (got '$1'). Use '--yes'." ;;
    *) warn "Unknown argument: $1 (ignoring)" ;;
  esac
  shift
done
[ "$ASSUME_YES" = true ] && [ "$ASSUME_NO" = true ] && die "--yes and --no are mutually exclusive."

AGRO_BIN_DIR="$(agro_env BIN_DIR "$HOME/.local/bin" | cut -f2-)"
AGRO_JS_URL="$(agro_env JS_URL "$RELEASE_BASE/agro.js" | cut -f2-)"
AGRO_NVM_VERSION="$(agro_env NVM_VERSION "v0.40.3" | cut -f2-)"

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

install_node_via_nvm() {
  banner "Installing nvm + Node 22"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${AGRO_NVM_VERSION}/install.sh" | bash
  fi
  set +eu
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
  set -eu
}

ensure_node() {
  banner "Checking Node.js"
  if command -v node >/dev/null 2>&1 && [ "$(node_major)" -ge 20 ] 2>/dev/null; then
    ok "Node.js $(node --version) — OK"; return 0
  fi
  if command -v node >/dev/null 2>&1; then
    warn "Node.js $(node --version) is too old (need >= 20)"
  else
    warn "Node.js not found (need >= 20 to run 'agro')"
  fi
  if prompt_yn "Install nvm + Node 22 now?" y; then
    install_node_via_nvm
  else
    die "Node.js >= 20 is required to run 'agro'. Install it from https://nodejs.org and re-run."
  fi
  command -v node >/dev/null 2>&1 && [ "$(node_major)" -ge 20 ] 2>/dev/null \
    || die "Node.js >= 20 still not available after install."
  ok "Node.js $(node --version) — OK"
}

printf "\n${CYAN}╔══════════════════════════════════════╗${NC}\n"
printf "${CYAN}║       AGRO — install 'agro' CLI      ║${NC}\n"
printf "${CYAN}╚══════════════════════════════════════╝${NC}\n\n"

command -v curl >/dev/null 2>&1 || die "curl is required to download the 'agro' artifact. Install curl and re-run, or use: npm install -g @mifune/agro"

ensure_node

TMP="$(mktemp -d)"
trap 'cleanup' EXIT

banner "Fetching the 'agro' CLI"
fetch_failed="Could not download a valid 'agro' artifact from $AGRO_JS_URL. Retry later, set AGRO_JS_URL to a reachable release asset, or install with: npm install -g @mifune/agro"
curl -fsSL "$AGRO_JS_URL" -o "$TMP/agro.js" 2>/dev/null || die "$fetch_failed"
head -n1 "$TMP/agro.js" | grep -q '^#!' || die "$fetch_failed"
ok "Downloaded prebuilt 'agro' from $AGRO_JS_URL"

banner "Installing 'agro' to $AGRO_BIN_DIR/agro"
mkdir -p "$AGRO_BIN_DIR"
install -m 0755 "$TMP/agro.js" "$AGRO_BIN_DIR/agro"
ok "Installed $AGRO_BIN_DIR/agro"

EXPORT_LINE="export PATH=\"$AGRO_BIN_DIR:\$PATH\""
case ":$PATH:" in
  *":$AGRO_BIN_DIR:"*) PATH_OK=1 ;;
  *) PATH_OK=0 ;;
esac
if [ "$PATH_OK" = "0" ]; then
  for prof in "$HOME/.zprofile" "$HOME/.profile" "$HOME/.bashrc"; do
    if [ -f "$prof" ] && ! grep -qsF "$AGRO_BIN_DIR" "$prof"; then
      printf '\n# Added by AGRO get-agro.sh\n%s\n' "$EXPORT_LINE" >> "$prof"
      ok "Added $AGRO_BIN_DIR to PATH in $prof (for new shells)"
      break
    fi
  done
fi

banner "Done"
ok "agro $("$AGRO_BIN_DIR/agro" --version 2>/dev/null || echo '(run: agro --version)')"
cat <<DONEEOF

Next steps:
  agro sandbox install docker   # create and start a sandbox (needs Docker + Compose)
  agro shell <name>             # open a shell in it
  agro tool install herdr       # then run: herdr
  agro update                   # upgrade this installed CLI later

'agro' is a single file at $AGRO_BIN_DIR/agro — nothing was cloned or built.
DONEEOF

if [ "$PATH_OK" = "0" ]; then
  printf "\n${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${YELLOW}║  ACTION REQUIRED — activate 'agro' in your CURRENT shell      ║${NC}\n"
  printf "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}\n"
  printf "  '%s' is on PATH for NEW shells. For THIS shell, run:\n\n" "$AGRO_BIN_DIR"
  printf "    ${GREEN}%s${NC}\n\n" "$EXPORT_LINE"
  printf "  …or just open a new terminal.\n"
fi
