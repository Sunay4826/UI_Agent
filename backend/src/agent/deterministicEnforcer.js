const TYPE_PRIORITY = {
  remove: 0,
  update: 1,
  add: 2
};

const TARGET_PRIORITY = {
  navbar: 0,
  sidebar: 1,
  "content:first": 2,
  content: 3,
  "content:last": 4
};

function normalizePrimitive(value) {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }
  return value;
}

function deepSortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepSortValue(item));
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const out = {};
    for (const key of keys) {
      out[key] = deepSortValue(value[key]);
    }
    return out;
  }

  return normalizePrimitive(value);
}

function cleanOperation(op) {
  const normalized = {
    id: typeof op?.id === "string" ? op.id : null,
    type: op?.type === "remove" || op?.type === "update" || op?.type === "add" ? op.type : "update",
    target: typeof op?.target === "string" ? op.target : "content:last",
    component: typeof op?.component === "string" ? op.component : null,
    props: deepSortValue(op?.props && typeof op.props === "object" ? op.props : {}),
    position:
      op?.position === "prepend" || op?.position === "replace" || op?.position === "append"
        ? op.position
        : "append"
  };

  // Remove non-deterministic payload keys by returning only canonical shape.
  return normalized;
}

function operationSortKey(op) {
  const typePriority = TYPE_PRIORITY[op.type] ?? 9;
  const targetPriority = TARGET_PRIORITY[op.target] ?? 9;
  const component = op.component || "";
  const id = op.id || "";
  const position = op.position || "append";

  return [typePriority, targetPriority, component, id, position, JSON.stringify(op.props || {})].join("|");
}

function stableSortOperations(operations) {
  const tagged = operations.map((op, idx) => ({ op, idx, key: operationSortKey(op) }));
  tagged.sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return a.idx - b.idx;
  });
  return tagged.map((item) => item.op);
}

function normalizeLegacyPlan(plan) {
  const ops = Array.isArray(plan?.operations) ? plan.operations : [];
  const normalizedOps = stableSortOperations(ops.map(cleanOperation));

  return {
    ...deepSortValue(
      Object.fromEntries(
        Object.entries(plan || {}).filter(([key]) => !["operations", "random", "seed", "timestamp"].includes(key))
      )
    ),
    operations: normalizedOps
  };
}

function normalizeModifyPlanShape(plan) {
  const normalizeItems = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: typeof item?.id === "string" ? item.id : null,
        target: typeof item?.target === "string" ? item.target : "",
        component: typeof item?.component === "string" ? item.component : null,
        props: deepSortValue(item?.props && typeof item.props === "object" ? item.props : {}),
        position:
          item?.position === "prepend" || item?.position === "replace" || item?.position === "append"
            ? item.position
            : "append"
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return {
    action: "modify",
    updates: normalizeItems(plan?.updates),
    additions: normalizeItems(plan?.additions),
    removals: normalizeItems(plan?.removals),
    layout_changes: normalizeItems(plan?.layout_changes),
    reasoning: typeof plan?.reasoning === "string" ? plan.reasoning.trim() : "",
    title: typeof plan?.title === "string" ? plan.title.trim() : "Incremental UI update",
    notes: Array.isArray(plan?.notes)
      ? [...new Set(plan.notes.map((item) => String(item).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
      : [],
    operations: stableSortOperations((Array.isArray(plan?.operations) ? plan.operations : []).map(cleanOperation))
  };
}

export function enforceDeterministicPlan(plannerOutput) {
  const base = plannerOutput && typeof plannerOutput === "object" ? plannerOutput : {};

  if (base.action === "modify") {
    return normalizeModifyPlanShape(base);
  }

  return normalizeLegacyPlan(base);
}
