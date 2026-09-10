#!/usr/bin/env bash
# tier: A
# source: issue #988 / ADR #989 (advisor-first worker model and reasoning policy)
# desc: prose check of /delegate's worker model and reasoning policy: operator selections and
#       exclusions bind, unspecified settings are selected per task with a recorded reason, a
#       native capability check precedes dispatch, requested and observed settings stay separate,
#       an unsupported required control blocks instead of substituting, Sonnet is excluded, max is
#       never passed, low-complexity Claude Code work names Opus with effort judged per task by
#       the advisor, no other skill routes workers to Sonnet, and provider preferences stay
#       separate from the portable role. This probe greps instruction text; it does not verify
#       an effective model or effort setting.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.agro/skills/delegate/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  echo "SKIPPED: delegate skill absent: $SKILL" >&2
  exit 2
fi

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either|[Nn]on|[Ee]xclud(e|ed|es))\b'

flat="$(tr -s '[:space:]' ' ' <"$SKILL")"
sentences="$(printf '%s\n' "$flat" | sed 's/[.!?] /&\n/g')"

provider_heading='^### Provider-specific preferences'
provider_block="$(awk -v h="$provider_heading" '$0 ~ h {f=1; next} f && /^## /{exit} f{print}' "$SKILL")"

problems=()
has() { grep -qiF -- "$1" <<<"$flat"; }
has_re() { grep -qiE -- "$1" <<<"$flat"; }

grep -q '^## Worker model and reasoning policy$' "$SKILL" \
  || problems+=("no '## Worker model and reasoning policy' section")

has 'Explicit operator selections and exclusions are binding' \
  || problems+=("operator selections and exclusions are not declared binding")
has 'never dispatch to an excluded model' \
  || problems+=("dispatch to an excluded model is not forbidden")

has 'Select unspecified settings per task' \
  || problems+=("unspecified settings are not selected per task")
has 'Record the selection reason in the dispatch record before dispatch' \
  || problems+=("the selection reason is not recorded before dispatch")

has 'native capability check' \
  || problems+=("no native capability check rule")
has_re 'before the first dispatch, confirm which model and reasoning controls' \
  || problems+=("the capability check does not precede the first dispatch")

has 'Record the requested settings and the observed settings separately' \
  || problems+=("requested and observed settings are not recorded separately")
has_re 'each with (its|their) provenance' \
  || problems+=("observed settings carry no provenance")
has 'An unknown value stays `unknown`' \
  || problems+=("an unknown value does not stay unknown")
has 'never record it as confirmed or zero' \
  || problems+=("unknown values may be recorded as confirmed or zero")

has 'An unsupported required control blocks' \
  || problems+=("an unsupported required control does not block")
has_re 'mark the affected worker and its dependents `BLOCKED`' \
  || problems+=("blocking does not cover the worker and its dependents")
has_re 'never substitute a model, lower a setting, change shared or parent settings, or call a nested inference CLI' \
  || problems+=("a missing control may be worked around by substitution, lowering, parent-setting change, or a nested inference CLI")

close_negation='\b(never|not|no|neither|excludes?|excluded|without)\b.{0,40}'
sonnet_routes="$(sed 's/non-Sonnet//gi' <<<"$sentences" | grep -iE 'sonnet' | grep -viE "${close_negation}\\bsonnet" || true)"
[[ -z "$sonnet_routes" ]] \
  || problems+=("Sonnet appears outside a negation (a routing target, not an exclusion): $sonnet_routes")
has_re 'never route work to sonnet' \
  || problems+=("the Sonnet exclusion is not stated as 'never route work to Sonnet'")

has_re 'never pass `max`' \
  || problems+=("passing max is not forbidden")
max_passes="$(grep -iE 'thinking:? *`?max`?|`max`' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$max_passes" ]] \
  || problems+=("max thinking appears outside a negation: $max_passes")

model_subst="$(sed 's/non-Sonnet//gi' <<<"$sentences" \
  | grep -iE '(substitut(e|es|ed|ing)|swap(s|ped)?|fall(s|ing)? back to|switch(es|ed)? to|route(s|d)?|reroute(s|d)?)[^.]{0,50}(sonnet|opus|haiku|fable|luna|astra|another model|a different model|other model)' \
  | grep -vE "$negation" || true)"
