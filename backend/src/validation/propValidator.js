import { componentRegistry, layoutComponents } from "../core/componentRegistry.js";
import { propSchemas } from "../core/propSchemas.js";

function isValidType(value, expected) {
  if (Array.isArray(expected)) {
    return expected.includes(value);
  }

  if (expected === "string") return typeof value === "string";
  if (expected === "boolean") return typeof value === "boolean";
  if (expected === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string");
  if (expected === "number[]") return Array.isArray(value) && value.every((item) => typeof item === "number");
  if (expected === "string[][]") {
    return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((v) => typeof v === "string"));
  }

  return false;
}

function validateNode(node, errors) {
  if (!node || typeof node !== "object") {
    errors.push({ component: "Unknown", prop: "node", issue: "Invalid AST node" });
    return;
  }

  if (layoutComponents.includes(node.component)) {
    if (!Array.isArray(node.children)) {
      errors.push({
        component: node.component,
        prop: "children",
        issue: "Layout nodes must include children array"
      });
      return;
    }
    for (const child of node.children) validateNode(child, errors);
    return;
  }

  if (!componentRegistry.includes(node.component)) {
    errors.push({
      component: node.component || "Unknown",
      prop: "component",
      issue: "Component is not in registry"
    });
    return;
  }

  const schema = propSchemas[node.component];
  const props = node.props && typeof node.props === "object" ? node.props : {};
  const allowed = new Set([...(schema.required || []), ...(schema.optional || [])]);

  for (const required of schema.required || []) {
    if (!(required in props)) {
      errors.push({
        component: node.component,
        prop: required,
        issue: "Missing required prop"
      });
    }
  }

  for (const key of Object.keys(props)) {
    if (!allowed.has(key)) {
      errors.push({
        component: node.component,
        prop: key,
        issue: "Unknown prop"
      });
      continue;
    }

    const typeRule = schema.types?.[key];
    if (typeRule && !isValidType(props[key], typeRule)) {
      errors.push({
        component: node.component,
        prop: key,
        issue: "Invalid prop type"
      });
    }
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    errors.push({
      component: node.component,
      prop: "children",
      issue: "Nested component misuse"
    });
  }
}

export function validateProps(uiTree) {
  const errors = [];

  if (!uiTree || typeof uiTree !== "object" || !uiTree.root) {
    return {
      valid: false,
      errors: [{ component: "UITree", prop: "root", issue: "Missing root node" }]
    };
  }

  validateNode(uiTree.root, errors);
  return {
    valid: errors.length === 0,
    errors
  };
}
