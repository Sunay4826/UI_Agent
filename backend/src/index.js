import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  addVersion,
  createSession,
  createVersion,
  ensureSession,
  getCurrentVersion,
  getSession,
  listVersions,
  rollbackToVersion
} from "./store/sessionStore.js";
import { analyzeIntentSecurity } from "./validation/sanitize.js";
import { validateGeneratedCode } from "./validation/codeValidator.js";
import { validateComponentSchema } from "./validation/componentSchemaValidator.js";
import { validateProps } from "./validation/propValidator.js";
import { codeValidationPrompt } from "./validation/codeValidationPrompt.js";
import { validationFeedbackPrompt } from "./validation/validationFeedbackPrompt.js";
import { buildValidationFeedback } from "./validation/validationFeedback.js";
import { ALLOWED_COMPONENTS } from "./constants/componentRegistry.js";
import { runAgent } from "./agent/runAgent.js";

const app = new Hono();

app.use("*", async (c, next) => {
  const allowedOrigin = c.env.ALLOWED_ORIGIN || "*";
  return cors({
    origin: allowedOrigin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"]
  })(c, next);
});

app.get("/api/health", (c) => c.json({ ok: true, service: "ai-ui-generator-api" }));

app.post("/api/session", (c) => {
  const session = createSession();
  return c.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    currentVersion: null,
    history: []
  });
});

app.get("/api/session/:sessionId/history", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json({
    sessionId,
    currentVersionId: session.currentVersionId,
    history: listVersions(sessionId)
  });
});

app.post("/api/generate", async (c) => {
  try {
    const body = await c.req.json();
    const mode = body.mode === "modify" || body.mode === "regenerate" ? body.mode : "generate";
    const llmOnlyEnv = String(c.env.LLM_ONLY || "true").toLowerCase();
    const llmOnly = llmOnlyEnv !== "false";
    const provider = String(c.env.LLM_PROVIDER || "openai").toLowerCase();
    const apiKey = provider === "gemini" ? c.env.GEMINI_API_KEY : c.env.OPENAI_API_KEY;
    const model =
      c.env.LLM_MODEL || c.env.OPENAI_MODEL || (provider === "gemini" ? "gemini-1.5-flash" : "gpt-4.1-mini");

    const result = await runAgent({
      userMessage: body.intent || "",
      mode,
      sessionId: body.sessionId || "",
      apiKey,
      model,
      provider,
      llmOnly
    });

    return c.json(result.payload, result.status);
  } catch (error) {
    let validationErrors = [error instanceof Error ? error.message : "Unknown error"];
    try {
      const parsed = JSON.parse(error?.message || "");
      if (parsed?.validation?.errors) {
        validationErrors = parsed.validation.errors;
      }
    } catch {}

    return c.json(
      {
        error: "Generation failed",
        detail: error instanceof Error ? error.message : "Unknown error",
        feedback: buildValidationFeedback(validationErrors),
        feedback_prompt: validationFeedbackPrompt({ validationErrors })
      },
      500
    );
  }
});

app.post("/api/validate-code", async (c) => {
  const body = await c.req.json();
  const validation = validateGeneratedCode(body.code || "");
  if (!validation.valid) {
    return c.json(
      {
        ...validation,
        feedback: buildValidationFeedback(validation.errors),
        feedback_prompt: validationFeedbackPrompt({ validationErrors: validation.errors })
      },
      400
    );
  }
  return c.json(validation);
});

app.post("/api/validate-ast", async (c) => {
  const body = await c.req.json();
  const result =
    body.generatedAst && body.generatedAst.root
      ? validateProps(body.generatedAst)
      : validateComponentSchema(body.generatedAst || null);
  return c.json(
    result.valid
      ? result
      : {
          ...result,
          feedback: buildValidationFeedback(result.errors),
          feedback_prompt: validationFeedbackPrompt({ validationErrors: result.errors })
        },
    result.valid ? 200 : 400
  );
});

app.post("/api/security-check", async (c) => {
  const body = await c.req.json();
  const security = analyzeIntentSecurity(body.user_intent || "");
  return c.json(security, security.is_safe ? 200 : 400);
});

app.post("/api/update-code", async (c) => {
  try {
    const body = await c.req.json();
    const session = getSession(body.sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const validation = validateGeneratedCode(body.code || "");
    if (!validation.valid) {
      return c.json(
        {
          error: "Code validation failed",
          validation,
          feedback: buildValidationFeedback(validation.errors),
          feedback_prompt: validationFeedbackPrompt({ validationErrors: validation.errors }),
          validation_prompt: codeValidationPrompt({
            generatedCode: body.code || "",
            componentRegistry: ALLOWED_COMPONENTS
          })
        },
        400
      );
    }

    const current = getCurrentVersion(session.id);
    const version = createVersion({
      sessionId: session.id,
      intent: body.intent || "Manual code edit",
      mode: "manual-edit",
      plan: current?.plan || { title: "Manual code edit", operations: [], notes: [] },
      plannerSource: "manual",
      uiTree: current?.uiTree || null,
      uiAst: current?.uiAst || null,
      code: body.code,
      explanation: "Manual code edit applied and validated.",
      parentVersionId: current?.id || null
    });

    addVersion(session.id, version);

    return c.json({
      sessionId: session.id,
      currentVersionId: version.id,
      version,
      history: listVersions(session.id)
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to update code",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
});

app.post("/api/rollback", async (c) => {
  const body = await c.req.json();
  const session = getSession(body.sessionId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const result = rollbackToVersion(body.sessionId, body.versionId);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({
    sessionId: body.sessionId,
    currentVersionId: result.version.id,
    version: result.version,
    history: listVersions(body.sessionId)
  });
});

export default app;
