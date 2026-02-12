import { DEFAULT_TREE } from "../constants/componentRegistry.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextNodeId(tree, prefix) {
  const ids = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.id) ids.add(node.id);
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  };
  walk(tree);

  let idx = 1;
  while (ids.has(`${prefix}_${idx}`)) idx += 1;
  return `${prefix}_${idx}`;
}

function findNodeById(tree, nodeId) {
  let found = null;
  const walk = (node, parent, index) => {
    if (!node || found) return;
    if (node.id === nodeId) {
      found = { node, parent, index };
      return;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, childIdx) => walk(child, node, childIdx));
    }
  };
  walk(tree, null, -1);
  return found;
}

function inferComponent(intent) {
  const text = intent.toLowerCase();
  if (text.includes("modal")) return "Modal";
  if (text.includes("table")) return "Table";
  if (text.includes("input") || text.includes("form")) return "Input";
  if (text.includes("chart") || text.includes("graph")) return "Chart";
  if (text.includes("sidebar")) return "Sidebar";
  if (text.includes("navbar") || text.includes("header")) return "Navbar";
  if (text.includes("button") || text.includes("cta")) return "Button";
  return "Card";
}

function inferComponentList(intent, { allowFallback } = { allowFallback: true }) {
  const text = intent.toLowerCase();
  const picks = [];
  const push = (name) => {
    if (!picks.includes(name)) picks.push(name);
  };

  if (text.includes("modal")) push("Modal");
  if (text.includes("table")) push("Table");
  if (text.includes("input") || text.includes("form")) push("Input");
  if (text.includes("chart") || text.includes("graph")) push("Chart");
  if (text.includes("sidebar")) push("Sidebar");
  if (text.includes("navbar") || text.includes("header")) push("Navbar");
  if (text.includes("button") || text.includes("cta")) push("Button");

  if (picks.length === 0 && allowFallback) {
    push("Card");
  }

  return picks;
}

function defaultPropsFor(component, intent) {
  const label = intent.slice(0, 80);
  switch (component) {
    case "Button":
      return { label: "Save Changes", variant: "primary" };
    case "Card":
      return {
        title: "New Section",
        body: label,
        footer: "Generated from latest instruction"
      };
    case "Input":
      return { label: "Search", placeholder: "Type here...", value: "" };
    case "Table":
      return {
        columns: ["Name", "Status", "Owner"],
        rows: [
          ["Alpha", "Active", "Ops"],
          ["Beta", "Paused", "Finance"]
        ]
      };
    case "Modal":
      return {
        title: "Settings",
        body: "Adjust key preferences for this workspace.",
        open: true,
        confirmLabel: "Apply"
      };
    case "Sidebar":
      return { title: "Quick Links", items: ["Overview", "Usage", "Settings"] };
    case "Navbar":
      return { title: "Workspace", links: ["Home", "Reports", "Settings"] };
    case "Chart":
      return {
        title: "Usage",
        points: [12, 18, 11, 24, 16, 28],
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      };
    default:
      return {};
  }
}

