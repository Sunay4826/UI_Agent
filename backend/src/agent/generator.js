import { createLegacyFromUITree } from "../core/astTypes.js";

function safeString(value) {
  return JSON.stringify(value ?? "");
}

function renderProps(props) {
  if (!props || typeof props !== "object") {
    return "{}";
  }
  return JSON.stringify(props, null, 2);
}

function nodeToCode(node, depth = 2) {
  const indent = "  ".repeat(depth);

  if (node.type === "page" || node.type === "layout") {
    const className = node.className || "generated-block";
    const children = (node.children || []).map((child) => nodeToCode(child, depth + 1)).join(",\n");
    return `${indent}React.createElement("div", { className: ${safeString(className)} }${children ? `,\n${children}\n${indent}` : ""})`;
  }

  const propsCode = renderProps(node.props);
  return `${indent}React.createElement(${node.type}, ${propsCode})`;
}

export function generateCodeFromTree(tree) {
  const body = nodeToCode(tree, 2);
  return `function renderGeneratedUI(React, components) {
  const { Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart } = components;
  return (
${body}
  );
}`;
}

export function generateReactCode(uiTree) {
  const legacyTree = createLegacyFromUITree(uiTree);
  if (!legacyTree) {
    return `function renderGeneratedUI(React, components) {
  return React.createElement("div", null, "Invalid UI tree");
}`;
  }

  return generateCodeFromTree(legacyTree);
}
