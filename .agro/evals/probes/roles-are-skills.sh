#!/usr/bin/env bash
# tier: A
# source: ADR #929 — roles are behavior, skills encode behavior, agents execute behavior;
#         extended by issue #988 / ADR #989 (the advisor is a behavior, not a model or terminal)
# desc: prose check: active core docs and tooling encode durable roles as skills; no role is
#       defined as a required project-agent identity, no active surface cites a project-agent
#       file, and no skill or root instruction defines the advisor as a fixed model, identity,
#       or terminal outside a provider-preference subsection
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

fail() { echo "REGRESSION: $*" >&2; exit 1; }

for skill in architect spec audit retro delegate builder; do
  [ -f ".agro/skills/$skill/SKILL.md" ] || fail "role-owning skill missing: .agro/skills/$skill/SKILL.md"
done

for role in architect advisor auditor implementer critic pm council first-mate prime; do
  for dir in .agro/agents .claude/agents .codex/agents .pi/agents; do
    [ ! -e "$dir/$role.md" ] || fail "role reintroduced as a project agent: $dir/$role.md"
  done
done

agent_file_refs="$(grep -rnE '\.(oh|claude|codex|pi)/agents/[A-Za-z0-9_-]+\.md' \
  .agro/skills docs AGENTS.md README.md .agro/README.md 2>/dev/null \
  | grep -v '^docs/rfcs/preserved-changelog-rationale\.md:' || true)"
if [ -n "$agent_file_refs" ]; then
  echo "REGRESSION: active surfaces still cite project-agent definition files:" >&2
  printf '%s\n' "$agent_file_refs" >&2
  exit 1
fi

retired_role_uses="$(grep -rnE '\b(Advisor|First Mate)\b' .agro/skills 2>/dev/null \
  | grep -vE '\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b' || true)"
if [ -n "$retired_role_uses" ]; then
  echo "REGRESSION: active skills still invoke a retired role identity (a retired role may only appear in a negation):" >&2
  printf '%s\n' "$retired_role_uses" >&2
  exit 1
fi

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b'
fixed_advisor=""
while IFS= read -r file; do
  hits="$(awk '/^#+ .*[Pp]reference/{skip=1; next} skip && /^## /{skip=0} !skip{print}' "$file" \
    | tr -s '[:space:]' ' ' | sed 's/[.!?] /&\n/g' \
    | grep -iE 'advisor[^.|]{0,80}\b(is|are|runs on|runs in|lives in|uses|requires|must use|means|=)\b[^.|]{0,60}\b(Fable|Opus|Sonnet|Haiku|Luna|Astra|GPT|tmux|Herdr|pane|tab|persistent identity|named agent)\b' \
    | grep -vE "$negation" || true)"
  [ -z "$hits" ] || fixed_advisor+="$file: $hits"$'\n'
done < <(find .agro/skills -name '*.md' -type f | sort; echo AGENTS.md)
if [ -n "$fixed_advisor" ]; then
  echo "REGRESSION: the advisor is defined as a fixed model, identity, or terminal outside an operator-preference subsection:" >&2
  printf '%s' "$fixed_advisor" >&2
  exit 1
fi

grep -qF 'canonical primitive for a reusable role' docs/glossary.md \
  || fail "docs/glossary.md does not name skills as the canonical reusable-role primitive"
grep -qF 'the **runtime and the owner of the' docs/glossary.md \
  || fail "docs/glossary.md does not name the active coding agent as the runtime/owner"
grep -qF -e '- **worker / subagent**' docs/glossary.md \
  || fail "docs/glossary.md does not define worker/subagent as a bounded execution context"
grep -qF -e '- **rule**' docs/glossary.md || fail "docs/glossary.md does not define rule"
grep -qF -e '- **rfc / adr**' docs/glossary.md || fail "docs/glossary.md does not define rfc/adr"

echo "PASS: durable roles are skills; no active surface defines or cites a project-agent identity or a fixed advisor model (prose check only)" >&2