export function buildHeuristicPlan({ intent, mode }) {
  const explicitComponents = inferComponentList(intent, { allowFallback: false });
  const components =
    mode === "generate"
      ? inferComponentList(intent, { allowFallback: true })
      : explicitComponents;
  const normalizedMode = mode === "generate" ? "generate" : "modify";
  const text = intent.toLowerCase();
  const wantsMinimal = text.includes("minimal") || text.includes("simple") || text.includes("clean");
  const wantsRemove = text.includes("remove") || text.includes("delete");
  const operations = [];

  if (wantsRemove) {
    operations.push({
      type: "remove",
      target: "content:last",
      component: null,
      props: {},
      position: "append"
    });
  }

  if (wantsMinimal) {
    operations.push({
      type: "update",
      target: "content:last",
      component: "Card",
      props: {
        title: "Overview",
        body: "Minimal layout with focused content blocks.",
        footer: "Reduced visual noise"
      },
      position: "replace"
    });
  }

  for (const component of components) {
    operations.push({
      type: "add",
      target: "content",
      component,
      props: defaultPropsFor(component, intent),
      position: "append"
    });
  }

  if (operations.length === 0) {
    operations.push({
      type: "update",
      target: "content:last",
      component: "Card",
      props: defaultPropsFor("Card", intent),
      position: "replace"
    });
  }

  return {
    action: normalizedMode === "generate" ? "generate" : "modify",
    updates: operations.filter((op) => op.type === "update"),
    additions: operations.filter((op) => op.type === "add"),
    removals: operations.filter((op) => op.type === "remove"),
    layout_changes: [],
    reasoning: "Heuristic fallback used deterministic minimal changes.",
    title: normalizedMode === "generate" ? "Initial UI generation" : "Incremental UI update",
    operations,
    notes: [
      "Used deterministic component whitelist.",
      normalizedMode === "generate"
        ? "Started from the fixed baseline layout."
        : "Applied an incremental operation to the latest version."
    ]
  };
}

function getContentNode(tree) {
  const main = tree.children?.[1];
  return main?.children?.[1] || null;
}

export function applyPlanToTree({ previousTree, plan, mode, intent }) {
  const base = mode === "generate" || !previousTree ? clone(DEFAULT_TREE) : clone(previousTree);
  const content = getContentNode(base);
  if (!content) return base;

  for (const op of plan.operations) {
    const target = typeof op.target === "string" ? op.target : "content";
    const idTarget = target.startsWith("id:") ? target.slice(3) : "";

    if (target === "navbar" && base.children?.[0]) {
      base.children[0] = {
        ...(base.children[0] || {}),
        type: "Navbar",
        props: {
          ...(base.children[0].props || {}),
          ...(op.props || {})
        }
      };
      continue;
    }

    if (target === "sidebar" && base.children?.[1]?.children?.[0]) {
      base.children[1].children[0] = {
        ...(base.children[1].children[0] || {}),
        type: "Sidebar",
        props: {
          ...(base.children[1].children[0].props || {}),
          ...(op.props || {})
        }
      };
      continue;
    }

    if (op.type === "remove") {
      if (idTarget) {
        const located = findNodeById(base, idTarget);
        if (located?.parent?.children && located.index >= 0) {
          located.parent.children.splice(located.index, 1);
          continue;
        }
      }

      if (content.children && content.children.length > 0) {
        content.children.pop();
      }
      continue;
    }

    const componentNode = {
      id: op.id || nextNodeId(base, (op.component || inferComponent(intent)).toLowerCase()),
      type: op.component || inferComponent(intent),
      props: op.props || defaultPropsFor(op.component || inferComponent(intent), intent)
    };

    if (op.type === "add") {
      if (idTarget) {
        const located = findNodeById(base, idTarget);
        if (located?.node) {
          located.node.children = located.node.children || [];
          if (op.position === "prepend") {
            located.node.children.unshift(componentNode);
          } else {
            located.node.children.push(componentNode);
          }
          continue;
        }
      }

      content.children = content.children || [];
      if (op.position === "prepend") {
        content.children.unshift(componentNode);
      } else {
        content.children.push(componentNode);
      }
      continue;
    }

    if (op.type === "update") {
      if (idTarget) {
        const located = findNodeById(base, idTarget);
        if (located?.node) {
          located.node.type = componentNode.type;
          located.node.props = {
            ...(located.node.props || {}),
            ...(componentNode.props || {})
          };
          continue;
        }
      }

      content.children = content.children || [];
      if (content.children.length === 0) {
        content.children.push(componentNode);
      } else {
        const idx = target === "content:first" ? 0 : content.children.length - 1;
        content.children[idx] = {
          ...content.children[idx],
          type: componentNode.type,
          props: {
            ...(content.children[idx].props || {}),
            ...(componentNode.props || {})
          }
        };
      }
    }
  }

  return base;
}
