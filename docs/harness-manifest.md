# Descriptive `.agro/harness.yml` example

This page shows the smallest useful shape a human-readable `.agro/harness.yml`
file could take if a project wants a local manifest. It is **descriptive, not
normative**: AGRO does not require this file, does not validate this
shape, and does not treat it as a registry-backed schema or conformance target.

The real runtime configuration surfaces today are the tracked
[`agro.json`](../agro.json) at the repository root, which holds every non-secret
setting, and the gitignored root `.env`, which holds only secrets and is
documented by the tracked [`.example.env`](../.example.env). Both are read by
[`docker-compose.sh`](../.agro/scripts/docker-compose.sh); the field reference is
[Configuration](configuration.md). The example below is only a pointer map over the existing `.agro/`
control-plane surfaces described in the [`.agro/` directory layout](oh-directory-layout.md).

## Minimal example

```yaml
# .agro/harness.yml — example only; not required or read by AGRO.
name: openharness
version: 1

primitives:
  hooks: .agro/hooks/

loops:
  schedules: crons/

policies:
  operator_instructions: AGENTS.md
  security_hooks: .agro/hooks/                     # secret-exposure guards
  destructive_command_guard: cc-safety-net@1.0.6   # global binary (Dockerfile) + provider config entries
```

## How to read the example

- `name` and `version` are plain labels for humans. They do not imply a manifest
  version registry.
- `primitives` points at the real provider-portable primitive pack: the hooks
  under `.agro/`. There is no agent-definitions entry.
- `loops` points at today's scheduled cron prompts.
- `policies` points at existing policy surfaces instead of inventing a
  `.agro/policies/` directory: the root instructions file and the hook-enforced
  guardrails. The guardrails are two complementary layers: the
  secret-exposure hooks under `.agro/hooks/`, and the destructive-command guard
  (cc-safety-net@1.0.6 — a global binary from the image plus guard-wrapped
  entries in the provider configs, not an `.agro/` file). Both are described in
  [security-considerations.md](security-considerations.md).

Every path in the example exists today except the illustrative
`.agro/harness.yml` file itself. Adding formal schemas, registries, lifecycle
states, or `OH-Core` / `OH-Dev` conformance profiles remains deferred by
[ADR-0001](rfcs/adr-0001-standards-scope.md).
