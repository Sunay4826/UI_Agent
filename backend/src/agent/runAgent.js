import { runInjectionGuard } from "./injectionGuard.js";
import { classifyIntent } from "./intentClassifier.js";
import { runPlanner } from "./planner.js";
import { normalizePlan } from "./normalizer.js";
import { applyPlanToTree } from "./treeOps.js";
import { generateReactCode } from "./generator.js";
import { runExplainer } from "./explainer.js";
import { createLegacyFromUITree, createUITreeFromLegacy } from "../core/astTypes.js";
import {
  getCurrentVersionRecord,
  getLatestTree,
  getOrCreateSession,
  getVersionById,
  getVersionList,
  rollbackVersion,
  saveVersion
} from "../store/versionStore.js";
import { validateProps } from "../validation/propValidator.js";
import { validateGeneratedCode } from "../validation/codeValidator.js";
import { validationFeedbackPrompt } from "../validation/validationFeedbackPrompt.js";
import { buildValidationFeedback } from "../validation/validationFeedback.js";
import { codeValidationPrompt } from "../validation/codeValidationPrompt.js";
import { componentRegistry } from "../core/componentRegistry.js";

function buildError(status, message, errors, extra = {}) {
  const validationErrors = Array.isArray(errors) && errors.length ? errors : [message];
  return {
    ok: false,
    status,
    payload: {
      error: message,
      feedback: buildValidationFeedback(validationErrors),
      feedback_prompt: validationFeedbackPrompt({ validationErrors }),
      ...extra
    }
  };
}

