import { analyzeIntentSecurity } from "../validation/sanitize.js";
import { injectionDefensePrompt } from "../validation/injectionDefensePrompt.js";

export function runInjectionGuard(userIntent) {
  const result = analyzeIntentSecurity(userIntent);
  return {
    ...result,
    prompt: injectionDefensePrompt({ userIntent })
  };
}
