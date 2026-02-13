import { llmJson } from "../services/llmClient.js";
import { rollbackAwarePlannerPrompt } from "./prompts.js";

function findVersionByToken(versionList, token) {
  if (!token) return null;
  return (
    versionList.find((v) => v.id === token) ||
    versionList.find((v) => v.id.startsWith(token)) ||
    null
  );
}

function extractVersionTokens(intent) {
  const tokens = [];
  const matches = intent.match(/ver_[a-z0-9_]+/gi) || [];
  for (const match of matches) tokens.push(match);
  return [...new Set(tokens)];
}

function heuristicVersionIntent({ userIntent, versionList, currentAst, currentVersionId }) {
  const text = userIntent.toLowerCase();

  let intentType = "modify";
  if (/(compare|diff|difference|versus|\bvs\b)/i.test(text)) {
    intentType = "compare";
  } else if (/(rollback|restore|revert|undo|go back|previous version|older version)/i.test(text)) {
    intentType = "rollback";
  }

  const tokens = extractVersionTokens(userIntent);
  let targetVersion = "";

  if (tokens.length > 0) {
    const hit = findVersionByToken(versionList, tokens[0]);
    targetVersion = hit?.id || "";
  }

  if (!targetVersion && intentType === "rollback") {
    const fallback = versionList.find((v) => v.id !== currentVersionId) || null;
    targetVersion = fallback?.id || "";
  }

  if (!targetVersion && intentType === "compare") {
    const fallback = versionList.find((v) => v.id !== currentVersionId) || null;
    targetVersion = fallback?.id || "";
  }

  const modificationPlan =
    intentType === "modify"
      ? {
          strategy: "minimal-change",
          preserve_layout: true,
          preserve_components: true,
          context_nodes: Array.isArray(currentAst?.children) ? currentAst.children.length : 0
        }
      : {};

  return {
    intent_type: intentType,
    target_version: targetVersion,
    modification_plan: modificationPlan
  };
}

function normalizeResult(raw, fallback, versionList) {
  if (!raw || typeof raw !== "object") return fallback;

  const intentType =
    raw.intent_type === "modify" || raw.intent_type === "rollback" || raw.intent_type === "compare"
      ? raw.intent_type
      : fallback.intent_type;

  let targetVersion = typeof raw.target_version === "string" ? raw.target_version : fallback.target_version;
  if (targetVersion) {
    const hit = findVersionByToken(versionList, targetVersion);
    targetVersion = hit?.id || fallback.target_version || "";
  }

  return {
    intent_type: intentType,
    target_version: targetVersion,
    modification_plan:
      raw.modification_plan && typeof raw.modification_plan === "object"
        ? raw.modification_plan
        : fallback.modification_plan
  };
}

export async function runVersionIntentPlanner({
  userIntent,
  versionList,
  currentAst,
  currentVersionId,
  apiKey,
  model,
  provider = "openai"
}) {
  const fallback = heuristicVersionIntent({ userIntent, versionList, currentAst, currentVersionId });

  const prompt = rollbackAwarePlannerPrompt({
    versionList,
    currentAst,
    userIntent
  });

  const llmOutput = await llmJson({ prompt, apiKey, model, provider });
  const result = normalizeResult(llmOutput, fallback, versionList);

  return {
    ...result,
    source: llmOutput ? "llm" : "heuristic",
    prompt
  };
}
