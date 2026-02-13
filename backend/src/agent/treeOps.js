import { DEFAULT_TREE } from "../constants/componentRegistry.js";
import { componentRegistry, layoutComponents } from "../core/componentRegistry.js";
import { propSchemas } from "../core/propSchemas.js";

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
  switch (component) {
    case "Button":
      return { label: "Save Changes", variant: "primary" };
    case "Card":
      return {
        title: "New Section",
        body: "N/A",
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

function isAllowedVariant(value) {
  return value === "primary" || value === "secondary";
}

function toStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number") return String(item);
      if (item && typeof item === "object") {
        return String(item.label ?? item.name ?? item.title ?? item.key ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function toNumberArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  const out = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
  return out.length > 0 ? out : fallback;
}

function toRows(value, columns, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return [];

  const normalizedColumns = toStringArray(columns, []);

  if (Array.isArray(value[0])) {
    return value.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
  }

  if (typeof value[0] === "object" && value[0] !== null) {
    const cols =
      normalizedColumns.length > 0
        ? normalizedColumns
        : Object.keys(value[0]).map((key) => String(key ?? "").trim()).filter(Boolean);

    const normalizedRows = value.map((row) => {
      const source = row && typeof row === "object" ? row : {};
      return cols.map((col) => {
        if (col in source) return String(source[col] ?? "");

        const hitKey = Object.keys(source).find((key) => String(key).toLowerCase() === col.toLowerCase());
        if (hitKey) return String(source[hitKey] ?? "");

        return "";
      });
    });
    return normalizedRows;
  }

  return fallback;
}

function sanitizeComponentProps(component, rawProps, intent, existingProps = null) {
  const incoming = rawProps && typeof rawProps === "object" ? { ...rawProps } : {};
  const defaults = defaultPropsFor(component, intent);
  const base = existingProps && typeof existingProps === "object" ? { ...existingProps } : {};
  const out = { ...defaults, ...base };

  if (component === "Button") {
    if (!incoming.variant && incoming.primary === true) incoming.variant = "primary";
    if (!incoming.variant && incoming.secondary === true) incoming.variant = "secondary";
    if (!isAllowedVariant(incoming.variant)) incoming.variant = out.variant || "primary";
    if (typeof incoming.label === "string" && incoming.label.trim()) out.label = incoming.label.trim();
    out.variant = incoming.variant || out.variant || "primary";
  }

  if (component === "Card") {
    if (typeof incoming.title === "string" && incoming.title.trim()) out.title = incoming.title.trim();
    if (typeof incoming.body === "string" && incoming.body.trim()) out.body = incoming.body.trim();
    if (typeof incoming.footer === "string") out.footer = incoming.footer;
  }

  if (component === "Input") {
    if (typeof incoming.label === "string" && incoming.label.trim()) out.label = incoming.label.trim();
    if (typeof incoming.placeholder === "string" && incoming.placeholder.trim()) out.placeholder = incoming.placeholder.trim();
    if (typeof incoming.value === "string") out.value = incoming.value;
  }

  if (component === "Navbar") {
    if (typeof incoming.title === "string" && incoming.title.trim()) out.title = incoming.title.trim();
    const links = toStringArray(incoming.links || incoming.items || incoming.navItems, out.links || []);
    out.links = links.length > 0 ? links : out.links || ["Home", "Reports", "Settings"];
  }

  if (component === "Sidebar") {
    if (typeof incoming.title === "string" && incoming.title.trim()) out.title = incoming.title.trim();
    const items = toStringArray(incoming.items || incoming.links, out.items || []);
    out.items = items.length > 0 ? items : out.items || ["Overview", "Usage", "Settings"];
  }

  if (component === "Chart") {
    if (typeof incoming.title === "string" && incoming.title.trim()) out.title = incoming.title.trim();
    let points = toNumberArray(incoming.points, []);
    let labels = toStringArray(incoming.labels, []);

    if ((points.length === 0 || labels.length === 0) && Array.isArray(incoming.data)) {
      const rows = incoming.data;
      if (rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null) {
        labels = rows.map((row) => String(row.label ?? row.name ?? "").trim()).filter(Boolean);
        points = rows
          .map((row) => (typeof row.value === "number" ? row.value : Number(row.value)))
          .filter((n) => Number.isFinite(n));
      }
    }

    if (points.length === 0) points = toNumberArray(out.points, [12, 18, 11, 24, 16, 28]);
    if (labels.length === 0) labels = toStringArray(out.labels, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    if (points.length !== labels.length) {
      const len = Math.min(points.length, labels.length);
      points = points.slice(0, len);
      labels = labels.slice(0, len);
    }

    out.points = points;
    out.labels = labels;
  }

  if (component === "Table") {
    const columns = toStringArray(incoming.columns, toStringArray(out.columns, []));
    let rows = toRows(incoming.rows, columns, []);
    if (rows.length === 0 && Array.isArray(incoming.data)) {
      rows = toRows(incoming.data, columns, []);
    }

    out.columns = columns.length > 0 ? columns : toStringArray(out.columns, ["Name", "Status", "Owner"]);
    out.rows = rows.length > 0 ? rows : toRows(out.rows, out.columns, buildRowsForColumns(out.columns));
  }

  if (component === "Modal") {
    if (typeof incoming.title === "string" && incoming.title.trim()) out.title = incoming.title.trim();
    if (typeof incoming.body === "string" && incoming.body.trim()) out.body = incoming.body.trim();
    if (typeof incoming.open === "boolean") out.open = incoming.open;
    if (typeof incoming.confirmLabel === "string" && incoming.confirmLabel.trim()) out.confirmLabel = incoming.confirmLabel.trim();
  }

  const schema = propSchemas[component];
  if (!schema) return out;
  const allowed = new Set([...(schema.required || []), ...(schema.optional || [])]);
  const filtered = {};
  for (const key of allowed) {
    if (key in out) filtered[key] = out[key];
  }
  return filtered;
}

function isProjectDashboardIntent(intent) {
  const text = intent.toLowerCase();
  if (!text.includes("dashboard")) return false;

  return (
    text.includes("project") ||
    text.includes("task") ||
    text.includes("kpi") ||
    text.includes("card") ||
    text.includes("table") ||
    text.includes("chart") ||
    text.includes("sidebar") ||
    text.includes("navbar") ||
    text.includes("deal") ||
    text.includes("revenue") ||
    text.includes("pipeline")
  );
}

function extractQuoted(text, regex, fallback) {
  const match = text.match(regex);
  return match?.[1]?.trim() || fallback;
}

function parseKpiNames(intent, { withDefaults = true } = {}) {
  const blockMatch = intent.match(/kpi cards?\s*\(([^)]+)\)/i);
  const titlesMatch =
    intent.match(/kpi(?:\s+cards?)?\s+titles?\s+to\s*:?\s*([^.\n]+)/i) ||
    intent.match(/change\s+kpi(?:\s+card)?\s+titles?\s+to\s*:?\s*([^.\n]+)/i);

  const source = blockMatch?.[1] || titlesMatch?.[1] || "";
  if (!source) {
    return withDefaults ? ["Total Projects", "Active Tasks", "Completed Tasks"] : [];
  }

  return source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parseTableColumns(intent, { withDefaults = true } = {}) {
  const columnsMatch = intent.match(/columns?\s*:\s*([^.\n]+)/i);
  if (!columnsMatch) {
    return withDefaults ? ["Task Name", "Owner", "Status", "Due Date"] : [];
  }
  const cleanedSegment = columnsMatch[1]
    .replace(/\band\s+a\s+primary\b.*$/i, "")
    .replace(/\band\s+primary\b.*$/i, "")
    .replace(/\band\s+button\b.*$/i, "")
    .trim();

  const cols = cleanedSegment
    .split(",")
    .map((item) => item.trim())
    .map((item) => item.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
  return cols.length > 0 ? cols : withDefaults ? ["Task Name", "Owner", "Status", "Due Date"] : [];
}

function parseSidebarItems(intent) {
  const match =
    intent.match(/sidebar items?\s+to\s*:?\s*([^.\n]+)/i) ||
    intent.match(/update\s+sidebar items?\s+to\s*:?\s*([^.\n]+)/i);
  if (!match) return [];
  const truncated = match[1].split(/,\s*(?:and\s+)?(?:change|rename|set|keep|do\s+not)\b/i)[0];
  return truncated
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNavbarTitle(intent) {
  const titled = extractQuoted(intent, /navbar(?:\s+\w+){0,5}\s+titled\s+"([^"]+)"/i, "");
  if (titled) return titled;

  const titleTo = extractQuoted(intent, /navbar(?:\s+\w+){0,8}\s+title\s+to\s+"([^"]+)"/i, "");
  if (titleTo) return titleTo;

  return extractQuoted(intent, /change\s+navbar(?:\s+\w+){0,8}\s+to\s+"([^"]+)"/i, "");
}

function parsePrimaryButtonLabel(intent) {
  const byLabeled = extractQuoted(intent, /button(?:\s+\w+){0,8}\s+labeled\s+"([^"]+)"/i, "");
  if (byLabeled) return byLabeled;
  const byLabel = extractQuoted(intent, /button(?:\s+\w+){0,8}\s+label\s+"([^"]+)"/i, "");
  if (byLabel) return byLabel;
  const byRenameTo = extractQuoted(intent, /(?:rename|change|set)\s+(?:the\s+)?(?:primary\s+)?button(?:\s+\w+){0,4}\s+to\s+"([^"]+)"/i, "");
  if (byRenameTo) return byRenameTo;
  return extractQuoted(intent, /(?:rename|change|set)\s+(?:the\s+)?(?:primary\s+)?button(?:\s+\w+){0,4}\s+to\s+([^.,\n]+)/i, "");
}

