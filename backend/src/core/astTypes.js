function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withId(base, fallback) {
  if (typeof base === "string" && base.trim()) return base;
  return fallback;
}

function legacyToNode(legacyNode, path = "root") {
  if (!legacyNode || typeof legacyNode !== "object") {
    return {
      id: withId("", `${path}_empty`),
      component: "Card",
      props: {},
      children: []
    };
  }

  const component =
    legacyNode.type === "page" ? "Page" : legacyNode.type === "layout" ? "Layout" : legacyNode.type;

  const props = {
    ...(legacyNode.props || {})
  };

  if (legacyNode.className) {
    props.className = legacyNode.className;
  }

  const children = Array.isArray(legacyNode.children)
    ? legacyNode.children.map((child, idx) => legacyToNode(child, `${path}_${idx}`))
    : [];

  return {
    id: withId(legacyNode.id, `${path}_${String(component || "Node").toLowerCase()}`),
    component: component || "Card",
    props,
    children
  };
}

function nodeToLegacy(uiNode) {
  const component = uiNode.component;
  const props = clone(uiNode.props || {});
  const children = Array.isArray(uiNode.children) ? uiNode.children.map(nodeToLegacy) : [];

  if (component === "Page" || component === "Layout") {
    const className = props.className || (component === "Page" ? "generated-page" : "generated-content");
    delete props.className;

    return {
      id: uiNode.id,
      type: component === "Page" ? "page" : "layout",
      className,
      children
    };
  }

  return {
    id: uiNode.id,
    type: component,
    props,
    children
  };
}

export function createUITreeFromLegacy(legacyTree, version = 1) {
  return {
    version,
    root: legacyToNode(legacyTree, "root")
  };
}

export function createLegacyFromUITree(uiTree) {
  if (!uiTree || !uiTree.root) return null;
  return nodeToLegacy(uiTree.root);
}

export function bumpTreeVersion(uiTree) {
  return {
    ...(uiTree || {}),
    version: Number(uiTree?.version || 0) + 1
  };
}
