function normalizeErrors(validationErrors) {
  if (!validationErrors) return ["Unknown validation error."];

  if (Array.isArray(validationErrors)) {
    return validationErrors.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const component = item.component ? `${item.component}: ` : "";
        const prop = item.prop ? `${item.prop} - ` : "";
        const issue = item.issue || JSON.stringify(item);
        return `${component}${prop}${issue}`;
      }
      return String(item);
    });
  }

  if (typeof validationErrors === "string") return [validationErrors];

  if (validationErrors.errors && Array.isArray(validationErrors.errors)) {
    return normalizeErrors(validationErrors.errors);
  }

  return [JSON.stringify(validationErrors)];
}

function detectRule(errorText) {
  const text = errorText.toLowerCase();

  if (text.includes("component not allowed") || text.includes("non-whitelisted")) {
    return "Only approved components can be used.";
  }
  if (text.includes("inline styles")) {
    return "Inline styles are not allowed in deterministic output.";
  }
  if (text.includes("tailwind")) {
    return "Tailwind or utility-class generation is blocked.";
  }
  if (text.includes("external") || text.includes("import")) {
    return "External UI libraries are not allowed.";
  }
  if (text.includes("missing required prop")) {
    return "All required component props must be present.";
  }
  if (text.includes("unknown prop")) {
    return "Only schema-approved props are allowed.";
  }
  if (text.includes("invalid prop type")) {
    return "Component props must match required types.";
  }
  if (text.includes("nested component misuse")) {
    return "Components must follow the fixed layout/component hierarchy.";
  }
  if (text.includes("syntax validation failed")) {
    return "Generated React code must be syntactically valid.";
  }

  return "Validation rules for deterministic generation were violated.";
}

function suggestFix(errorText) {
  const text = errorText.toLowerCase();

  if (text.includes("component not allowed") || text.includes("non-whitelisted")) {
    return "Ask for one of the approved components: Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart.";
  }
  if (text.includes("inline styles") || text.includes("tailwind") || text.includes("external")) {
    return "Rephrase your request to focus on layout/content changes only, without custom styling or external libraries.";
  }
  if (text.includes("missing required prop") || text.includes("invalid prop type") || text.includes("unknown prop")) {
    return "Specify valid component props clearly (for example, Card needs title/body, Modal needs title/body/open/confirmLabel).";
  }
  if (text.includes("syntax validation failed")) {
    return "If editing code manually, keep the renderGeneratedUI function shape and valid React.createElement syntax.";
  }

  return "Try a simpler request that modifies existing UI sections instead of changing system constraints.";
}

export function buildValidationFeedback(validationErrors) {
  const errors = normalizeErrors(validationErrors);
  const primary = errors[0] || "Unknown validation error.";

  return {
    what_went_wrong: primary,
    rule_violated: detectRule(primary),
    how_to_fix: suggestFix(primary),
    details: errors
  };
}