function buildRowsForColumns(columns) {
  const fallbackRows = [
    ["User Onboarding", "Ava", "In Progress", "2026-02-18"],
    ["Billing Migration", "Noah", "Review", "2026-02-21"],
    ["Release Notes", "Mia", "Completed", "2026-02-10"]
  ];
  return fallbackRows.map((row) => row.slice(0, columns.length));
}

function buildProjectDashboardOperations(intent) {
  const text = intent.toLowerCase();
  const isSales = text.includes("sales") || text.includes("deal") || text.includes("revenue") || text.includes("pipeline");
  const isHealthcare =
    text.includes("healthcare") ||
    text.includes("care") ||
    text.includes("patient") ||
    text.includes("ward") ||
    text.includes("admission") ||
    text.includes("labs") ||
    text.includes("discharge");

  let domain = "project";
  if (isSales) domain = "sales";
  if (isHealthcare) domain = "healthcare";

  const domainConfig = {
    sales: {
      navbarTitle: "Sales Hub",
      primaryAction: "Add Deal",
      sidebarItems: ["Overview", "Deals", "Forecast", "Team", "Settings"],
      navLinks: ["Dashboard", "Deals", "Reports", "Profile"],
      chartTitle: "Pipeline Progress",
      kpis: ["Total Revenue", "Open Deals", "Closed Deals"],
      columns: ["Deal Name", "Owner", "Stage", "Close Date"]
    },
    healthcare: {
      navbarTitle: "CareOps",
      primaryAction: "Admit Patient",
      sidebarItems: ["Triage", "Admissions", "Labs", "Staff", "Settings"],
      navLinks: ["Dashboard", "Patients", "Labs", "Profile"],
      chartTitle: "Ward Load",
      kpis: ["Patients Today", "Pending Labs", "Discharges"],
      columns: ["Patient", "Ward", "Priority", "ETA"]
    },
    project: {
      navbarTitle: "Project Management",
      primaryAction: "Create Task",
      sidebarItems: ["Overview", "Projects", "Tasks", "Team", "Settings"],
      navLinks: ["Dashboard", "Tasks", "Reports", "Profile"],
      chartTitle: "Task Progress",
      kpis: ["Total Projects", "Active Tasks", "Completed Tasks"],
      columns: ["Task Name", "Owner", "Status", "Due Date"]
    }
  };

  const selected = domainConfig[domain];

  const navbarTitle = parseNavbarTitle(intent) || selected.navbarTitle;
  const primaryAction = parsePrimaryButtonLabel(intent) || selected.primaryAction;
  const kpiNames = parseKpiNames(intent, { withDefaults: false });
  const tableColumns = parseTableColumns(intent, { withDefaults: false });
  const sidebarItems = selected.sidebarItems;
  const navLinks = selected.navLinks;
  const chartTitle = selected.chartTitle;
  const defaultKpis = selected.kpis;
  const defaultColumns = selected.columns;

  return [
    {
      type: "update",
      target: "navbar",
      component: "Navbar",
      props: {
        title: navbarTitle,
        links: navLinks
      },
      position: "replace"
    },
    {
      type: "update",
      target: "sidebar",
      component: "Sidebar",
      props: {
        title: "Navigation",
        items: sidebarItems
      },
      position: "replace"
    },
    {
      type: "remove",
      target: "content:last",
      component: null,
      props: {},
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Card",
      props: {
        title: kpiNames[0] || defaultKpis[0],
        body: "24",
        footer: "Portfolio count"
      },
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Card",
      props: {
        title: kpiNames[1] || defaultKpis[1],
        body: "68",
        footer: "Currently in progress"
      },
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Card",
      props: {
        title: kpiNames[2] || defaultKpis[2],
        body: "142",
        footer: "Delivered this month"
      },
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Chart",
      props: {
        title: chartTitle,
        labels: ["Backlog", "In Progress", "Review", "Done"],
        points: [18, 42, 20, 65]
      },
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Table",
      props: {
        columns: tableColumns.length > 0 ? tableColumns : defaultColumns,
        rows: buildRowsForColumns(tableColumns.length > 0 ? tableColumns : defaultColumns)
      },
      position: "append"
    },
    {
      type: "add",
      target: "content",
      component: "Button",
      props: {
        label: primaryAction,
        variant: "primary"
      },
      position: "append"
    }
  ];
}

