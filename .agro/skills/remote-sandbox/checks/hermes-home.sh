set -uo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
fails=0
result() { echo "RESULT $1 $2 ${3:-}"; [ "$2" = FAIL ] && fails=$((fails+1)); return 0; }
oneline() { sed 's/\x1b\[[0-9;]*m//g' "$@" | tail -3 | tr '\n' ' '; }
WS="$HOME/.agro/workspaces/harness"
CLI="$WS/.agro/cli/dist/agro.js"
HERMES="$HOME/.local/bin/hermes"
SENTINEL=agro-rcheck-sentinel-model
echo "== hermes generated home on $(. /etc/os-release; echo "$PRETTY_NAME"), ref=${AGRO_REF:-unset}"

echo "== H01"
curl -fsSL "${INSTALL_URL:-https://github.com/mifunedev/agro/releases/latest/download/install.sh}" -o /tmp/install.sh && bash /tmp/install.sh --yes >/tmp/install.log 2>&1; rc=$?; hash -r
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
[ $rc = 0 ] && agro --version >/dev/null 2>&1 && result H01-install-agro PASS "released agro $(agro --version 2>&1 | tail -1) node $(node --version 2>&1)" || result H01-install-agro FAIL "exit=$rc $(oneline /tmp/install.log)"

echo "== H02"
if [ -z "${AGRO_REF:-}" ]; then
  result H02-clone-ref FAIL "AGRO_REF is unset; set AGRO_REF to the branch under test"
elif git clone --quiet --branch "$AGRO_REF" https://github.com/mifunedev/agro "$WS" >/tmp/h02.log 2>&1; then
  result H02-clone-ref PASS "$WS ref=$(git -C "$WS" rev-parse --abbrev-ref HEAD)@$(git -C "$WS" rev-parse --short HEAD)"
else result H02-clone-ref FAIL "$(oneline /tmp/h02.log)"; fi

echo "== H03"
if [ ! -d "$WS/.git" ]; then result H03-cli-source SKIPPED "no workspace clone"
elif [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 20 ]; then result H03-cli-source FAIL "node $(node --version 2>&1) is older than 20"
elif (npm --prefix "$WS/.agro/cli" ci --ignore-scripts && npm --prefix "$WS/.agro/cli" run build) >/tmp/h03.log 2>&1 && [ -f "$CLI" ]; then
  result H03-cli-source PASS "source=$CLI version=$(node "$CLI" --version 2>&1 | tail -1) built from $(git -C "$WS" rev-parse --short HEAD) node=$(node --version)"
else result H03-cli-source FAIL "build failed: $(oneline /tmp/h03.log)"; fi
yver=$(node -p "require('$WS/package.json').devDependencies.yaml" 2>/dev/null); [[ "$yver" =~ ^[0-9] ]] || yver=latest
npm install --prefix /tmp/yamlp --no-save --no-package-lock "yaml@$yver" >/tmp/yaml.log 2>&1 || echo "-- yaml install failed: $(oneline /tmp/yaml.log)"
cat >/tmp/ycheck.cjs <<'EOF'
const fs = require("fs");
const YAML = require("yaml");
const [file, cwd, model] = process.argv.slice(2);
const doc = YAML.parse(fs.readFileSync(file, "utf8"), { intAsBigInt: true }) ?? {};
const at = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), doc);
const want = [
  ["model.default", model],
  ["model.provider", "openai-codex"],
  ["model.base_url", "https://chatgpt.com/backend-api/codex"],
  ["compression.codex_gpt55_autoraise", false],
  ["compression.auto_compact_percent", 85n],
  ["onboarding.seen.profile_build_offered", true],
  ["terminal.cwd", cwd],
];
const show = (v) => `${typeof v}:${String(v)}`;
const bad = want.filter(([k, v]) => at(k) !== v).map(([k, v]) => `${k}=${show(at(k))} want ${show(v)}`);
console.log(bad.length ? bad.join("; ") : `ok _config_version=${show(at("_config_version"))}`);
process.exit(bad.length ? 1 : 0);
EOF
ycheck() { NODE_PATH=/tmp/yamlp/node_modules node /tmp/ycheck.cjs "$WS/.hermes/config.yaml" "$WS" "$1" 2>&1 | tail -1; }
install_hermes() { (cd "$WS" && env -u HERMES_HOME node "$CLI" harness install hermes --host) >"$1" 2>&1; }