export async function runAgent({ userMessage, mode, sessionId, apiKey, model, llmOnly = false }) {
  const guard = runInjectionGuard(userMessage || "");
  const effectiveIntent = (guard.safe_intent_summary || "").trim();
  const requestedMode =
    mode === "modify" || mode === "regenerate" || mode === "generate" ? mode : "generate";

  if (!guard.is_safe && !effectiveIntent) {
    return buildError(400, guard.violation_reason || "Unsafe intent", [guard.violation_reason], {
      security_check: guard,
      security_prompt: guard.prompt
    });
  }

  const session = getOrCreateSession(sessionId);
  const versions = getVersionList(session.id);
  const currentVersion = getCurrentVersionRecord(session.id);
  const previousAst = getLatestTree(session.id);

  let intentInfo = await classifyIntent({
    userIntent: effectiveIntent,
    versionList: versions,
    currentAst: previousAst,
    currentVersionId: currentVersion?.id || "",
    apiKey,
    model
  });

  // User action buttons should be authoritative.
  if (requestedMode === "modify" || requestedMode === "regenerate") {
    intentInfo = {
      ...intentInfo,
      intentType: "modify",
      intent_type: "modify",
      forced_by_mode: requestedMode
    };
  }

  if (intentInfo.intentType === "rollback") {
    if (!intentInfo.targetVersion) {
      intentInfo = {
        ...intentInfo,
        intentType: "modify",
        intent_type: "modify",
        rollback_fallback_reason: "No rollback target version found, fallback to modify."
      };
    }
  }

  if (intentInfo.intentType === "rollback") {
    const rollback = rollbackVersion(session.id, intentInfo.targetVersion);
    if (!rollback.ok) {
      intentInfo = {
        ...intentInfo,
        intentType: "modify",
        intent_type: "modify",
        rollback_fallback_reason: rollback.error || "Rollback failed, fallback to modify."
      };
    } else {
      return {
        ok: true,
        status: 200,
        payload: {
          sessionId: session.id,
          currentVersionId: rollback.version.id,
          version: rollback.version,
          version_intent: intentInfo,
          history: getVersionList(session.id)
        }
      };
    }
  }

  if (intentInfo.intentType === "compare") {
    if (!currentVersion) {
      intentInfo = {
        ...intentInfo,
        intentType: "modify",
        intent_type: "modify",
        compare_fallback_reason: "No active version available, fallback to modify."
      };
    }
  }

  if (intentInfo.intentType === "compare") {
    if (!currentVersion) {
      return buildError(400, "No active version available to compare.", ["No active version available to compare."], {
        version_intent: intentInfo
      });
    }

    const targetVersion =
      getVersionById(session.id, intentInfo.targetVersion) ||
      versions.find((item) => item.id !== currentVersion.id) ||
      null;

    return {
      ok: true,
      status: 200,
      payload: {
        sessionId: session.id,
        currentVersionId: currentVersion.id,
        version: currentVersion,
        version_intent: intentInfo,
        comparison: {
          current_version: currentVersion.id,
          target_version: targetVersion?.id || "",
          current_code_size: (currentVersion.code || "").length,
          target_code_size: (targetVersion?.code || "").length,
          current_plan_title: currentVersion?.plan?.title || "",
          target_plan_title: targetVersion?.plan?.title || ""
        },
        history: getVersionList(session.id)
      }
    };
  }

  const previousLegacyTree = createLegacyFromUITree(previousAst);
  const plannerMode = requestedMode === "regenerate" ? "generate" : requestedMode;
  const plannerPreviousTree = requestedMode === "regenerate" ? null : previousLegacyTree;
  const hasApiKey = Boolean(apiKey && String(apiKey).trim());
  const enforceLlm = Boolean(llmOnly) || hasApiKey;

  if (enforceLlm && !hasApiKey) {
    return buildError(500, "LLM configuration missing.", ["GEMINI_API_KEY is required in LLM-only mode."], {
      version_intent: intentInfo,
      llm_required: true
    });
  }

  let planner;
  try {
    planner = await runPlanner({
      intent: effectiveIntent,
      mode: plannerMode,
      previousPlan: currentVersion?.plan || null,
      previousCode: currentVersion?.code || null,
      previousTree: plannerPreviousTree,
      apiKey,
      model,
      enforceLlm
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "LLM planner failed.";
    return buildError(502, "LLM planning failed.", [reason], {
      version_intent: intentInfo,
      llm_required: enforceLlm
    });
  }

  const normalized = normalizePlan(planner.plan);

  const nextLegacyTree = applyPlanToTree({
    previousTree: plannerPreviousTree,
    plan: normalized.normalizedPlan,
    mode: plannerMode,
    intent: effectiveIntent
  });

  const nextAst = createUITreeFromLegacy(nextLegacyTree, Number(previousAst?.version || 0) + 1);

  const propValidation = validateProps(nextAst);
  if (!propValidation.valid) {
    return buildError(400, "Prop validation failed.", propValidation.errors, {
      version_intent: intentInfo,
      prop_validation: propValidation
    });
  }

  const code = generateReactCode(nextAst);
  const codeValidation = validateGeneratedCode(code);
  if (!codeValidation.valid) {
    return buildError(400, "Code validation failed.", codeValidation.errors, {
      version_intent: intentInfo,
      validation: codeValidation,
      validation_prompt: codeValidationPrompt({
        generatedCode: code,
        componentRegistry: componentRegistry
      })
    });
  }

  const explanation = await runExplainer({
    intent: effectiveIntent,
    mode: requestedMode,
    plan: normalized.normalizedPlan,
    plannerSource: planner.source,
    previousAst: previousAst.root,
    generatedAst: nextAst.root,
    apiKey,
    model
  });

  const savedVersion = saveVersion({
    sessionId: session.id,
    payload: {
      sessionId: session.id,
      intent: effectiveIntent,
      mode: requestedMode,
      plannerSource: planner.source,
      plan: normalized.normalizedPlan,
      uiTree: nextLegacyTree,
      uiAst: nextAst,
      code,
      explanation
    }
  });

  return {
    ok: true,
    status: 200,
    payload: {
      sessionId: session.id,
      currentVersionId: savedVersion.id,
      version: savedVersion,
      security_check: guard,
      security_warning:
        !guard.is_safe && effectiveIntent
          ? "Unsafe instructions were removed. The safe portion of your intent was used."
          : "",
      version_intent: intentInfo,
      deterministic_prompt: normalized.prompt,
      prop_validation: propValidation,
      code_validation: codeValidation,
      history: getVersionList(session.id)
    }
  };
}
