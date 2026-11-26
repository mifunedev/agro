#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")

SECRET_NAME='(TOKEN|SECRET|PASSWORD|PASSWD|APIKEY|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL|AUTH|BEARER|SESSION|COOKIE|SLACK_[A-Z_]*|OPENAI_[A-Z_]*|ANTHROPIC_[A-Z_]*|GITHUB_TOKEN|GH_TOKEN|AWS_SECRET|AWS_SESSION|GCP_[A-Z_]*|DATABASE_URL|DB_PASSWORD)'

raw_cmd=$cmd

if command -v perl >/dev/null 2>&1; then
  cmd=$(perl -0777 -pe 's{<<(-)?\s*(["\x27]?)(\w+)\2(.*?)\n(?(1)\t*)\3(?=\n|$)}{<<HEREDOC_STRIPPED}gs' <<<"$cmd")
fi

cmd=${cmd//$'\n'/ }

literal_cmd=$cmd
if command -v perl >/dev/null 2>&1; then
  literal_cmd=$(perl -pe 's{((?:^|[^A-Za-z0-9_./-])jq(?:\s+-[^\s\x27"]*)*(?:\s+--(?:arg|argjson)\s+[^\s\x27"]+\s+[^\s\x27"]+)*(?:\s+-[^\s\x27"]*)*\s+)\x27([^\x27]*)\x27}{my ($p, $f) = ($1, $2); $f =~ s/"((?:[^"\\]|\\.)*)"/index($1, "\\(") >= 0 ? "\"$1\"" : "\"\""/ge; "$p\x27$f\x27"}ge' <<<"$cmd") || literal_cmd=$cmd
fi

ENV_DUMP='(^|[^A-Za-z0-9._/-])env[[:space:]]*[|>;&]'
ENV_DUMP+='|(^|[^A-Za-z0-9._/-])env[[:space:]]*$'
ENV_DUMP+='|\bset[[:space:]]*[|>]'
ENV_DUMP+='|\bprintenv[[:space:]]*([|;>&]|$)'

SHELL_RUNNER='(^|[[:space:];&|(`/])(sh|bash|zsh|dash|ksh|fish)([[:space:]]+-[^[:space:]]*)*[[:space:]]+-[A-Za-z]*c([[:space:]]|$)'
SHELL_RUNNER+='|(^|[[:space:];&|(`/])su[[:space:]]([^;&|]*[[:space:]])?-[A-Za-z]*c([[:space:]]|$)'
SHELL_RUNNER+='|(^|[[:space:];&|(`/])(eval|ssh|xargs|watch|tmux|screen)([[:space:]]|$)'

REMOTE_EXEC='\b(docker|podman|nerdctl|kubectl)[[:space:]]+([^|;&]*[[:space:]])?exec([[:space:]]|$)'
REMOTE_EXEC+='|\bagro[[:space:]]+hands[[:space:]]+exec([[:space:]]|$)'
REMOTE_EXEC+="|${SHELL_RUNNER}"
REMOTE_ENV_READ="\\bprintenv[[:space:]]+([^|;&]*[[:space:]])?[\"']?[A-Z0-9_]*${SECRET_NAME}[A-Z0-9_]*"
REMOTE_ENV_READ+="|(^|[^A-Za-z0-9._/-])(env|printenv)[[:space:]]*[\"'][[:space:]]*([|;>&)]|\$)"

DENY='\bexport[[:space:]]+-p\b'
DENY+='|\bdeclare[[:space:]]+-[xp]\b'
DENY+='|\bcompgen[[:space:]]+-[vxAe]'
DENY+='|/proc/[^/[:space:]]+/environ'
HIST_WRAPPERS='((builtin|command|exec|eval|sudo|nohup|time|env)[[:space:]]+)*'
DENY+="|(^|[;&|(\`])[[:space:]]*${HIST_WRAPPERS}history\\b"
DENY+="|(^|[[:space:]])-[A-Za-z]*c[[:space:]]+[\"']?${HIST_WRAPPERS}history\\b"
DENY+='|\bfc[[:space:]]+-l'
DENY+="|\\b(echo|printf)\\b[^#]*\\\$\\{?[A-Z0-9_]*${SECRET_NAME}[A-Z0-9_]*\\}?"
DENY+="|Authorization:[[:space:]]*['\"]?(Bearer|Basic|Token)[[:space:]]+\\\$"
DENY+='|\baws[[:space:]]+configure[[:space:]]+get\b'
DENY+='|\bgh[[:space:]]+auth[[:space:]]+token\b'
DENY+='|\bagro[[:space:]]+secret[[:space:]]+get\b'
DENY+='|\bgcloud[[:space:]]+auth[[:space:]]+print-(access|identity)-token\b'
DENY+='|\bkubectl[[:space:]]+get[[:space:]]+secret[^|]*-o[[:space:]]*(yaml|json)'
DENY+='|\bdocker[[:space:]]+(secret|config)[[:space:]]+inspect\b'

STDIN_SCRIPT_ENV_READ=''
if command -v perl >/dev/null 2>&1; then
  STDIN_SCRIPT_ENV_READ=$(SECRET_NAME=$SECRET_NAME DENY=$DENY perl -e '
    my ($secret, $deny_src) = @ENV{qw(SECRET_NAME DENY)};
    my $read = qr/process\s*(?:\.|\[)\s*["\x27]?env\b|\benviron\b|getenv|%ENV\b|\$ENV\{|\bENV\s*(?:\[|\.)|\$\{?[A-Z0-9_]*$secret[A-Z0-9_]*\}?/;
    my $dump = qr/(?:^|[;&|(])[ \t]*(?:(?:sudo|exec|command|builtin)[ \t]+)*(?:env|printenv|set)[ \t]*(?:$|[|;&>)])/m;
    my $deny = qr/$deny_src/mi;
    my $redirect = qr/\d*[<>]+&[\d-]|&>>?/;
    sub interp_kind {
      my $s = shift;
      $s =~ s/$redirect/ /g;
      $s =~ s/\d*[<>]+\s*[^\s<>]*//g;
      my @w = map { s/["\x27]//gr } split " ", $s;
      while (@w) {
        my $word = $w[0] =~ s{.*/}{}r;
        if ($word =~ /^\w+=/ || $word =~ /^(exec|command|builtin|nohup|time)$/) { shift @w }
        elsif ($word =~ /^(env|sudo|doas)$/) {
          shift @w;
          while (@w && $w[0] =~ /^-|^\w+=/) { my $o = shift @w; shift @w if $o =~ /^-[ugCDhprtUS]$/ }
        }
        elsif ($word =~ /^(docker|podman|nerdctl|kubectl)$/) {
          shift @w;
          shift @w while @w && $w[0] =~ /^(compose|container)$/;
          return 0 unless @w && shift(@w) eq "exec";
          while (@w && $w[0] =~ /^-/) { my $o = shift @w; shift @w if $o =~ /^(-[euwcn]|--(env|env-file|user|workdir|container|namespace))$/ }
          shift @w;
          shift @w if @w && $w[0] eq "--";
        }
        elsif ($word eq "agro" && @w > 2 && $w[1] eq "hands" && $w[2] eq "exec") {
          splice @w, 0, 4;
          shift @w if @w && $w[0] eq "--";
        }
        elsif ($word eq "ssh") {
          shift @w;
          while (@w && $w[0] =~ /^-/) { my $o = shift @w; shift @w if $o =~ /^-[bcDEeFIiJLlmOoPpQRSWw]$/ }
          shift @w;
          shift @w if @w && $w[0] eq "--";
          return "shell" unless @w;
        }
        else { last }
      }
      return 0 unless @w;
      my $bin = shift(@w) =~ s{.*/}{}r;
      return 0 unless $bin =~ /^(node|nodejs|python[0-9.]*|perl|ruby|bash|sh|zsh|dash|ksh)$/;
      my $python = $bin =~ /^python/;
      my $takes_value = $python ? qr/^-[WX]$/
        : $bin =~ /^node/ ? qr/^(-r|--require|--import|-C|--conditions|--loader)$/
        : $bin =~ /^(perl|ruby)$/ ? qr/^-[IrM]$/
        : qr/^[-+][oO]$/;
      my (@flags, @ops);
      while (@w) {
        my $x = shift @w;
        if ($x eq "--") { @ops = @w; last }
        if ($x =~ $takes_value) { shift @w; next }
        return 0 if $python && $x =~ /^-[bBdEhiIOPqsSuvx]*m/;
        if ($x =~ /^-./) { push @flags, $x; next }
        @ops = ($x, @w);
        last;
      }
      my $stdin = !@ops || grep { $_ eq "-" } @ops;
      return $stdin ? "script" : 0 if $bin !~ /^(bash|sh|zsh|dash|ksh)$/;
      return 0 if grep { /^-[A-Za-z]*c/ } @flags;
      return "shell" if grep { /^-[A-Za-z]*s/ } @flags;
      return $stdin ? "shell" : 0;
    }
    sub body_hit {
      my ($kind, $text) = @_;
      return 0 unless $kind;
      return $text =~ $read || ($kind eq "shell" && ($text =~ $dump || $text =~ $deny));
    }
    my $c = do { local $/; <STDIN> };
    my $hit = 0;
    while ($c =~ /<<(-)?\s*(["\x27]?)(\w+)\2([^\n]*)(.*?)\n(?(1)\t*)\3(?=\n|$)/gs) {
      my ($tail, $body, $pos) = ($4, $5, $-[0]);
      my $head = substr($c, 0, $pos) =~ s/$redirect/ /gr;
      $head =~ s/.*[;&|(`{\n]//s;
      my $t = $tail =~ s/$redirect/ /gr;
      $t =~ s/(\|\||[;&]).*//s;
      my ($args, @stages) = split /\|/, $t, -1;
      for my $kind (interp_kind("$head $args"), map { interp_kind($_) } @stages) {
        $hit = 1 if body_hit($kind, $body);
      }
    }
    $c =~ s/<<(-)?\s*(["\x27]?)(\w+)\2([^\n]*).*?\n(?(1)\t*)\3(?=\n|$)/<< $4/gs;
    my @pipelines = ([""]);
    for my $t ($c =~ /($redirect|\x27[^\x27]*\x27|"(?:[^"\\]|\\.)*"|\\.|[^\x27"\\|;&\n<>]+|[<>]+|\|\||&&|[|;&\n])/gs) {
      if ($t eq "|") { push @{$pipelines[-1]}, "" }
      elsif ($t =~ /^(\|\||&&|[;&\n])$/) { push @pipelines, [""] }
      else { $pipelines[-1][-1] .= $t }
    }
    for my $p (@pipelines) {
      for my $i (0 .. $#$p) {
        my $s = $p->[$i];
        $hit = 1 if $s =~ /^(.*?)<<<(.*)$/s && body_hit(interp_kind($1), $2);
        next unless $i;
        my $kind = interp_kind($s) or next;
        $hit = 1 if grep { body_hit($kind, $p->[$_]) } 0 .. $i - 1;
      }
    }
    print $hit ? 1 : "";
  ' <<<"$raw_cmd") || STDIN_SCRIPT_ENV_READ=''
fi

DOCKER_INSPECT='\b(docker|podman|nerdctl)[[:space:]]+([^|;&]{0,160}[[:space:]])?inspect\b'
DOCKER_FMT='(--format[=[:space:]]|(^|[[:space:]])-f[=[:space:]])'
DOCKER_FMT_UNSAFE='env'
DOCKER_FMT_UNSAFE+='|\{\{[[:space:]]*(json[[:space:]]*)?\.(Config)?[[:space:]]*\}\}'
DOCKER_FMT_UNSAFE+="|(--format|(^|[[:space:]])-f)[=[:space:]]+[\"']?json[\"']?([[:space:]]|\$)"

OPERATOR_PATH='(^|[^A-Za-z0-9._-])\.config([^A-Za-z0-9_-]|$)'
OPERATOR_PATH+='|(^|[^A-Za-z0-9._-])settings\.local\.json([^A-Za-z0-9._-]|$)'

SECRET_PATH="(\\.env[^[:space:]/\"']*"
SECRET_PATH+='|[^[:space:]]*\.pem\b'
SECRET_PATH+='|[^[:space:]]*\.p12\b'
SECRET_PATH+='|[^[:space:]]*\.cert\b'
SECRET_PATH+='|[^[:space:]/]*id_rsa[^[:space:]]*'
SECRET_PATH+='|[^[:space:]/]*id_ed25519[^[:space:]]*'
SECRET_PATH+='|\.aws/credentials\b'
SECRET_PATH+='|\.aws/config\b'
SECRET_PATH+='|\.gcp/'
SECRET_PATH+='|\.config/gcloud/'
SECRET_PATH+='|\.azure/'
SECRET_PATH+='|\.kube/config\b'
SECRET_PATH+='|\.docker/config\.json\b'
SECRET_PATH+='|\.npmrc\b'
SECRET_PATH+='|\.pypirc\b'
SECRET_PATH+='|\.cargo/credentials'
SECRET_PATH+='|\.git-credentials\b'
SECRET_PATH+='|\.netrc\b'
SECRET_PATH+='|\.config/gh/hosts\.yml\b'
SECRET_PATH+='|\.config/gh/config\.yml\b'
SECRET_PATH+='|\.claude/\.credentials\.json\b'
SECRET_PATH+='|\.anthropic/'
SECRET_PATH+='|\.pi/[^[:space:]]*auth\.json\b'
SECRET_PATH+='|\.gnupg/'
SECRET_PATH+='|\.bash_history\b'
SECRET_PATH+='|\.zsh_history\b'
SECRET_PATH+='|\.psql_history\b'
SECRET_PATH+='|\.python_history\b'
SECRET_PATH+='|\.node_repl_history\b'
SECRET_PATH+='|\.wget-hsts\b)'
READ_WORDS='cat|tac|less|more|bat|head|tail|xxd|od|strings|hexdump|base64|nano|vim|vi|emacs|view|sed|awk|grep|rg|ripgrep|jq|yq|tee|cp|mv|scp|rsync|install|source'
READ_CMD="(${READ_WORDS}|\\.)"
SECRET_PATH_DENY="\\b${READ_CMD}\\b[^#|]*${SECRET_PATH}"

DECODE='\bbase64[[:space:]]+([^|;&]*[[:space:]])?(-[A-Za-z]*[dD]\b|--decode\b)'
DECODE+='|\bxxd[[:space:]]+([^|;&]*[[:space:]])?-[A-Za-z]*r'
DECODE_RUN="(${DECODE})[^;&]*\\|[[:space:]]*((sudo|exec|command)[[:space:]]+)*(/[^[:space:]]*/)?(sh|bash|zsh|dash|ksh)\\b"
DECODE_RUN+="|(\\\$\\(|\`)[^)\`]*(${DECODE})"

decoded_text=''
if command -v perl >/dev/null 2>&1 && grep -qE -- "$DECODE" <<<"$raw_cmd"; then
  decoded_text=$(perl -MMIME::Base64 -ne '
    for my $t (/[A-Za-z0-9+\/_-]{4,}={0,2}/g) { (my $b = $t) =~ tr{-_}{+/}; print decode_base64($b), "\n" }
    s/\b0x(?=[0-9A-Fa-f])//gi;
    s{(?<![0-9A-Za-z])[0-9A-Fa-f]{2}(?:[\s,]+[0-9A-Fa-f]{2}(?![0-9A-Za-z]))+}{(my $r = $&) =~ s/[\s,]//g; $r}ge;
    for my $h (/[0-9A-Fa-f]{4,}/g) { print pack("H*", substr($h, 0, length($h) & ~1)), "\n" }
  ' <<<"$raw_cmd" | tr -c '[:print:]\n' ' ') || decoded_text=''
fi

ASK='\bprintenv[[:space:]]+[A-Za-z_]'

CALL_TAIL='(([[:space:]]+-[^[:space:]]*)*)([[:space:]]+)'
CALL_TAIL+="('[^']*'|\"[^\"\$\`]*\"|[^[:space:];&|<>()\$\`\"']+)(.*)\$"
JQ_CALL="(^|[^A-Za-z0-9_-])jq${CALL_TAIL}"
JQ_PATH_FLAG='(^|[[:space:]])(-[A-Za-z]*[fL]|--[^[:space:]]*file)'
SEARCH_PATTERN_FLAG='(^|[[:space:]])(-[A-Za-z]*[ABCDEMTdefgjmrt]|--[^=[:space:]]*([[:space:]]|$)|--[^[:space:]]*(file|regexp))'

mask_first_operand() {
  local rest=$1 name=$2 path_flag=$3 placeholder=$4 out='' prefix
  local call="(^|[^A-Za-z0-9_-])${name}${CALL_TAIL}"
  local -a m
  while [[ $rest =~ $call ]]; do
    m=("${BASH_REMATCH[@]}")
    prefix=${rest%"${m[0]}"}
    if [[ ${m[2]} =~ $path_flag ]]; then
      out+="${prefix}${m[1]}${name}"
      rest="${m[2]}${m[4]}${m[5]}${m[6]}"
    else
      out+="${prefix}${m[1]}${name}${m[2]}${m[4]}${placeholder}"
      rest=${m[6]}
    fi
  done
  printf '%s' "$out$rest"
}

mask_path_cmd() {
  local masked name
  masked=$(mask_first_operand "$1" jq "$JQ_PATH_FLAG" JQ_FILTER) || return 1
  for name in grep egrep fgrep rg; do
    masked=$(mask_first_operand "$masked" "$name" "$SEARCH_PATTERN_FLAG" SEARCH_PATTERN) || return 1
  done
  printf '%s' "$masked"
}

JQ_ARG_FLAG='(^|[[:space:]])--(arg|argjson|slurpfile|rawfile|indent)([[:space:]]|$)'
JQ_WORD='(^|[^A-Za-z0-9_-])jq([^A-Za-z0-9_-]|$)'
JQ_ENV_READ='\$ENV|(^|[^A-Za-z0-9_.$])env\b'

first_segment() {
  local masked pipe_or_semi and_and
  masked=$(mask_quoted_separators "$1")
  pipe_or_semi=${masked%%[|;]*}
  and_and=${masked%%&&*}
  if ((${#pipe_or_semi} <= ${#and_and})); then
    printf '%s' "$pipe_or_semi"
  else
    printf '%s' "$and_and"
  fi
}

jq_filters() {
  local rest=$1 out='' call_text seg
  local -a m
  while [[ $rest =~ $JQ_CALL ]]; do
    m=("${BASH_REMATCH[@]}")
    if [[ ${m[2]} =~ $JQ_PATH_FLAG || ${m[2]} =~ $JQ_ARG_FLAG || ${m[5]} == -* ]]; then
      call_text="${m[5]}${m[6]}"
      seg=$(first_segment "$call_text")
      out+=" $seg"
      rest=${call_text:${#seg}+1}
    else
      out+=" ${m[5]}"
      rest=${m[6]}
    fi
  done
  while [[ -n $rest ]]; do
    seg=$(first_segment "$rest")
    if [[ $seg =~ $JQ_WORD ]]; then
      out+=" $seg"
    fi
    rest=${rest:${#seg}+1}
  done
  printf '%s' "$out"
}

INTERP_CODE='\b(python[0-9.]*|perl|ruby|node|nodejs)\b[^|;&]*[[:space:]](-[A-Za-z]*[cepE]|--eval|--print)([[:space:]"'\'']|$)'
INTERP_ENV_READ="${INTERP_CODE}"'[^|;&]*(os\.environ|getenv|%ENV|\$ENV\{|\bENV\b|process\.env)'

mask_quoted_separators() {
  local s=$1 out='' quote='' c i
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    if [[ -n $quote ]]; then
      [[ $c == "$quote" ]] && quote=''
      [[ $c == [\;\|\&] ]] && c=' '
    elif [[ $c == "'" || $c == '"' ]]; then
      quote=$c
    fi
    out+=$c
  done
  printf '%s' "$out"
}

path_cmd=$(mask_path_cmd "$cmd") || path_cmd=$cmd
interp_cmd=$(mask_quoted_separators "$cmd") || interp_cmd=$cmd
jq_filter_text=$(jq_filters "$literal_cmd") || jq_filter_text=$literal_cmd

dump_cmd=$literal_cmd
secret_path_cmd=$path_cmd
if command -v perl >/dev/null 2>&1; then
  unquoted_cmd=$(perl -pe 's{(\\.)|("(?:[^"\\]|\\.)*")|(\x27[^\x27]*\x27)}{my ($e, $d) = ($1, $2); defined $e ? $e : !defined $d ? "\x27\x27" : index($d, "\$(") >= 0 || index($d, "`") >= 0 ? $d : "\"\""}ge' <<<"$literal_cmd") || unquoted_cmd=$literal_cmd
  if ! grep -qE -- "$SHELL_RUNNER" <<<"$unquoted_cmd"; then
    dump_cmd=$unquoted_cmd
    secret_path_cmd=$(READ_WORDS=$READ_WORDS perl -pe 's{(\\.)|("(?:[^"\\]|\\.)*"|\x27[^\x27]*\x27)}{my ($e, $q) = ($1, $2); defined $e || index($q, "\$(") >= 0 || index($q, "`") >= 0 ? $e // $q : $q =~ s/\b(?:$ENV{READ_WORDS})\b/QUOTED_WORD/gir}ge' <<<"$path_cmd") || secret_path_cmd=$path_cmd
  fi
fi

emit() {
  jq -n --arg d "$1" --arg r "$2" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: $d,
      permissionDecisionReason: $r
    }
  }'
}

if grep -qEi -- "$DENY" <<<"$literal_cmd" || grep -qEi -- "$ENV_DUMP" <<<"$dump_cmd"; then
  emit deny 'Secret-exposure guard (deny): command matches a high-risk pattern — bulk env dump (env/set/export -p/declare -x/-p/compgen/printenv/proc environ), shell history, echo/printf of a secret-named variable (TOKEN/SECRET/KEY/PASSWORD/AUTH/CREDENTIAL/BEARER/SLACK_*/OPENAI_*/ANTHROPIC_*/GH_TOKEN/AWS_SECRET), Authorization header with variable interpolation, or a token-printing CLI (gh auth token, agro secret get, gcloud auth print-*-token, aws configure get, kubectl get secret -o yaml/json, docker secret/config inspect). These almost always leak credentials into the transcript and prompt cache. Do NOT retry a variant that bypasses this check. Ask the operator to run the command themselves and paste only the specific non-secret output you need.'
elif grep -qE -- "$REMOTE_EXEC" <<<"$dump_cmd" && grep -qE -- "$REMOTE_ENV_READ" <<<"$literal_cmd"; then
  emit deny 'Secret-exposure guard (deny): a container or remote exec (docker/podman/nerdctl/kubectl exec, agro hands exec, ssh, or a shell -c runner) prints a secret-named variable or dumps the environment, which puts the secret in the transcript. Do NOT retry a variant that moves the read to another container, host, shell, script, or encoding. Ask the operator to run the command themselves and paste only the non-secret value you need.'
elif [[ -n $decoded_text ]] && { grep -qEi -- "$OPERATOR_PATH|$SECRET_PATH|$DENY" <<<"$decoded_text" || grep -qE -- "$ENV_DUMP|$REMOTE_ENV_READ" <<<"$decoded_text"; }; then
  emit deny 'Encoded-payload guard (deny): a base64 or hex payload that the command decodes (base64 -d/--decode/-D, xxd -r) names an operator-only or secret-laden path (.config/, settings.local.json, env file, private key, cloud credentials, shell history, or similar), or dumps the environment or prints a secret-named variable or token. Encoding does not change the policy. Do NOT retry a variant that encodes, splits, or relocates the path or command. If you need a value from that file, ask the operator to paste only the non-secret value into the chat. If you only need to name the path in prose, write it in a file passed with --body-file (or git commit -F) or in a heredoc.'
elif grep -qE -- "$REMOTE_EXEC" <<<"$dump_cmd" && grep -qE -- "$DECODE_RUN" <<<"$literal_cmd"; then
  emit deny 'Encoded-exec guard (deny): a container or remote exec (docker/podman/nerdctl/kubectl exec, agro hands exec, ssh, or a shell -c runner) runs a base64 or hex decode (base64 -d, xxd -r) through a shell, which hides the real command from this guard. Do NOT retry a variant that moves the decode to another shell, host, script, or encoding. Run the plain command so the guard can read it. If you need a secret or operator-only value, ask the operator to paste only the non-secret value into the chat. If you only need to name a path in prose, write it in a file passed with --body-file (or git commit -F) or in a heredoc.'
elif grep -qE -- "$INTERP_ENV_READ" <<<"$interp_cmd"; then
  emit deny 'Secret-exposure guard (deny): inline python, perl, ruby, or node code (-c, -e, -p, --eval) reads the process environment (os.environ, getenv, %ENV, $ENV{...}, ENV, process.env), which can print every environment variable, secrets included. Do NOT retry a variant that reaches the environment another way. If you need an environment value, ask the user to paste only that non-secret value.'
elif [[ -n $STDIN_SCRIPT_ENV_READ ]]; then
  emit deny 'Secret-exposure guard (deny): a script fed on stdin (heredoc, pipe, or here-string) to python, perl, ruby, node, or a shell reads the process environment (process.env, os.environ, getenv, %ENV, $ENV{...}, ENV[...]) or a secret-named variable such as $DATABASE_URL, which puts the secret in the transcript. Do NOT retry a variant that moves the read to a script file, another interpreter, a container, or an encoding. Ask the operator to run the command themselves and paste only the non-secret value you need.'
elif grep -qE -- "$JQ_ENV_READ" <<<"$jq_filter_text"; then
  emit deny 'Secret-exposure guard (deny): a jq filter reads the process environment through `env` or `$ENV`, which prints environment variables, secrets included. Do NOT retry a variant that reaches the environment another way. To read an `env` key from JSON input, write `.env`. If you need an environment value, ask the user to paste only that non-secret value.'
elif grep -qEi -- "$DOCKER_INSPECT" <<<"$cmd"; then
  seg=$(grep -oEi -- "${DOCKER_INSPECT}.*" <<<"$cmd" | head -1)
  if ! grep -qEi -- "$DOCKER_FMT" <<<"$seg"; then
    emit deny 'Container-inspect guard (deny): a bare `docker inspect` prints the full container JSON, including `Config.Env` — every environment variable the container was started with, secrets included. Inspect is NOT blocked outright: re-run it with an explicit narrow Go template naming only the field you need, e.g. `docker inspect --format "{{.State.Health.Status}}" <container>`, `--format "{{.NetworkSettings.IPAddress}}"`, or `--format "{{range .Mounts}}{{.Source}} {{end}}"`. Piping the full JSON through jq/grep does not qualify — the guard cannot verify the filter, so use --format. If you genuinely need an env value, ask the operator to paste that one value.'
  elif grep -qEi -- "$DOCKER_FMT_UNSAFE" <<<"$seg"; then
    emit deny 'Container-inspect guard (deny): the inspect template names env or dumps the whole object (`{{.}}`, `{{json .}}`, `{{.Config}}`, `--format json`), which re-exposes `Config.Env`. Narrow the template to the specific non-env field you need. Do not retry a variant that spells the env path differently or reaches it through a wider subtree.'
  fi
elif grep -qEi -- "$OPERATOR_PATH" <<<"$cmd"; then
  emit deny 'Operator-only path guard (deny): command references .config/ or settings.local.json, which hold operator-managed configuration and are off-limits to agents for both read and write. This is a deliberate policy, not a misconfiguration — do not retry a variant that spells the path differently, resolves it through a variable or symlink, or reaches it from a subshell. If you need a value from it, ask the operator to paste only that value into the chat. If you only need to mention the path in prose (commit message, PR body), pass it via a file (`git commit -F msg.txt`, `gh pr create --body-file body.md`) or a HEREDOC, which this guard strips.'
elif grep -qEi -- "$SECRET_PATH_DENY" <<<"$secret_path_cmd"; then
  ALLOWED=0
  mapfile -t env_tokens < <(grep -oEi "[^[:space:]\"']*\\.env[^[:space:]\"']*" <<<"$path_cmd" || true)
  if [ "${#env_tokens[@]}" -gt 0 ]; then
    ALLOWED=1
    for token in "${env_tokens[@]}"; do
      base=$(basename -- "$token")
      if ! { grep -qiE '\.env' <<<"$base" && grep -qiE '(example|sample|template)' <<<"$base"; }; then
        ALLOWED=0
        break
      fi
    done
  fi
  if [ "$ALLOWED" -eq 0 ]; then
    emit deny 'Secret-exposure guard (deny): command reads a secret-laden file path (env file, private key, cert, cloud credentials, shell history, or similar). Mirrors the Read(...) deny list in .claude/settings.json so it still blocks under bypassPermissions. If you need a specific non-secret value from this file, ask the user to paste only that value into the chat.'
  fi
elif grep -qE -- "$ASK" <<<"$cmd"; then
  emit ask 'Secret-exposure guard (ask): command reads or echoes a specific variable / single env value whose contents may include a secret. Requires explicit user approval before running.'
fi
