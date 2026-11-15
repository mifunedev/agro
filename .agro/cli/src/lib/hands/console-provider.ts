import {
  asRecord,
  asText,
  callApi,
  createConsoleNode,
  findOrRegisterSshKey,
  toNode,
  toNodeList,
  waitForRunning,
  type ConsoleConfig,
  type ConsoleNode,
  type ConsolePollDeps,
} from "../console-api.js";
import type { Hand, HandOutcome, HandProvider, HandStatusReport } from "./provider.js";

const NO_NODE_ID = "the console response has no node id";
const DISPOSABLE_PROFILE_UNSUPPORTED_LINE =
  "only a sandbox node can be disposable: drop --disposable, or use --profile sandbox";
const DESTROY_ADMIN_LINE = "destroy needs the admin role in agro-console";

export interface LocalSshKey {
  path: string;
  read: () => string | undefined;
  name: string;
}

export function normalizeHandRef(ref: string): string {
  return ref.startsWith("#") ? ref.slice(1) : ref;
}

function handPath(ref: string): string {
  return `/api/nodes/${encodeURIComponent(normalizeHandRef(ref))}`;
}

function refusalMessage(
  result: { status?: number; code?: string; message: string },
  ref: string,
  verb: "pause" | "resume" | "fork",
): string {
  return result.status === 409 && result.code === "NODE_DISPOSABLE"
    ? `hand ${ref} is disposable and cannot ${verb}: delete it with agro hands destroy ${ref}`
    : result.message;
}

function toHand(node: ConsoleNode): Hand {
  return {
    id: node.id,
    label: `#${node.orgIndex}`,
    index: node.orgIndex,
    alias: node.alias,
    name: node.name,
    profile: node.profile,
    status: node.status,
    spec: node.spec,
    sshHost: node.sshHost,
    sshDest: node.sshHost === null ? null : `sandbox@${node.sshHost}`,
    hostKeyAlias: node.id,
    remoteName: node.orgIndex === null ? null : `hand-${node.orgIndex}`,
  };
}

