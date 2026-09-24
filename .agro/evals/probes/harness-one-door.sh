#!/usr/bin/env bash
# tier: A
# source: #948 — `agro harness install` / `agro tool install` are the only door; boot
#         installs nothing, so no default set, no install.* keys, no persist
#         flags, no provisioner, and no AGRO_PROVISION_DEFAULTS off-ramp survive
# desc: neither catalog declares kind:"default", harnessKey or toolKey; no boot
#       provisioner, install.* config key, AGRO_PROVISION_DEFAULTS gate or
#       provision-failed marker remains under .devcontainer/, .agro/scripts/ or
#       .github/; catalog.ts declares SANDBOX_HARNESS_PREFIX and it equals the
#       Dockerfile's NPM_USER_PREFIX, which is what lets HARNESS_PREFIX_TOKEN
#       count as that prefix; every installable entry without
#       hostInstallUser:"root" installs as the sandbox user into NPM_USER_PREFIX,
#       checksums what it downloads, and is absent from the image; and every
#       root-level tool is host-capable and host-only (no container installArgv),
#       and reaches root only through the `sudo -n` path in commands/tool.ts.
set -euo pipefail

ROOT="${HARNESS_ONE_DOOR_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
HARNESSES="$ROOT/.agro/cli/src/lib/harnesses/catalog.ts"
TOOLS="$ROOT/.agro/cli/src/lib/tools/catalog.ts"
TOOL_CMD="$ROOT/.agro/cli/src/commands/tool.ts"
CONFIG="$ROOT/.agro/cli/src/lib/agro-config.ts"
DOCKERFILE="$ROOT/.devcontainer/Dockerfile"

for f in "$HARNESSES" "$TOOLS" "$TOOL_CMD" "$CONFIG" "$DOCKERFILE"; do
  if [[ ! -f $f ]]; then
    echo "SKIPPED: absent: ${f#"$ROOT/"}" >&2
    exit 2
  fi
done

PREFIX=$(sed -n 's/^ENV NPM_USER_PREFIX="\([^"]*\)".*/\1/p' "$DOCKERFILE" | head -1)
if [[ -z $PREFIX ]]; then
  echo "SKIPPED: Dockerfile declares no ENV NPM_USER_PREFIX to anchor the install prefix" >&2
  exit 2
fi

missing=()

SANDBOX_PREFIX=$(sed -n 's/^export const SANDBOX_HARNESS_PREFIX = "\([^"]*\)".*/\1/p' "$HARNESSES" | head -1)
PREFIX_TOKEN=$(sed -n 's/^export const HARNESS_PREFIX_TOKEN = "\([^"]*\)".*/\1/p' "$HARNESSES" | head -1)
token_resolves=0
if [[ -z $SANDBOX_PREFIX ]]; then
  missing+=("harnesses/catalog.ts: declares no SANDBOX_HARNESS_PREFIX — nothing ties the install prefix back to the Dockerfile's NPM_USER_PREFIX ('$PREFIX'), so a prefix token could resolve anywhere")
elif [[ $SANDBOX_PREFIX != "$PREFIX" ]]; then
  missing+=("harnesses/catalog.ts: SANDBOX_HARNESS_PREFIX is '$SANDBOX_PREFIX' but the Dockerfile's NPM_USER_PREFIX is '$PREFIX' — the install prefix must be the sandbox home prefix, not a system path")
elif [[ -z $PREFIX_TOKEN ]]; then
  missing+=("harnesses/catalog.ts: declares no HARNESS_PREFIX_TOKEN — the per-entry prefix check accepts the token only when the catalog defines it")
else
  token_resolves=1
fi