function hasNegatedAction(text, actionWords) {
  const words = actionWords.join("|");
  const pattern = new RegExp(`\\b(?:do\\s+not|don't|dont|without)\\s+(?:\\w+\\s+){0,2}(?:${words})\\b`, "i");
  return pattern.test(text);
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
  const wantsRemove =
    (text.includes("remove") || text.includes("delete")) && !hasNegatedAction(text, ["remove", "delete"]);
  const wantsAdd =
    /\b(add|include|insert|create)\b/i.test(intent) &&
    !hasNegatedAction(text, ["add", "include", "insert", "create"]);
  const operations = [];

  if (mode === "generate" && isProjectDashboardIntent(intent)) {
    const dashboardOps = buildProjectDashboardOperations(intent);
    return {
      action: "generate",
      updates: dashboardOps.filter((op) => op.type === "update"),
      additions: dashboardOps.filter((op) => op.type === "add"),
      removals: dashboardOps.filter((op) => op.type === "remove"),
      layout_changes: [],
      reasoning: "Heuristic planner matched project dashboard template.",
      title: "Project dashboard generation",
      operations: dashboardOps,
      notes: [
        "Applied deterministic dashboard layout template.",
        "Kept one navbar and one sidebar, and composed content section only."
      ]
    };
  }

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

  if (normalizedMode === "modify") {
    const sidebarItems = parseSidebarItems(intent);
    const navbarTitle = parseNavbarTitle(intent);
    const primaryButtonLabel = parsePrimaryButtonLabel(intent);
    const kpiNames = parseKpiNames(intent, { withDefaults: false });

    if (sidebarItems.length > 0) {
      operations.push({
        type: "update",
        target: "sidebar",
        component: "Sidebar",
        props: {
          title: "Navigation",
          items: sidebarItems
        },
        position: "replace"
      });
    }

    if (navbarTitle) {
      operations.push({
        type: "update",
        target: "navbar",
        component: "Navbar",
        props: {
          title: navbarTitle
        },
        position: "replace"
      });
    }

    if (primaryButtonLabel) {
      operations.push({
        type: "update",
        target: "content:button:last",
        component: "Button",
        props: {
          label: primaryButtonLabel,
          variant: "primary"
        },
        position: "replace"
      });
    }

    if (kpiNames.length > 0) {
      kpiNames.slice(0, 3).forEach((title, idx) => {
        if (!title) return;
        operations.push({
          type: "update",
          target: `content:card:${idx + 1}`,
          component: "Card",
          props: {
            title
          },
          position: "replace"
        });
      });
    }
  }

  for (const component of components) {
    if (normalizedMode === "modify" && !wantsAdd) {
      // In modify mode, mention of components should not auto-append duplicates unless user explicitly asks to add.
      continue;
    }
    const target = component === "Navbar" ? "navbar" : component === "Sidebar" ? "sidebar" : "content";
    operations.push({
      type: "add",
      target,
      component,
      props: defaultPropsFor(component, intent),
      position: target === "content" ? "append" : "replace"
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

function resolveContentIndex(content, target, componentHint) {
  const children = Array.isArray(content?.children) ? content.children : [];
  if (children.length === 0) return -1;

  if (target === "content:first") return 0;
  if (target === "content:last") return children.length - 1;

  const match = target.match(/^content:([a-z]+):(first|last|\d+)$/i);
  if (!match) return -1;

  const rawType = match[1].toLowerCase();
  const which = match[2].toLowerCase();
  const wantedType = componentHint || `${rawType[0].toUpperCase()}${rawType.slice(1)}`;
  const hits = [];

  children.forEach((node, idx) => {
    if ((node?.type || "").toLowerCase() === wantedType.toLowerCase()) {
      hits.push(idx);
    }
  });

  if (hits.length === 0) return -1;
  if (which === "first") return hits[0];
  if (which === "last") return hits[hits.length - 1];
  const oneBased = Number(which);
  if (!Number.isFinite(oneBased) || oneBased < 1) return -1;
  return hits[oneBased - 1] ?? -1;
}

function mentionsSidebarTitleUpdate(intent) {
  const text = String(intent || "").toLowerCase();
  return text.includes("sidebar title");
}

function isAllowedModifyTarget(target) {
  if (target === "navbar" || target === "sidebar") return true;
  if (/^content:(card|button):/i.test(target)) return true;
  if (/^id:/i.test(target)) return true;
  return false;
}

export function applyPlanToTree({ previousTree, plan, mode, intent }) {
  const base = mode === "generate" || !previousTree ? clone(DEFAULT_TREE) : clone(previousTree);
  const content = getContentNode(base);
  if (!content) return base;

  for (const op of plan.operations) {
    const opComponent = op.component || inferComponent(intent);
    let target = typeof op.target === "string" ? op.target : "content";
    // Deterministic single-slot components must not be appended into content.
    if (opComponent === "Navbar") target = "navbar";
    if (opComponent === "Sidebar") target = "sidebar";
    if (mode === "modify") {
      const lowerComponent = String(opComponent || "").toLowerCase();
      if ((target === "content" || target === "content:last" || target === "content:first") && lowerComponent) {
        if (lowerComponent === "card" || lowerComponent === "button" || lowerComponent === "table" || lowerComponent === "chart") {
          target = `content:${lowerComponent}:last`;
        }
      }
    }
    const idTarget = target.startsWith("id:") ? target.slice(3) : "";

    if (mode === "modify") {
      if (op.type !== "update") {
        continue;
      }
      if (!isAllowedModifyTarget(target)) {
        continue;
      }
      if (idTarget) {
        const located = findNodeById(base, idTarget);
        const nodeType = located?.node?.type || "";
        if (!nodeType || layoutComponents.includes(nodeType) || !componentRegistry.includes(nodeType)) {
          continue;
        }
      }
    }

    if (target === "navbar" && base.children?.[0]) {
      const existing = base.children[0]?.props || {};
      const sanitized = sanitizeComponentProps("Navbar", op.props || {}, intent, existing);
      base.children[0] = {
        ...(base.children[0] || {}),
        type: "Navbar",
        props: sanitized
      };
      continue;
    }

    if (target === "sidebar" && base.children?.[1]?.children?.[0]) {
      const existing = base.children[1].children[0]?.props || {};
      const requested = { ...(op.props || {}) };
      // In modify mode, avoid accidental sidebar title rewrites unless explicitly requested.
      if (mode === "modify" && !mentionsSidebarTitleUpdate(intent)) {
        delete requested.title;
      }
      const sanitized = sanitizeComponentProps("Sidebar", requested, intent, existing);
      base.children[1].children[0] = {
        ...(base.children[1].children[0] || {}),
        type: "Sidebar",
        props: sanitized
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

    const nodeComponent = opComponent;
    const componentNode = {
      id: op.id || nextNodeId(base, (op.component || inferComponent(intent)).toLowerCase()),
      type: nodeComponent,
      props: sanitizeComponentProps(nodeComponent, op.props || {}, intent)
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
          const nextType = componentNode.type;
          const prevType = located.node.type;
          located.node.type = componentNode.type;
          located.node.props =
            prevType === nextType
              ? {
                  ...(located.node.props || {}),
                  ...(componentNode.props || {})
                }
              : { ...(componentNode.props || {}) };
          continue;
        }
      }

      content.children = content.children || [];
      if (content.children.length === 0) {
        content.children.push(componentNode);
      } else {
        const resolvedIdx = resolveContentIndex(content, target, componentNode.type);
        // If a typed content target cannot be resolved (e.g. content:card:3 with only one card),
        // skip instead of overwriting an unrelated node.
        if (
          resolvedIdx < 0 &&
          /^content:[a-z]+:(first|last|\d+)$/i.test(target) &&
          target !== "content:first" &&
          target !== "content:last"
        ) {
          continue;
        }
        const idx = resolvedIdx >= 0 ? resolvedIdx : target === "content:first" ? 0 : content.children.length - 1;
        const prevType = content.children[idx].type;
        const nextType = componentNode.type;
        content.children[idx] = {
          ...content.children[idx],
          type: componentNode.type,
          props:
            prevType === nextType
              ? {
                  ...(content.children[idx].props || {}),
                  ...(componentNode.props || {})
                }
              : { ...(componentNode.props || {}) }
        };
      }
    }
  }

  return base;
}
