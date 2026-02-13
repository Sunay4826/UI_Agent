import { editAwarenessExplainerPrompt, explainerPrompt } from "./prompts.js";
import { llmText } from "../services/llmClient.js";

function collectIds(node, bucket) {
  if (!node || typeof node !== "object") return;
  if (node.id) bucket.add(node.id);
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectIds(child, bucket);
  }
}

function countNodes(node) {
  if (!node || typeof node !== "object") return 0;
  let total = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += countNodes(child);
  }
  return total;
}

function editAwareHeuristic({ intent, previousAst, updatedAst, plan }) {
  const prevIds = new Set();
  const nextIds = new Set();
  collectIds(previousAst, prevIds);
  collectIds(updatedAst, nextIds);

  let preserved = 0;
  for (const id of prevIds) {
    if (nextIds.has(id)) preserved += 1;
  }
  const added = Math.max(0, nextIds.size - preserved);
  const modified = Array.isArray(plan?.operations)
    ? plan.operations.filter((op) => op.type === "update").length
    : 0;

  const prevCount = countNodes(previousAst);
  const nextCount = countNodes(updatedAst);

  return [
    `Preserved: ${preserved} existing UI nodes remained in place.`,
    `Modified: ${modified} targeted updates were applied based on your request.`,
    `Added: ${added} new nodes were introduced where needed.`,
    `Minimal change rationale: The structure moved from ${prevCount} to ${nextCount} nodes and avoided full rewrite.`,
    `Intent focus: ${intent.slice(0, 180)}`
  ].join("\n");
}

function heuristicExplanation({ intent, plan, plannerSource, generatedAst }) {
  const lines = [];
  lines.push("1. Intent interpretation:");
  lines.push(`I interpreted your request as: "${intent.slice(0, 180)}".`);

  lines.push("2. Component choices:");
  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    lines.push("No component changes were required for this update.");
  } else {
    for (const op of plan.operations) {
      lines.push(`- ${op.type} ${op.component || "component"} at ${op.target}.`);
    }
  }

  lines.push("3. Layout structure:");
  const topLevelCount = Array.isArray(generatedAst?.children) ? generatedAst.children.length : 0;
  lines.push(`The layout keeps a stable hierarchy with ${topLevelCount} top-level sections.`);

  lines.push("4. Deterministic constraints:");
  lines.push(`Planner source was ${plannerSource}.`);
  lines.push("Only approved components were used, with fixed schemas and validation checks.");

  return lines.join("\n");
}

export async function runExplainer({
  intent,
  mode,
  plan,
  plannerSource,
  previousAst,
  generatedAst,
  apiKey,
  model,
  provider = "openai"
}) {
  const editAware = Boolean(previousAst) && (mode === "modify" || mode === "regenerate");
  const prompt = editAware
    ? editAwarenessExplainerPrompt({
        previousAst,
        updatedAst: generatedAst,
        userIntent: intent
      })
    : explainerPrompt({
        userIntent: intent,
        plannerOutput: plan,
        generatedAst
      });
  const llmExplanation = await llmText({ prompt, apiKey, model, provider });

  if (llmExplanation && llmExplanation.trim().length > 0) {
    return llmExplanation;
  }

  if (editAware) {
    return editAwareHeuristic({
      intent,
      previousAst,
      updatedAst: generatedAst,
      plan
    });
  }

  return heuristicExplanation({ intent, plan, plannerSource, generatedAst });
}