for catalog in "$HARNESSES" "$TOOLS"; do
  name=${catalog#"$ROOT/"}
  text=$(cat "$catalog")
  if grep -qF 'kind: "default"' <<<"$text"; then
    missing+=("$name: declares kind: \"default\" — nothing installs at boot, so no entry may be a default")
  fi
  if grep -qE 'harnessKey|toolKey' <<<"$text"; then
    missing+=("$name: declares harnessKey/toolKey — those named an agro.json install flag, and agro.json decides no install")
  fi
done

PROVISIONER="$ROOT/.agro/scripts/provision-defaults.sh"
if [[ -e $PROVISIONER ]]; then
  missing+=(".agro/scripts/provision-defaults.sh exists — the boot path installs nothing; \`agro harness install\` / \`agro tool install\` are the only door")
fi

config_text=$(cat "$CONFIG")
if grep -qE '(^|[^A-Za-z])install[.:]|"install"' <<<"$config_text"; then
  missing+=(".agro/cli/src/lib/agro-config.ts: carries an install key — a second place that decides what gets installed")
fi

for dir in .devcontainer .agro/scripts .github; do
  [[ -d "$ROOT/$dir" ]] || continue
  hits=$(grep -rlE 'AGRO_PROVISION_DEFAULTS|provision-failed' "$ROOT/$dir" 2>/dev/null || true)
  if [[ -n $hits ]]; then
    missing+=("$dir: AGRO_PROVISION_DEFAULTS or the provision-failed marker is back in: $(tr '\n' ' ' <<<"${hits//$ROOT\//}")")
  fi
done

dockerfile_code=$(grep -vE '^[[:space:]]*#' "$DOCKERFILE")

pnpm_home=$(sed -n 's/^ENV PNPM_HOME="\([^"]*\)".*/\1/p' "$DOCKERFILE" | head -1)
if [[ -z $pnpm_home || $pnpm_home != "$PREFIX"/* ]]; then
  missing+=("Dockerfile: PNPM_HOME ('$pnpm_home') is not under $PREFIX — a pnpm install would land outside the home mount this probe anchors on")
fi

harness_entries=$(awk '
  /^  \{$/   { buf=""; inb=1; next }
  /^  \},$/  { if (inb) print buf; inb=0; next }
  inb        { buf = buf $0 " " }
' "$HARNESSES")

tool_entries=$(awk '
  /^  Object\.freeze\(\{$/ { buf=""; inb=1; next }
  /^  \}\),$/              { if (inb) print buf; inb=0; next }
  inb                      { buf = buf $0 " " }
' "$TOOLS")

installable=0
checksummed=0
root_level=0

check_root_entry() {
  local name="$1" entry="$2" id="$3"

  root_level=$((root_level + 1))

  if [[ $entry != *'hostCapable: true'* ]]; then
    missing+=("$name: \"$id\" is root-level but not hostCapable — a root-level install exists only on the host")
  fi
  if [[ $entry =~ (^|[^A-Za-z])installArgv: ]]; then
    missing+=("$name: \"$id\" is root-level but declares a container installArgv — a root install in the sandbox becomes an interactive \`sudo\`, and /etc/sudoers.d/sandbox has no NOPASSWD")
  fi
  if [[ $entry =~ (^|[^A-Za-z])installUser:\ \"root\" ]]; then
    missing+=("$name: \"$id\" declares installUser: \"root\" — only the host install of a tool may be root-level")
  fi
  if [[ $entry != *'hostInstallArgv:'* ]]; then
    missing+=("$name: \"$id\" is root-level but declares no hostInstallArgv — nothing installs it")
  fi
}

check_entry() {
  local name="$1" entry="$2" id="$3"
  local fingerprints=() fp argv token

  installable=$((installable + 1))

  if [[ $entry != *'installUser: "sandbox"'* ]]; then
    missing+=("$name: \"$id\" does not install as the sandbox user — commands install with stdio:\"inherit\", so a root install becomes an interactive \`sudo\` and /etc/sudoers.d/sandbox has no NOPASSWD")
  fi
  local prefixed=0
  if [[ $entry == *"$PREFIX"* || $entry == *'$HOME/.local'* || $entry == *'NPM_USER_PREFIX'* || $entry == *'PNPM_HOME'* ]]; then
    prefixed=1
  elif ((token_resolves)) && [[ $entry == *"$PREFIX_TOKEN"* || $entry == *HARNESS_PREFIX_TOKEN* ]]; then
    prefixed=1
  fi
  if ((prefixed == 0)); then
    missing+=("$name: \"$id\" does not install into $PREFIX — a system-path install cannot be upgraded by a running sandbox and does not persist in the home mount")
  fi
  if [[ $entry == *'curl'*' -o '* ]]; then
    checksummed=$((checksummed + 1))
    if [[ $entry != *'sha256sum -c -'* ]]; then
      missing+=("$name: \"$id\" downloads an artifact without \`sha256sum -c -\` — an unverified binary lands straight in the agent's PATH")
    fi
  fi

  while IFS= read -r fp; do
    [[ -n $fp ]] && fingerprints+=("$fp")
  done < <(grep -oE 'https://[a-z0-9.-]+(/[A-Za-z0-9._-]+){1,2}' <<<"$entry" | sort -u)
  while IFS= read -r fp; do
    [[ -n $fp ]] && fingerprints+=("$fp")
  done < <(grep -oE '[A-Za-z0-9@._/-]+@[0-9]+\.[0-9]+\.[0-9]+' <<<"$entry" | sort -u)
  if [[ $entry =~ installArgv:\ \[[[:space:]]*\"npm\" ]]; then
    argv=${entry#*installArgv: [}
    token=$(grep -oE '"[^" ]+"' <<<"${argv%%]*}" | tr -d '"' | grep -vE "^-|^npm$|^install$|^$PREFIX" | grep -vxF "${PREFIX_TOKEN:-}" | tail -1)
    [[ -n $token ]] && fingerprints+=("$token")
  fi

  if ((${#fingerprints[@]} == 0)); then
    missing+=("$name: \"$id\" yields no package or download fingerprint, so the no-bake check cannot be applied to it")
    return
  fi
  for fp in "${fingerprints[@]}"; do
    if grep -qF -- "$fp" <<<"$dockerfile_code"; then
      missing+=("Dockerfile: names $fp — \"$id\" is baked into the image again; it belongs to the install verb, which installs it into $PREFIX")
    fi
  done
  if grep -qE "(install|cp|mv|ln)[^#]*/bin/$(sed -n 's/.*binary: "\([^"]*\)".*/\1/p' <<<"$entry")\b" <<<"$dockerfile_code"; then
    missing+=("Dockerfile: installs a binary for \"$id\" into a bin directory — the image ships no entry the CLI can install")
  fi
}

while IFS= read -r entry; do
  [[ $entry == *'kind: "installable"'* ]] || continue
  id=$(sed -n 's/.*id: "\([^"]*\)".*/\1/p' <<<"$entry")
  [[ -n $id ]] || continue
  check_entry "harnesses/catalog.ts" "$entry" "$id"
done <<<"$harness_entries"

harness_installable=$installable
if ((harness_installable == 0)); then
  missing+=("harnesses/catalog.ts: no kind:\"installable\" harness parsed, so every per-entry rule below would pass vacuously")
fi

while IFS= read -r entry; do
  [[ $entry == *'kind: "installable"'* ]] || continue
  id=$(sed -n 's/.*id: "\([^"]*\)".*/\1/p' <<<"$entry")
  [[ -n $id ]] || continue
  if [[ $entry == *'hostInstallUser: "root"'* ]]; then
    check_root_entry "tools/catalog.ts" "$entry" "$id"
  else
    check_entry "tools/catalog.ts" "$entry" "$id"
  fi
done <<<"$tool_entries"

if ((root_level)); then
  tool_code=$(cat "$TOOL_CMD")
  if ! grep -qE 'const sudo = entry\.hostInstallUser === "root"' <<<"$tool_code"; then
    missing+=("commands/tool.ts: \`sudo\` is not gated on entry.hostInstallUser === \"root\" — a user-level install could reach root")
  fi
  if ! grep -qF 'sudo ? ["sudo", "-n", "--", ...argv] : argv' <<<"$tool_code"; then
    missing+=("commands/tool.ts: the root-level install does not run through \`sudo -n --\` — a root install must never prompt for a password")
  fi
  if grep -qE '"sudo",[[:space:]]*"[^-]|"sudo",[[:space:]]*"-[^n]|"sudo"[[:space:]]*[])]' <<<"$tool_code"; then
    missing+=("commands/tool.ts: runs \`sudo\` without \`-n\` — every path to root must be non-interactive")
  fi
fi

if ((installable == harness_installable)); then
  missing+=("tools/catalog.ts: no kind:\"installable\" tool parsed, so the tool half would pass vacuously")
fi
if ((checksummed == 0)); then
  missing+=("no installable entry downloads an artifact, so the sha256 rule would pass vacuously")
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: no default set, install key, provisioner or boot-time off-ramp remains, SANDBOX_HARNESS_PREFIX resolves $PREFIX_TOKEN to $PREFIX, all $installable user-level installable entries install as the sandbox user into $PREFIX, checksum their $checksummed downloads, and stay out of the image, and all $root_level root-level tools are host-only behind the sudo -n path in commands/tool.ts" >&2
