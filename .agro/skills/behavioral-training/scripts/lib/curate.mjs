import { createHash } from "node:crypto";

import { createRandom } from "./run-store.mjs";

export const SPLITS = Object.freeze(["regression", "demonstrations", "holdout"]);
export const REVIEW_STATUSES = Object.freeze(["pending", "approved", "rejected"]);
export const CONTENT_FIELDS = Object.freeze(["input", "expectedBehavior", "acceptanceOracle", "correction", "fixture"]);
export const ITEM_FIELDS = Object.freeze([
  "itemId",
  "split",
  "groupId",
  "source",
  "sourceLinks",
  "input",
  "expectedBehavior",
  "acceptanceOracle",
  "correction",
  "reviewStatus",
  "holdoutEligible",
  "fixture",
  "replayable",
  "provenance",
  "datasetVersion",
  "contentHash",
]);
export const ITEM_ID_PREFIX = "bt-item-";
export const DEFAULT_HOLDOUT_SHARE = 0.2;
export const ROUNDING =
  "holdout groups = groupCount × holdoutShare rounded to the nearest integer, a tie rounds down; " +
  "frozen holdout groups count toward the target; development receives every other group";

export class CurationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`, { cause: code });
    this.name = "CurationError";
    this.code = code;
  }
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const sortedUnique = (values) => [...new Set((Array.isArray(values) ? values : []).map(String))].sort(byText);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(byText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function contentHash(item) {
  const content = Object.fromEntries(CONTENT_FIELDS.map((field) => [field, item[field] ?? null]));
  return `sha256:${sha256(canonical(content))}`;
}

export function deriveItemId({ projectId, source, rubricVersion, datasetVersion }) {
  const key = [
    projectId,
    source.sessionId,
    sortedUnique(source.traceIds),
    sortedUnique(source.observationIds),
    rubricVersion,
    datasetVersion,
  ];
  return `${ITEM_ID_PREFIX}${sha256(canonical(key)).slice(0, 32)}`;
}

export function holdoutTarget(groupCount, holdoutShare = DEFAULT_HOLDOUT_SHARE) {
  const exact = Math.round(groupCount * holdoutShare * 1e9) / 1e9;
  return Math.max(0, Math.ceil(exact - 0.5));
}

export function assertDisjoint(items) {
  for (const [label, keyOf] of [["sessionId", (item) => item.source.sessionId], ["groupId", (item) => item.groupId]]) {
    const seen = new Map();
    for (const item of items) {
      const key = keyOf(item);
      const split = seen.get(key);
      if (split !== undefined && split !== item.split) {
        throw new CurationError("leakage", `${label} ${key} appears in ${split} and ${item.split}`);
      }
      seen.set(key, item.split);
    }
  }
}

function unionFind() {
  const parent = new Map();
  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key);
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(key) !== root) {
      const next = parent.get(key);
      parent.set(key, root);
      key = next;
    }
    return root;
  };
  const union = (a, b) => {
    const [ra, rb] = [find(a), find(b)].sort(byText);
    if (ra !== rb) parent.set(rb, ra);
  };
  return { parent, find, union };
}

export function groupSessions({ sessionIds, normalizedSessions = [], sessionLinks = [], frozenLinks = [] }) {
  const { parent, find, union } = unionFind();
  const tasks = new Map();
  for (const record of normalizedSessions) {
    if (typeof record?.sessionId !== "string") continue;
    if (!tasks.has(record.sessionId)) tasks.set(record.sessionId, new Set());
    find(`s:${record.sessionId}`);
    if (typeof record.taskGroupId === "string" && record.taskGroupId !== "") {
      tasks.get(record.sessionId).add(record.taskGroupId);
      union(`s:${record.sessionId}`, `t:${record.taskGroupId}`);
    }
  }
  for (const id of sessionIds) find(`s:${id}`);
  for (const [a, b] of sessionLinks) union(`s:${a}`, `s:${b}`);
  for (const [id, groupId] of frozenLinks) {
    union(`s:${id}`, `f:${groupId}`);
    if (groupId.startsWith("task:")) union(`t:${groupId.slice(5)}`, `f:${groupId}`);
    if (groupId.startsWith("session:")) union(`s:${groupId.slice(8)}`, `f:${groupId}`);
  }

  const members = new Map();
  for (const key of [...parent.keys()].sort(byText)) {
    const root = find(key);
    if (!members.has(root)) members.set(root, { s: [], t: [], f: [] });
    members.get(root)[key[0]].push(key.slice(2));
  }
  const wanted = new Set(sessionIds);
  const groups = [];
  const groupOf = new Map();
  for (const { s, t, f } of members.values()) {
    const sessions = s.filter((id) => wanted.has(id));
    if (sessions.length === 0) continue;
    const groupId = f.length > 0 ? f[0] : t.length > 0 ? `task:${t[0]}` : `session:${s[0]}`;
    const group = { groupId, sessionIds: sessions, taskGroupIds: t, frozenGroupIds: f };
    groups.push(group);
    for (const id of sessions) groupOf.set(id, group);
  }
  groups.sort((a, b) => byText(a.groupId, b.groupId));

  const uncertain = [];
  for (const id of [...wanted].sort(byText)) {
    const taskGroupIds = [...(tasks.get(id) ?? [])].sort(byText);
    const reason = !tasks.has(id)
      ? "missing-normalized-session"
      : taskGroupIds.length === 0
        ? "unknown-task-group"
        : taskGroupIds.length > 1
          ? "conflicting-task-groups"
          : null;
    if (reason) uncertain.push({ sessionId: id, groupId: groupOf.get(id).groupId, reason, taskGroupIds });
  }
  return { groups, groupOf, uncertain };
}

function permute(items, random) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function assignSplits(groups, { holdoutShare = DEFAULT_HOLDOUT_SHARE, seed }) {
  const target = holdoutTarget(groups.length, holdoutShare);
  const frozenHoldout = groups.filter((g) => g.frozenSplit === "holdout").length;
  const eligible = groups
    .filter((g) => g.frozenSplit === null && g.holdoutEligible)
    .sort((a, b) => byText(a.groupId, b.groupId));
  const chosen = new Set(
    permute(eligible, createRandom(seed)).slice(0, Math.max(0, target - frozenHoldout)).map((g) => g.groupId),
  );
  const splitOf = new Map();
  for (const g of groups) {
    const split = g.frozenSplit ?? (chosen.has(g.groupId) ? "holdout" : g.demonstrations ? "demonstrations" : "regression");
    splitOf.set(g.groupId, split);
  }
  const holdoutGroups = frozenHoldout + chosen.size;
  return {
    splitOf,
    split: {
      groupCount: groups.length,
      frozenGroups: groups.filter((g) => g.frozenSplit !== null).length,
      holdoutShare,
      exactHoldout: Number((groups.length * holdoutShare).toFixed(6)),
      holdoutTarget: target,
      eligibleGroups: eligible.length,
      holdoutGroups,
      developmentGroups: groups.length - holdoutGroups,
      shortfall: Math.max(0, target - holdoutGroups),
      rounding: ROUNDING,
    },
  };
}

function outcome(candidate, annotationsById) {
  const ids = Array.isArray(candidate.provenance?.annotationIds) ? candidate.provenance.annotationIds : [];
  const found = ids.map((id) => annotationsById.get(id));
  if (found.some((a) => a?.verdict === "fail")) return "fail";
  if (found.length === 0 || found.some((a) => a === undefined)) return "unknown";
  return found.some((a) => a.verdict === "pass" && a.reviewStatus === "approved") ? "pass" : "unknown";
}

function prepare(candidate, index, { projectId, rubricVersion, datasetVersion }) {
  const sessionId = candidate?.source?.sessionId;
  if (typeof sessionId !== "string" || sessionId === "") {
    throw new CurationError("invalid-candidate", `candidate ${index} lacks source.sessionId`);
  }
  if (!REVIEW_STATUSES.includes(candidate.reviewStatus)) {
    throw new CurationError("invalid-candidate", `candidate ${index} has reviewStatus outside ${REVIEW_STATUSES.join(", ")}`);
  }
  return {
    candidate,
    sessionId,
    itemId: deriveItemId({ projectId, source: candidate.source, rubricVersion, datasetVersion }),
    contentHash: contentHash(candidate),
  };
}

function indexFrozen(frozen) {
  assertDisjoint(frozen);
  const splitOfGroup = new Map();
  const bySession = new Map();
  const byHash = new Map();
  for (const item of frozen) {
    if (!SPLITS.includes(item.split) || typeof item.groupId !== "string" || typeof item.contentHash !== "string") {
      throw new CurationError("invalid-frozen", `frozen item ${item.itemId ?? "?"} lacks split, groupId, or contentHash`);
    }
    splitOfGroup.set(item.groupId, item.split);
    bySession.set(item.source.sessionId, item.groupId);
    byHash.set(item.contentHash, item);
  }
  return { splitOfGroup, bySession, byHash };
}

function exposureOf(exposure, sample) {
  if (exposure !== undefined && exposure !== null) return { source: "explicit", ids: new Set(exposure) };
  if (Array.isArray(sample?.sessions)) return { source: "sample", ids: new Set(sample.sessions.map((s) => s.sessionId)) };
  return { source: "none", ids: new Set() };
}

function outputItem(entry, { split, groupId, datasetVersion }) {
  const c = entry.candidate;
  const s = c.source;
  return {
    itemId: entry.itemId,
    split,
    groupId,
    source: {
      projectId: s.projectId ?? null,
      sessionId: s.sessionId,
      traceIds: s.traceIds ?? null,
      observationIds: s.observationIds ?? null,
    },
    sourceLinks: c.sourceLinks ?? null,
    input: c.input ?? null,
    expectedBehavior: c.expectedBehavior ?? null,
    acceptanceOracle: c.acceptanceOracle ?? null,
    correction: c.correction ?? null,
    reviewStatus: c.reviewStatus,
    holdoutEligible: entry.holdoutEligible,
    fixture: c.fixture ?? null,
    replayable: c.replayable ?? null,
    provenance: c.provenance ?? null,
    datasetVersion,
    contentHash: entry.contentHash,
  };
}

export function curateDatasetItems({
  candidates,
  normalizedSessions = [],
  annotations = [],
  sample = null,
  exposure,
  projectId,
  rubricVersion,
  datasetVersion,
  seed,
  holdoutShare = DEFAULT_HOLDOUT_SHARE,
  frozen = [],
}) {
  for (const [name, value] of [["projectId", projectId], ["rubricVersion", rubricVersion], ["datasetVersion", datasetVersion]]) {
    if (typeof value !== "string" || value === "") throw new CurationError("invalid-options", `${name} is required`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new CurationError("invalid-options", "seed must be a 32-bit integer");
  if (!(holdoutShare >= 0 && holdoutShare <= 1)) throw new CurationError("invalid-options", "holdoutShare must be in [0, 1]");

  const versions = { projectId, rubricVersion, datasetVersion };
  const exposed = exposureOf(exposure, sample);
  const annotationsById = new Map(annotations.map((a) => [a.annotationId, a]));
  const prior = indexFrozen(frozen);

  const prepared = candidates.map((c, i) => prepare(c, i, versions)).sort((a, b) => byText(a.itemId, b.itemId));
  for (let i = 1; i < prepared.length; i += 1) {
    const [a, b] = [prepared[i - 1], prepared[i]];
    if (a.itemId === b.itemId && a.contentHash !== b.contentHash) {
      throw new CurationError("item-id-collision", `two candidates with different content share ${a.itemId}; add observationIds to the source`);
    }
  }

  const rejected = prepared.filter((p) => p.candidate.reviewStatus === "rejected");
  const active = prepared.filter((p) => p.candidate.reviewStatus !== "rejected");

  const byHash = new Map();
  for (const p of active) {
    if (!byHash.has(p.contentHash)) byHash.set(p.contentHash, []);
    byHash.get(p.contentHash).push(p);
  }
  const kept = [];
  const duplicates = [];
  const sessionLinks = [];
  for (const [hash, list] of byHash) {
    const frozenId = prior.byHash.get(hash)?.itemId;
    const rank = (p) => [p.itemId === frozenId ? 0 : 1, p.candidate.reviewStatus === "approved" ? 0 : 1];
    list.sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      return ra[0] - rb[0] || ra[1] - rb[1] || byText(a.itemId, b.itemId);
    });
    const [keeper, ...removed] = list;
    keeper.holdoutEligible = list.every((p) => p.candidate.holdoutEligible !== false && !exposed.ids.has(p.sessionId));
    kept.push(keeper);
    for (const p of removed) {
      duplicates.push({ itemId: p.itemId, sessionId: p.sessionId, keptItemId: keeper.itemId, contentHash: hash });
      sessionLinks.push([keeper.sessionId, p.sessionId]);
    }
  }

  const frozenLinks = frozen.map((item) => [item.source.sessionId, item.groupId]);
  for (const p of kept) {
    if (prior.byHash.has(p.contentHash)) frozenLinks.push([p.sessionId, prior.byHash.get(p.contentHash).groupId]);
  }
  const sessionIds = [...new Set(active.map((p) => p.sessionId))];
  const { groups, groupOf, uncertain } = groupSessions({ sessionIds, normalizedSessions, sessionLinks, frozenLinks });
  const uncertainSessions = new Set(uncertain.map((u) => u.sessionId));

  for (const p of kept) {
    p.qualified =
      p.candidate.reviewStatus === "approved" &&
      ((p.candidate.correction ?? null) !== null || outcome(p.candidate, annotationsById) === "pass");
  }
  const itemsOf = new Map();
  for (const p of kept) {
    const groupId = groupOf.get(p.sessionId).groupId;
    if (!itemsOf.has(groupId)) itemsOf.set(groupId, []);
    itemsOf.get(groupId).push(p);
  }
  const plans = groups.filter((g) => itemsOf.has(g.groupId)).map((g) => {
    const items = itemsOf.get(g.groupId);
    const frozenSplits = [...new Set(g.frozenGroupIds.map((id) => prior.splitOfGroup.get(id)))].sort(byText);
    if (frozenSplits.length > 1) {
      throw new CurationError("frozen-split-conflict", `group ${g.groupId} joins frozen groups in ${frozenSplits.join(" and ")}`);
    }
    const exposedGroup = items.some((p) => !p.holdoutEligible);
    return {
      groupId: g.groupId,
      frozenSplit: frozenSplits[0] ?? null,
      exposed: exposedGroup,
      holdoutEligible: !exposedGroup && !g.sessionIds.some((id) => uncertainSessions.has(id)),
      demonstrations: items.every((p) => p.qualified),
    };
  });
  const { splitOf, split } = assignSplits(plans, { holdoutShare, seed });

  const items = [];
  const excluded = [];
  for (const p of kept) {
    const s = splitOf.get(groupOf.get(p.sessionId).groupId);
    const reason =
      s === "holdout" && !p.holdoutEligible
        ? "holdout-ineligible"
        : s === "holdout" && uncertainSessions.has(p.sessionId)
          ? "uncertain-grouping"
          : s === "demonstrations" && !p.qualified
            ? "demonstration-unqualified"
            : null;
    if (reason) {
      excluded.push({ itemId: p.itemId, sessionId: p.sessionId, reason });
      continue;
    }
    const groupId = prior.byHash.get(p.contentHash)?.groupId ?? prior.bySession.get(p.sessionId) ?? groupOf.get(p.sessionId).groupId;
    items.push(outputItem(p, { split: s, groupId, datasetVersion }));
  }
  items.sort((a, b) => SPLITS.indexOf(a.split) - SPLITS.indexOf(b.split) || byText(a.groupId, b.groupId) || byText(a.itemId, b.itemId));
  assertDisjoint(items);

  const keptFrozen = items.filter((item) => prior.byHash.has(item.contentHash)).length;
  const report = {
    projectId,
    rubricVersion,
    datasetVersion,
    seed,
    counts: {
      candidates: candidates.length,
      rejected: rejected.length,
      duplicates: duplicates.length,
      excluded: excluded.length,
      items: items.length,
      groups: plans.length,
      ...Object.fromEntries(SPLITS.map((name) => [name, items.filter((item) => item.split === name).length])),
    },
    split,
    frozen: { items: frozen.length, kept: keptFrozen, newItems: items.length - keptFrozen },
    exposure: {
      source: exposed.source,
      sessions: sessionIds.filter((id) => exposed.ids.has(id)).length,
      items: kept.filter((p) => !p.holdoutEligible).length,
      groups: plans.filter((plan) => plan.exposed).length,
    },
    uncertainGroupings: uncertain,
    duplicates: duplicates.sort((a, b) => byText(a.itemId, b.itemId)),
    rejected: rejected.map((p) => ({ itemId: p.itemId, sessionId: p.sessionId })),
    excluded: excluded.sort((a, b) => byText(a.itemId, b.itemId)),
  };
  return { items, report };
}
