export type RuntimeTier = "container" | "microvm";

export type RuntimeState = "active" | "planned";

export interface RuntimeEntry {
  readonly id: string;
  readonly title: string;
  readonly tier: RuntimeTier;
  readonly state: RuntimeState;
  readonly provisionable: boolean;
  readonly notProvisionableReason?: (bin: string) => string;
  readonly docsPath: string;
}

const CATALOG = [
  {
    id: "docker",
    title: "Docker container",
    tier: "container",
    state: "active",
    provisionable: true,
    docsPath: "docs/runtimes/docker.md",
  },
  {
    id: "microsandbox",
    title: "MicroSandbox",
    tier: "microvm",
    state: "planned",
    provisionable: false,
    notProvisionableReason: (bin: string): string =>
      `microsandbox is not a provisionable runtime yet; see docs/rfcs/rfc-runtime-support.md. Inside a sandbox run \`${bin} tool install microsandbox\`.`,
    docsPath: "docs/runtimes/microsandbox.md",
  },
  {
    id: "openshell",
    title: "NVIDIA OpenShell",
    tier: "container",
    state: "active",
    provisionable: true,
    docsPath: "docs/runtimes/openshell.md",
  },
] as const satisfies readonly RuntimeEntry[];

type ProvisionableEntry = Extract<(typeof CATALOG)[number], { provisionable: true }>;

export type ProvisionableRuntimeId = ProvisionableEntry["id"];

export const RUNTIME_CATALOG: readonly RuntimeEntry[] = Object.freeze(
  CATALOG.map((entry): RuntimeEntry => Object.freeze({ ...entry })),
);

export const PROVISIONABLE_RUNTIMES: readonly ProvisionableRuntimeId[] = Object.freeze(
  CATALOG.filter((entry): entry is ProvisionableEntry => entry.provisionable).map((entry) => entry.id),
);

export function findRuntime(id: string): RuntimeEntry | undefined {
  return RUNTIME_CATALOG.find((r) => r.id === id);
}

export function runtimeIds(): string[] {
  return RUNTIME_CATALOG.map((r) => r.id);
}
