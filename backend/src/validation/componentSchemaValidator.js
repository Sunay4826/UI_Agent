import { ALLOWED_COMPONENTS } from "../constants/componentRegistry.js";

const COMPONENT_PROP_SCHEMA = {
  Button: {
    required: ["label"],
    optional: ["variant"],
    types: {
      label: "string",
      variant: { enum: ["primary", "secondary"] }
    }
  },
  Card: {
    required: ["title", "body"],
    optional: ["footer"],
    types: {
      title: "string",
      body: "string",
      footer: "string"
    }
  },
  Input: {
    required: ["label", "placeholder", "value"],
    optional: [],
    types: {
      label: "string",
      placeholder: "string",
      value: "string"
    }
  },
  Table: {
    required: ["columns", "rows"],
    optional: [],
    types: {
      columns: "string[]",
      rows: "string[][]"
    }
  },
  Modal: {
    required: ["title", "body", "open", "confirmLabel"],
    optional: [],
    types: {
      title: "string",
      body: "string",
      open: "boolean",
      confirmLabel: "string"
    }
  },
  Sidebar: {
    required: ["title", "items"],
    optional: [],
    types: {
      title: "string",
      items: "string[]"
    }
  },
  Navbar: {
    required: ["title", "links"],
    optional: [],
    types: {
      title: "string",
      links: "string[]"
    }
  },
  Chart: {
    required: ["title", "points", "labels"],
    optional: [],
    types: {
      title: "string",
      points: "number[]",
      labels: "string[]"
    },
    custom: (props) => {
      if (props.points.length !== props.labels.length) {
        return "points and labels must have the same length";
      }
      return "";
    }
  }
};

function isType(value, expectedType) {
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "boolean") return typeof value === "boolean";

  if (expectedType === "string[]") {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  if (expectedType === "number[]") {
    return Array.isArray(value) && value.every((item) => typeof item === "number");
  }

  if (expectedType === "string[][]") {
    return (
      Array.isArray(value) &&
      value.every((row) => Array.isArray(row) && row.every((item) => typeof item === "string"))
    );
  }

  return false;
}

function validateNode(node, errors) {
  if (!node || typeof node !== "object") {
    return;
  }

  if (node.type === "page" || node.type === "layout") {
    if (!Array.isArray(node.children)) {
      errors.push({
        component: node.type,
        prop: "children",
        issue: "Layout nodes must contain a children array"
      });
      return;
    }

    for (const child of node.children) {
      validateNode(child, errors);
    }
    return;
  }

  if (!ALLOWED_COMPONENTS.includes(node.type)) {
    errors.push({
      component: node.type || "Unknown",
      prop: "type",
      issue: "Component is not in allowed registry"
    });
    return;
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    errors.push({
      component: node.type,
      prop: "children",
      issue: "Nested component misuse: leaf components may not define children"
    });
  }

  const schema = COMPONENT_PROP_SCHEMA[node.type];
  const props = node.props || {};
  const allowedKeys = new Set([...schema.required, ...schema.optional]);

  for (const key of Object.keys(props)) {
    if (!allowedKeys.has(key)) {
      errors.push({
        component: node.type,
        prop: key,
        issue: "Unknown prop"
      });
    }
  }

  for (const key of schema.required) {
    if (!(key in props)) {
      errors.push({
        component: node.type,
        prop: key,
        issue: "Missing required prop"
      });
    }
  }

  for (const key of Object.keys(schema.types)) {
    if (!(key in props)) continue;

    const rule = schema.types[key];
    if (typeof rule === "object" && Array.isArray(rule.enum)) {
      if (!rule.enum.includes(props[key])) {
        errors.push({
          component: node.type,
          prop: key,
          issue: `Invalid prop value. Allowed: ${rule.enum.join(", ")}`
        });
      }
      continue;
    }

    if (!isType(props[key], rule)) {
      errors.push({
        component: node.type,
        prop: key,
        issue: `Invalid prop type. Expected ${rule}`
      });
    }
  }

  if (typeof schema.custom === "function") {
    const customIssue = schema.custom(props);
    if (customIssue) {
      errors.push({
        component: node.type,
        prop: "props",
        issue: customIssue
      });
    }
  }
}

export function validateComponentSchema(generatedAst) {
  const errors = [];

  validateNode(generatedAst, errors);

  return {
    valid: errors.length === 0,
    errors
  };
}

export { COMPONENT_PROP_SCHEMA };