[[ -z "$model_subst" ]] \
  || problems+=("a model is substituted or rerouted outside a negation: $model_subst")

required_level_subst="$(grep -iE 'required' <<<"$sentences" \
  | grep -iE 'nearest (supported )?(thinking |reasoning |effort )?level|fall(s|ing)? back to (the )?(nearest|next|lower|`?low`?|`?minimal`?|`?medium`?)|(round|map|lower)(s|ed)? (it |them )?(up |down )?to (the )?(nearest|`?low`?|`?minimal`?)' \
  | grep -viE "${close_negation}\\b(fall|falls|falling|nearest|round|rounds|rounded|map|maps|mapped|lower|lowers|lowered)\\b" || true)"
[[ -z "$required_level_subst" ]] \
  || problems+=("a required reasoning control is silently substituted with a nearby level: $required_level_subst")

thinking_off="$(grep -iE 'thinking[- ](disabled|off)|(disable|without) thinking' <<<"$sentences" || true)"
[[ -z "$thinking_off" ]] \
  || problems+=("obsolete thinking-disabled wording remains: $thinking_off")

inherit_lowers="$(grep -iE '(inherit|lower|reduce|downgrade)[^.]{0,40}(instead of|rather than|when)[^.]{0,30}(block|blocked|blocking)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$inherit_lowers" ]] \
  || problems+=("a missing control is inherited or lowered instead of blocked: $inherit_lowers")

[[ -n "${provider_block//[[:space:]]/}" ]] \
  || problems+=("no '### Provider-specific preferences' subsection")
provider_flat="$(tr -s '[:space:]' ' ' <<<"$provider_block")"
grep -qiF 'operator preferences' <<<"$provider_flat" \
  || problems+=("provider preferences are not named operator preferences")
grep -qiF 'native verification' <<<"$provider_flat" \
  || problems+=("provider preferences do not require native verification")
grep -qiF 'not the portable role definition' <<<"$provider_flat" \
  || problems+=("provider preferences are not separated from the portable role definition")
grep -qiE 'low-complexity worker[^.]{0,40}opus|opus[^.]{0,40}low-complexity' <<<"$provider_flat" \
  || problems+=("provider preferences do not name Opus for low-complexity work")
grep -qiE 'effort[^.]{0,80}(per task|each task|each worker task|advisor judges|selected per task)|(per task|each task|each worker task|advisor judges|selected per task)[^.]{0,80}effort' <<<"$provider_flat" \
  || problems+=("provider preferences do not make effort an advisor judgment per task")
grep -qiE 'subagent definition[^.]{0,80}`effort:|`effort:[^.]{0,80}subagent definition' <<<"$provider_flat" \
  || problems+=("provider preferences do not name subagent definition frontmatter effort as the native control")
grep -qiE 'inherited session (effort|level)[^.]{0,60}(record|says so|unobserved)' <<<"$provider_flat" \
  || problems+=("provider preferences do not disclose an inherited session effort when no per-worker control exists")

skills_root="$ROOT/.agro/skills"
route_ctx='(spawn|route|dispatch|run on|runs on|[^a-z]use|model:).{0,60}sonnet|sonnet.{0,60}(spawn|route|dispatch|run on|runs on|[^a-z]use|model:)|\(sonnet\)|parallel sonnet|\| *sonnet *\|'
sonnet_routing="$(find "$skills_root" -type f -name '*.md' \
    ! -path "$skills_root/delegate/SKILL.md" ! -path "$skills_root/claude-api/*" -print0 \
  | sort -z | xargs -0 grep -inE -- "$route_ctx" 2>/dev/null \
  | sed 's/non-sonnet//gi' | grep -viE "${close_negation}\\bsonnet" \
  | sed "s|^$skills_root/|.agro/skills/|" || true)"
[[ -z "$sonnet_routing" ]] \
  || problems+=("a skill routes workers to Sonnet outside /delegate policy: $sonnet_routing")

if grep -Eiq 'DeepSWE|leaderboard' "$SKILL"; then
  problems+=("volatile external benchmark language appears in durable delegate policy")
fi

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: /delegate worker model/reasoning policy contract is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /delegate binds operator selections, checks native capability before dispatch, keeps requested/observed evidence separate, blocks unsupported required controls, names Opus with advisor-judged effort, excludes Sonnet across skills, and never passes max (prose check only)" >&2
exit 0
