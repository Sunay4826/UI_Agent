import { enforceDeterministicPlan } from "./deterministicEnforcer.js";
import { deterministicEnforcementPrompt } from "./prompts.js";

export function normalizePlan(plannerOutput) {
  const normalizedPlan = enforceDeterministicPlan(plannerOutput);
  return {
    normalizedPlan,
    prompt: deterministicEnforcementPrompt({ plannerOutput })
  };
}
