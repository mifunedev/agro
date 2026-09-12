# Evidence — supervisor-skill (#1057)

Branch `skill/1057-supervisor-skill`. PR #1059.

## D-US-001 through D-US-010 — the canonical /supervisor skill

Worker T1 (opus, isolated worktree). Merged at 577cd49e.

```
wc -l .agro/skills/supervisor/SKILL.md        -> 315
bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md -> exit 0
bash .agro/scripts/link-providers.sh --check  -> exit 0
git diff --check                              -> exit 0
grep -n 'OH_\|\.oh/\|Open Harness' .agro/skills/supervisor/SKILL.md -> no match
ls .claude/skills/supervisor/SKILL.md         -> resolves through the directory symlink
```

Frontmatter: `name: supervisor`, description under 1536 characters with three
do-not-trigger cases, `allowed-tools: Bash, Read, Grep`, no declared argument.

Structure: role boundary, five duties in order, multi-advisor rule, five failure
modes, composition table.

Herdr commands verified against v0.7.4. Run live: `pane current`, `pane get`,
`agent list`, `pane read`, `agent wait`. Verified by `--help` only, because
running them creates real workspace state: `agent start`, `tab create`.

Advisor cap: three. The reason is monitoring cost. One poll cycle costs a
120-line pane read plus three artifact reads per advisor. At four advisors the
supervisor fills its own context before the slowest advisor reaches a clean
seam.

## D-US-013 — the /escalate supervisor destination

Worker T2 (opus, isolated worktree). Merged at 0855852a.

Live delivery into a real pane, run by the task owner:

```
$ herdr pane split w6:p5 --direction down --no-focus   -> w6:p7
$ herdr pane run w6:p7 'cat > /tmp/esc-received.txt'
$ escalate.sh --summary "owner validation" --needs "sign-off" --supervisor w6:p7
{"ok":true,"destinations":{
  "supervisor":{"ok":true,"reason":"delivered to w6:p7","target":"w6:p7"},
  "slack":{"ok":false,"reason":"no PI_SLACK_BOT_TOKEN in the environment or .devcontainer/.env","channel":""}}}
$ head /tmp/esc-received.txt
*Escalation from an unattended session*
owner validation
*Needs a human to:* sign-off
```

No-op path, unresolvable target and no token:

```
$ escalate.sh --summary "probe test" --needs "a decision" --supervisor w9:p99
exit 0
stderr: escalate: no-op — herdr agent send failed for target w9:p99; ... the operator was NOT reached
stdout: {"ok":false,"skipped":true,"destinations":{
  "supervisor":{"ok":false,"reason":"herdr agent send failed for target w9:p99; ...","target":"w9:p99"},
  "slack":{"ok":false,"reason":"no PI_SLACK_BOT_TOKEN ...","channel":""}}}
```

Naming: `AGRO_PROJECT_ROOT` with `OH_PROJECT_ROOT` as the alias.
`$HOME/.agro/escalate` with an existing `$HOME/.oh/escalate` still resolving.
The script sources no sibling. `.agro/compat-inventory.json` gained the
`~/.oh/escalate` entry.

One behavior change, accepted by the owner: the `--key` quiet window now runs
before any delivery. The story requires one key to suppress every destination
together, which holds only when the window gates before the first send. A
suppressed key now exits 75 without a network call or a Herdr call.

Correction to the dispatch brief: the brief said no file outside
`.agro/skills/escalate/` calls `escalate.sh`. The brief was wrong.
`.agro/evals/probes/escalate-contract.sh:10` calls it. The worker found the
caller and reported it. That probe reads `.ok`, `.skipped`, `.reason`,
`.dryRun`, and `.channel`, all of which the change preserves.

```
bash .agro/evals/probes/escalate-contract.sh -> PASS, exit 0
bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md -> exit 0
bash -n .agro/skills/escalate/scripts/escalate.sh -> exit 0
shellcheck -> NOT RUN; shellcheck is absent from this sandbox
```

## D-US-011 — the probe decision

A deterministic oracle exists, and it covers behavior rather than prose.

Rejected oracle class: a grep of `SKILL.md` for the skills it cites. That
measures the text. `[[pattern-evals-prose-literal-pinning]]` records that a
probe pinning multi-word prose breaks on a rewrap rather than on drift.

Accepted oracle: `.agro/evals/probes/escalate-destination-fan-out.sh`. Every
attempted destination reports its own `ok` and `reason`, an unattempted
destination is absent, `.ok` is true only when one destination delivered, a dead
destination stays a no-op at exit 0, and one quiet-window key suppresses every
destination together. The probe needs no network, no Slack token, and no Herdr
server.

`[[pattern-evals-unexercised-oracle]]` requires a failing input before a probe
counts as sensitive. Three injections against a copy, each reverted:

| Injection | Probe result |
|---|---|
| `.ok` forced true when nothing delivered | `REGRESSION: .ok must be false when no destination delivered` |
| supervisor entry never emitted | `REGRESSION: an attempted supervisor destination is absent from destinations` |
| supervisor reason emptied | `REGRESSION: destination supervisor names no reason` |
| restored | `PASS` |

The probe also corrected a wrong assumption in its own first draft: a no-op does
not burn the quiet window. The script writes the marker only after a delivery.
The probe seeds the marker directly instead.

## Suite

```
bash .agro/skills/eval/run.sh -> ran 150 probe(s)
REGRESSIONS: none
PERSISTENT RED (3), delta unchanged, all pre-existing:
  curl-bash-safe-alternatives  ERROR    python3 absent from this sandbox
  oh-config-surfaces           REGRESSION
  skills-vendored              REGRESSION
```

The first suite run raised one regression. The owner fixed it and suppressed
nothing:

```
roles-are-skills: was PASS, now REGRESSION
  .agro/skills/supervisor/SKILL.md:42:| Advisor | One contract, judgment, ...
```

ADR #929 and ADR #989 hold that a role is a behavior, not an identity, a model,
or a terminal. The actor table named `Advisor` as a capitalized identity, and
the description defined the advisor as a session that runs in a pane. The table
now heads `Behavior` and lists lowercase names, and the description states that
the owned session carries the advisor behavior. `roles-are-skills` returns PASS.
