import { runVersionIntentPlanner } from "./versionIntentPlanner.js";

export async function classifyIntent({
  userIntent,
  versionList,
  currentAst,
  currentVersionId,
  apiKey,
  model
}) {
  const result = await runVersionIntentPlanner({
    userIntent,
    versionList,
    currentAst,
    currentVersionId,
    apiKey,
    model
  });

  return {
    intentType: result.intent_type,
    targetVersion: result.target_version,
    modificationPlan: result.modification_plan,
    intent_type: result.intent_type,
    target_version: result.target_version,
    modification_plan: result.modification_plan,
    source: result.source,
    prompt: result.prompt
  };
}