export function createConsoleProvider(
  deps: ConsolePollDeps,
  config: ConsoleConfig,
  notice: (message: string) => void,
  localKey?: LocalSshKey,
): HandProvider {
  async function defaultSshKeyIds(): Promise<HandOutcome<string[]>> {
    if (localKey === undefined) return { ok: true, value: [] };
    const publicKey = localKey.read()?.trim();
    if (publicKey === undefined || publicKey === "") {
      notice(`${localKey.path} not found; the hand gets no SSH key`);
      return { ok: true, value: [] };
    }
    const found = await findOrRegisterSshKey(deps, config, publicKey, localKey.name);
    return found.ok ? { ok: true, value: [found.id] } : found;
  }

  async function readNode(ref: string): Promise<HandOutcome<ConsoleNode>> {
    const read = await callApi(deps, config, "GET", handPath(ref));
    if (!read.ok) return { ok: false, error: read.message };
    const node = toNode(read.body);
    return node === undefined ? { ok: false, error: NO_NODE_ID } : { ok: true, value: node };
  }

  async function awaitRunning(
    initial: ConsoleNode,
    requestedAt: number,
    onStatus: HandStatusReport,
    fork?: { job: string | null },
  ): Promise<HandOutcome<Hand>> {
    const report = (next: ConsoleNode) => onStatus(toHand(next));
    report(initial);
    const waited = await waitForRunning(deps, config, initial, requestedAt, report, { pendingOn404: fork !== undefined });
    if (waited.ok) return { ok: true, value: toHand(waited.node) };
    const last = waited.node;
    if (waited.reason === "request") return { ok: false, error: `hand ${last.id}: ${waited.message}` };
    if (waited.reason === "timeout" && !waited.appeared) {
      const job = fork?.job ?? null;
      return { ok: false, error: `fork ${last.id} never appeared after 15 minutes${job === null ? "" : ` (job ${job})`}` };
    }
    if (waited.reason === "timeout") {
      return { ok: false, error: `hand ${last.id} is not running after 15 minutes — last status ${last.status}` };
    }
    return { ok: false, error: `hand ${last.id} failed — last status ${last.status}` };
  }

  async function act(ref: string, verb: "pause" | "resume"): Promise<HandOutcome<void>> {
    const result = await callApi(deps, config, "POST", `${handPath(ref)}/${verb}`);
    return result.ok ? { ok: true, value: undefined } : { ok: false, error: refusalMessage(result, ref, verb) };
  }

  return {
    remoteCommand: (command) => command,

    async list() {
      const listed = await callApi(deps, config, "GET", "/api/nodes");
      if (!listed.ok) return { ok: false, error: listed.message };
      return { ok: true, value: toNodeList(listed.body).map(toHand) };
    },

    async resolve(ref) {
      const read = await readNode(ref);
      return read.ok ? { ok: true, value: toHand(read.value) } : read;
    },

    async create(request, onStatus) {
      const { name, spec, disposable, profile, docker, t3, codeServer } = request;
      const keys = request.sshKeyIds ?? [];
      const resolvedKeys = keys.length > 0 ? { ok: true as const, value: keys } : await defaultSshKeyIds();
      if (!resolvedKeys.ok) return resolvedKeys;
      const sshKeyIds = resolvedKeys.value;
      const requestedAt = deps.now();
      const created = await createConsoleNode(
        deps,
        config,
        {
          profile: profile ?? "sandbox",
          ...(name === undefined ? {} : { name }),
          ...(spec === undefined ? {} : { spec }),
          ...(sshKeyIds.length === 0 ? {} : { sshKeyIds }),
          ...(docker === true ? { docker: true } : {}),
          ...(t3 === true ? { t3: true } : {}),
          ...(codeServer === true ? { runtimeSettings: { codeServerEnabled: true } } : {}),
          ...(disposable === true ? { disposable: true } : {}),
        },
        notice,
      );
      if (!created.ok) {
        const disposableRefused = created.status === 422 && created.code === "DISPOSABLE_PROFILE_UNSUPPORTED";
        return { ok: false, error: disposableRefused ? DISPOSABLE_PROFILE_UNSUPPORTED_LINE : created.message };
      }
      const node = toNode(created.body);
      if (node === undefined) return { ok: false, error: NO_NODE_ID };
      return awaitRunning(node, requestedAt, onStatus);
    },

    async fork(ref, { name, spec: requested }, onStatus) {
      let spec = requested;
      if (spec === undefined) {
        const read = await callApi(deps, config, "GET", handPath(ref));
        if (!read.ok) return { ok: false, error: read.message };
        spec = toNode(read.body)?.spec ?? undefined;
        if (spec === undefined) return { ok: false, error: `hand ${ref} has no spec; pass --spec <spec>` };
      }
      const requestedAt = deps.now();
      const forked = await callApi(deps, config, "POST", `${handPath(ref)}/fork`, {
        spec,
        ...(name === undefined ? {} : { name }),
      });
      if (!forked.ok) return { ok: false, error: refusalMessage(forked, ref, "fork") };
      const body = asRecord(forked.body);
      const forkId = asText(body?.forkId);
      const job = asText(body?.jobId);
      if (forkId === null) return { ok: true, value: { job } };
      const fork = toNode({ id: forkId, status: "queued" });
      if (fork === undefined) return { ok: false, error: NO_NODE_ID };
      const running = await awaitRunning(fork, requestedAt, onStatus, { job });
      return running.ok ? { ok: true, value: { hand: running.value, job } } : running;
    },

    pause: (ref) => act(ref, "pause"),
    resume: (ref) => act(ref, "resume"),
    async destroy(ref) {
      const result = await callApi(deps, config, "DELETE", handPath(ref));
      if (result.ok) return { ok: true, value: undefined };
      const adminRefused = result.status === 403 && !result.code?.startsWith("BRAIN_TOKEN_");
      return { ok: false, error: adminRefused ? DESTROY_ADMIN_LINE : result.message };
    },
  };
}