echo "== H04"
if [ -d "$WS/.git" ]; then
  tracked=$(git -C "$WS" ls-files .hermes)
  [ -z "$tracked" ] && result H04-untracked-home PASS "git ls-files .hermes is empty" || result H04-untracked-home FAIL "tracked: $(echo "$tracked" | tr '\n' ' ')"
else result H04-untracked-home SKIPPED "no workspace clone"; fi

echo "== H05"
if [ -f "$CLI" ]; then
  install_hermes /tmp/h05.log; rc=$?
  echo "-- first install log"; sed 's/\x1b\[[0-9;]*m//g' /tmp/h05.log | tail -12
  [ $rc = 0 ] && result H05-first-install PASS "exit=0" || result H05-first-install FAIL "exit=$rc $(oneline /tmp/h05.log)"
else rc=1; result H05-first-install SKIPPED "no CLI built from the clone"; fi

echo "== H06"
if [ $rc = 0 ] && [ -f "$WS/.hermes/config.yaml" ]; then
  echo "-- $WS/.hermes/config.yaml"; cat "$WS/.hermes/config.yaml"
  out=$(ycheck gpt-6.1-sol-900k) && result H06-seed-config PASS "$out" || result H06-seed-config FAIL "$out"
elif [ $rc = 0 ]; then result H06-seed-config FAIL "no $WS/.hermes/config.yaml after the first install"
else result H06-seed-config SKIPPED "first install did not pass"; fi

echo "== H07"
if [ $rc = 0 ]; then
  HERMES_HOME="$WS/.hermes" "$HERMES" config set model.default "$SENTINEL" >/tmp/h07s.log 2>&1; src=$?
  install_hermes /tmp/h07.log; rc2=$?
  echo "-- second install log"; sed 's/\x1b\[[0-9;]*m//g' /tmp/h07.log | tail -12
  echo "-- $WS/.hermes/config.yaml"; cat "$WS/.hermes/config.yaml" 2>&1
  out=$(ycheck "$SENTINEL")
  if [ $src != 0 ]; then result H07-operator-value-kept FAIL "hermes config set exit=$src $(oneline /tmp/h07s.log)"
  elif [ $rc2 != 0 ]; then result H07-operator-value-kept FAIL "second install exit=$rc2 $(oneline /tmp/h07.log)"
  elif [[ "$out" == ok* ]]; then result H07-operator-value-kept PASS "exit=0 model.default=$SENTINEL $out"
  else result H07-operator-value-kept FAIL "$out"; fi
else result H07-operator-value-kept SKIPPED "first install did not pass"; fi

echo "== H08"
if [ $rc = 0 ]; then
  st=$(git -C "$WS" status --short .hermes 2>&1)
  [ -z "$st" ] && result H08-clean-status PASS "git status --short .hermes is empty" || result H08-clean-status FAIL "$(echo "$st" | tr '\n' ' ')"
else result H08-clean-status SKIPPED "first install did not pass"; fi

echo "== H09"
if [ $rc = 0 ]; then
  echo "-- ls -la .hermes/skills"; ls -la "$WS/.hermes/skills" 2>&1
  link=$(readlink "$WS/.hermes/skills/agro" 2>/dev/null)
  [ "$link" = ../../.agro/skills ] && [ -d "$WS/.hermes/skills/agro" ] && result H09-skills-link PASS "agro -> $link" || result H09-skills-link FAIL "agro -> ${link:-missing}"
else result H09-skills-link SKIPPED "first install did not pass"; fi

echo "SUMMARY fails=$fails"
