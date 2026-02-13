import { plannerPrompt } from "./prompts.js";
import { llmJson } from "../services/llmClient.js";
import { buildHeuristicPlan } from "./treeOps.js";
import { validatePlan } from "../validation/planValidator.js";

function normalizeModifyPlan(rawPlan) {
  const updates = Array.isArray(rawPlan?.updates) ? rawPlan.updates : [];
  const additions = Array.isArray(rawPlan?.additions) ? rawPlan.additions : [];
  const removals = Array.isArray(rawPlan?.removals) ? rawPlan.removals : [];
  const layoutChanges = Array.isArray(rawPlan?.layout_changes) ? rawPlan.layout_changes : [];

  const normalizeTarget = (item, fallbackTarget) => {
    if (item?.target && typeof item.target === "string") return item.target;
    if (item?.id && typeof item.id === "string") return `id:${item.id}`;
    return fallbackTarget;
  };

  const operations = [];

  for (const item of updates) {
    operations.push({
      id: item?.id || null,
      type: "update",
      target: normalizeTarget(item, "content:last"),
      component: item?.component || null,
      props: item?.props || {},
      position: item?.position || "replace"
    });
  }

  for (const item of additions) {
    operations.push({
      id: item?.id || null,
      type: "add",
      target: normalizeTarget(item, "content"),
      component: item?.component || null,
      props: item?.props || {},
      position: item?.position || "append"
    });
  }

  for (const item of removals) {
    operations.push({
      id: item?.id || null,
      type: "remove",
      target: normalizeTarget(item, "content:last"),
      component: null,
      props: {},
      position: "append"
    });
  }

  for (const item of layoutChanges) {
    if (!item || typeof item !== "object") continue;
    if (item.target === "navbar" || item.target === "sidebar") {
      operations.push({
        id: item?.id || null,
        type: "update",
        target: item.target,
        component: item.component || (item.target === "navbar" ? "Navbar" : "Sidebar"),
        props: item.props || {},
        position: "replace"
      });
    }
  }

  return {
    action: "modify",
    updates,
    additions,
    removals,
    layout_changes: layoutChanges,
    reasoning: typeof rawPlan?.reasoning === "string" ? rawPlan.reasoning : "",
    title: "Incremental UI update",
    notes: ["Strict incremental planner output was normalized to deterministic operations."],
    operations
  };
}

export async function runPlanner({
  intent,
  mode,
  previousPlan,
  previousCode,
  previousTree,
  apiKey,
  model,
  provider = "openai",
  enforceLlm = false
}) {
  const prompt = plannerPrompt({ intent, mode, previousPlan, previousCode, previousTree });

  let llmFailureReason = "";
  try {
    const llmPlan = await llmJson({ prompt, apiKey, model, provider });
    if (llmPlan) {
      const normalizedPlan =
        mode === "modify" || mode === "regenerate" ? normalizeModifyPlan(llmPlan) : llmPlan;

      const valid = validatePlan(normalizedPlan);
      if (valid.valid) {
        return { plan: normalizedPlan, source: "llm" };
      }
      llmFailureReason = "LLM plan failed deterministic schema validation.";
    } else {
      llmFailureReason = "LLM did not return a valid JSON plan.";
    }
  } catch (error) {
    llmFailureReason = error instanceof Error ? error.message : "LLM planner request failed.";
  }

  if (enforceLlm) {
    throw new Error(llmFailureReason || "LLM planner failed and fallback is disabled.");
  }

  const fallbackPlan = buildHeuristicPlan({ intent, mode });
  return { plan: fallbackPlan, source: "heuristic" };
}
