import { ALLOWED_COMPONENTS } from "../constants/componentRegistry.js";

const BLOCKED_TOKENS = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "eval(",
  "document.",
  "window.",
  "localStorage",
  "sessionStorage",
  "Function("
];

const EXTERNAL_UI_LIB_PATTERNS = [
  /from\s+["'](@mui|antd|chakra-ui|semantic-ui|primereact|react-bootstrap)/i,
  /import\s+.*(MaterialUI|Antd|Chakra)/i
];

const TAILWIND_PATTERN = /className\s*:\s*["'`][^"'`]*(\b(?:p|px|py|m|mx|my|mt|mb|ml|mr|pt|pb|pl|pr|text|bg|w|h|min|max|flex|grid|items|justify|gap|rounded|shadow|border)-[a-z0-9-]+\b)[^"'`]*["'`]/i;

function push(errors, issue) {
  errors.push(issue);
}

function parseImports(code) {
  const importMatches = [...code.matchAll(/import\s+([^;]+)\s+from\s+["']([^"']+)["']/g)];
  return importMatches.map((m) => ({ clause: m[1], source: m[2] }));
}

function validateImports(code, allowedComponents, errors) {
  const imports = parseImports(code);
  for (const item of imports) {
    if (item.source.startsWith(".")) continue;

    // External package imports are disallowed for generated render code.
    push(errors, `External import is not allowed: ${item.source}`);
  }

  for (const item of imports) {
    if (!item.clause.includes("{")) continue;
    const inside = item.clause.slice(item.clause.indexOf("{") + 1, item.clause.lastIndexOf("}"));
    const imported = inside
      .split(",")
      .map((name) => name.trim().split(" as ")[0].trim())
      .filter(Boolean);

    for (const name of imported) {
      if (!allowedComponents.includes(name) && name !== "React") {
        push(errors, `Imported component is not allowed: ${name}`);
      }
    }
  }
}

function validateComponentUsage(code, allowedComponents, errors) {
  const matches = [...code.matchAll(/React\.createElement\((\w+)/g)].map((m) => m[1]);
  const componentNames = matches.filter((name) => /^[A-Z]/.test(name));

  for (const name of componentNames) {
    if (!allowedComponents.includes(name)) {
      push(errors, `Component not allowed: ${name}`);
    }
  }
}

export function validateGeneratedCode(code, allowedComponents = ALLOWED_COMPONENTS) {
  const errors = [];

  if (!code || typeof code !== "string") {
    return { valid: false, errors: ["Generated code must be a string."], error: "Generated code must be a string." };
  }

  if (code.length > 60000) {
    push(errors, "Generated code is too large.");
  }

  if (!code.includes("function renderGeneratedUI")) {
    push(errors, "Code must define renderGeneratedUI(React, components).");
  }

  for (const token of BLOCKED_TOKENS) {
    if (code.includes(token)) {
      push(errors, `Blocked token in generated code: ${token}`);
    }
  }

  if (/\bstyle\s*:/.test(code)) {
    push(errors, "Inline styles are not allowed.");
  }

  if (TAILWIND_PATTERN.test(code)) {
    push(errors, "Tailwind-like utility classes are not allowed.");
  }

  for (const pattern of EXTERNAL_UI_LIB_PATTERNS) {
    if (pattern.test(code)) {
      push(errors, "External UI libraries are not allowed.");
      break;
    }
  }

  validateImports(code, allowedComponents, errors);
  validateComponentUsage(code, allowedComponents, errors);

  try {
    // Syntax-only check
    new Function(`"use strict";\n${code}\nreturn typeof renderGeneratedUI === 'function';`);
  } catch (error) {
    push(errors, `Syntax validation failed: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    error: errors[0] || ""
  };
}
