import { ALLOWED_COMPONENTS } from "../constants/componentRegistry.js";

export function validatePlan(plan) {
  if (!plan || typeof plan !== "object") {
    return { valid: false, error: "Plan must be an object." };
  }

  if (!Array.isArray(plan.operations)) {
    return { valid: false, error: "Plan.operations must be an array." };
  }

  for (const op of plan.operations) {
    if (!op || typeof op !== "object") {
      return { valid: false, error: "Invalid operation in plan." };
    }
    if (!["add", "update", "remove"].includes(op.type)) {
      return { valid: false, error: `Unsupported operation type: ${op.type}` };
    }
    if (op.component && !ALLOWED_COMPONENTS.includes(op.component)) {
      return { valid: false, error: `Plan uses non-whitelisted component: ${op.component}` };
    }
  }

  return { valid: true };
}
