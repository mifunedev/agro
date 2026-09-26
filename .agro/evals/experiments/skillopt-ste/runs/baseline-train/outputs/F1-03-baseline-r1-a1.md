# Descriptive `.agro/harness.yml` example

This page shows the smallest useful shape for a human-readable
`.agro/harness.yml` file. A project can use this shape if the project wants a
local manifest. The example is **descriptive, not normative**. AGRO does not
require this file. AGRO does not validate this shape. AGRO does not treat this
shape as a registry-backed schema or as a conformance target.

Today, AGRO has two runtime configuration surfaces:

- The tracked [`agro.json`](../agro.json) at the repository root holds every
  non-secret setting.
- The gitignored root `.env` holds only secrets. The tracked
  [`.example.env`](../.example.env) documents the `.env` file.

[`docker-compose.sh`](../.agro/scripts/docker-compose.sh) reads both files.
[Configuration](configuration.md) holds the field reference. The example below
is only a pointer map. The map points at the existing `.agro/` control-plane
surfaces that the [`.agro/` directory layout](agro-directory-layout.md)
describes.

## Minimal example

```yaml
# .agro/harness.yml — example only; not required or read by AGRO.
name: agro
version: 1

primitives:
  skills: .agro/skills/
  hooks: .agro/hooks/

loops:
  schedules: crons/
  task_artifacts: .agro/tasks/

policies:
  operator_instructions: AGENTS.md
  git_workflow: .agro/skills/git/SKILL.md
  security_hooks: .agro/hooks/                       # secret-exposure guards
  destructive_command_guard: cc-safety-net@1.0.6   # global binary (Dockerfile) + provider config entries
```

## How to read the example

- `name` and `version` are plain labels for humans. These two keys do not imply
  a manifest version registry.
- `primitives` points at the real provider-portable primitive pack. Skills and
  hooks already live under `.agro/`. The example has no agent-definitions
  entry, for two reasons. First, skills are the reusable-role primitive. Second,
  a provider-native sub-agent is a bounded execution choice that `/delegate`
  makes, not a repository artifact.
- `loops` points at the current scheduled cron prompts and at the task artifact
  directory.
- `policies` points at existing policy surfaces. The example does not invent a
  `.agro/policies/` directory. The three policy surfaces are the root
  instructions file, the git workflow skill, and the hook-enforced guardrails.
  The guardrails are two complementary layers:
  - the secret-exposure hooks under `.agro/hooks/`;
  - the destructive-command guard, cc-safety-net@1.0.6. This guard is a global
    binary from the image plus guard-wrapped entries in the provider configs.
    This guard is not an `.agro/` file.

  [security-considerations.md](security-considerations.md) describes both
  layers.

Every path in the example exists today. The one exception is the illustrative
`.agro/harness.yml` file itself. [ADR-0001](rfcs/adr-0001-standards-scope.md)
defers these additions: formal schemas, registries, lifecycle states, and the
`OH-Core` / `OH-Dev` conformance profiles.
