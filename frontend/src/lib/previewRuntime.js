import React from "react";
import { allowedComponentNames } from "./componentRegistry";

const BLOCKED_TOKENS = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "eval(",
  "document.",
  "window.",
  "localStorage",
  "sessionStorage"
];

const EXTERNAL_UI_LIB_PATTERNS = [
  /from\s+["'](@mui|antd|chakra-ui|semantic-ui|primereact|react-bootstrap)/i,
  /import\s+.*(MaterialUI|Antd|Chakra)/i
];

const TAILWIND_PATTERN = /className\s*:\s*["'`][^"'`]*(\b(?:p|px|py|m|mx|my|mt|mb|ml|mr|pt|pb|pl|pr|text|bg|w|h|min|max|flex|grid|items|justify|gap|rounded|shadow|border)-[a-z0-9-]+\b)[^"'`]*["'`]/i;

export function validatePreviewCode(code) {
  const errors = [];

  if (!code || typeof code !== "string") {
    return { valid: false, errors: ["Code must be a non-empty string."], error: "Code must be a non-empty string." };
  }

  if (!code.includes("function renderGeneratedUI")) {
    errors.push("Code must define renderGeneratedUI(React, components).");
  }

  for (const blocked of BLOCKED_TOKENS) {
    if (code.includes(blocked)) {
      errors.push(`Blocked token detected: ${blocked}`);
    }
  }

  if (/\bstyle\s*:/.test(code)) {
    errors.push("Inline styles are not allowed.");
  }

  if (TAILWIND_PATTERN.test(code)) {
    errors.push("Tailwind-like utility classes are not allowed.");
  }

  for (const pattern of EXTERNAL_UI_LIB_PATTERNS) {
    if (pattern.test(code)) {
      errors.push("External UI libraries are not allowed.");
      break;
    }
  }

  const matches = [...code.matchAll(/React\.createElement\((\w+)/g)].map((m) => m[1]);
  const componentNames = matches.filter((name) => /^[A-Z]/.test(name));
  const unknown = componentNames.find((name) => !allowedComponentNames.includes(name));
  if (unknown) {
    errors.push(`Non-whitelisted component used: ${unknown}`);
  }

  try {
    new Function(`"use strict";\n${code}\nreturn typeof renderGeneratedUI === 'function';`);
  } catch (e) {
    errors.push(`Syntax validation failed: ${e.message}`);
  }

  return { valid: errors.length === 0, errors, error: errors[0] || "" };
}

export function compilePreview(code) {
  const wrapped = `"use strict";\n${code}\nreturn renderGeneratedUI;`;
  const factory = new Function(wrapped);
  return factory();
}

export function renderPreviewElement(code, componentRegistry) {
  const validation = validatePreviewCode(code);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const renderer = compilePreview(code);
  if (typeof renderer !== "function") {
    throw new Error("renderGeneratedUI must be a function.");
  }

  const element = renderer(React, componentRegistry);
  if (!React.isValidElement(element)) {
    throw new Error("Generated function did not return a valid React element.");
  }

  return element;
}
