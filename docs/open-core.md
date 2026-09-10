---
title: "Open-core boundary"
---

# Open-core boundary

AGRO (Open Harness) ships under [Apache-2.0](../LICENSE). Its shared `.agro/` control plane is part of the open runtime. Mifune's hosted provisioning and fleet-management platform is separate and proprietary.

## The split

| Apache-2.0 | Proprietary |
|---|---|
| The runtime and shared `.agro/` control plane | The Mifune Console |
| The `agro` CLI, legacy `oh` entry point, and public SDKs | Hosted provisioning and fleet management |
| Container definitions and public deployment integrations | Billing, enterprise policy, RBAC, hosted operations |
| The harness spec and interop formats | — |

Customer harness repos stay customer-owned. Open core without crippling the
open core: the moat is the managed platform, not restrictions on modifying
the runtime.

## Why Apache-2.0 rather than MIT

The recommended adoption path is sandbox-first: install the CLI, create a sandbox, and work inside it. No fork or host-side harness checkout is required. Operators can also modify, fork, and use the runtime commercially.

Compared with MIT's copyright grant, Apache-2.0 adds three explicit terms:

- an **explicit patent license** from every contributor for claims their
  contribution infringes,
- **patent-retaliation termination** if a recipient sues over the project,
- an **explicit withholding of trademark rights** ([§6](../LICENSE)) — a
  fork may run and sell the software but may not present itself as *Mifune*.

These terms still matter when an operator distributes a modified runtime. The sandbox-first setup path does not change the license rights or trademark restrictions.

## Why not the alternatives

- **AGPL / SSPL / BSL** — enterprise review friction, and they contradict
  the "developer-owned, open by default" positioning this project takes.
- **Apache-2.0 + a commercial dual license** — Apache-2.0 already permits
  commercial use, so a paid alternative license grants nothing a licensee
  doesn't already have.

## Prior releases

Prior MIT releases remain usable under MIT. This change governs new code
and future releases; it does not revoke past grants.

## Related

- [`LICENSE`](../LICENSE) · [`NOTICE`](../NOTICE)
- [Security considerations](security-considerations.md)
