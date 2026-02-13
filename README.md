# AI Deterministic UI Generator

Claude-Code-style deterministic UI generation with React frontend and Hono backend on Cloudflare Workers.

## Overview

This app converts natural-language UI intent into deterministic UI code and live preview while enforcing a fixed component system. It supports iterative modifications, explainability, validation, and version rollback.

## Architecture Overview

High-level orchestration flow:

```text
User Intent
  -> [1] Injection Guard
  -> [2] Intent Classifier (modify | rollback | compare)
  -> [3] Planner
  -> [4] Deterministic Normalizer
  -> [5] Generator (React function)
  -> [6] Prop Validator
  -> [7] Code Validator
  -> [8] Explainer
  -> Render + Store Version
```

### Frontend (`/frontend`)

- React + Vite
- Route-based interface:
  - `/chat`
  - `/code`
  - `/preview`
  - `/history`
  - `/agent`
- Claude-style split workflow:
  - intent input/chat
  - editable generated code
  - live preview
- Version list + rollback actions

### Backend (`/backend`)

- Hono on Cloudflare Workers
- `runAgent(...)` orchestration entrypoint
- Deterministic plan normalization before application
- Strict schema and code validation before render/save
- In-memory version/session store

## Agent Design & Prompts

Prompt templates are centralized in:

- `backend/src/agent/prompts.js`

Agent step modules:

- `backend/src/agent/injectionGuard.js`
- `backend/src/agent/intentClassifier.js`
- `backend/src/agent/versionIntentPlanner.js`
- `backend/src/agent/planner.js`
- `backend/src/agent/normalizer.js`
- `backend/src/agent/generator.js`
- `backend/src/agent/explainer.js`
- `backend/src/agent/runAgent.js`

Implemented prompt categories include:

- Incremental planner prompt
- Rollback-aware intent planner prompt
- Prompt-injection defense prompt
- Deterministic normalizer prompt
- Generator prompt
- Explainer prompt
- Edit-awareness explainer prompt
- Prop schema validation prompt
- Code validation prompt
- Validation feedback prompt

## Deterministic Component System Design

Allowed leaf components:

- `Button`
- `Card`
- `Input`
- `Table`
- `Modal`
- `Sidebar`
- `Navbar`
- `Chart`

Layout wrappers:

- `Page`
- `Layout`

Rules enforced:

- No AI-generated CSS
- No inline style generation by AI
- No external UI libraries from generated code
- No new components outside whitelist
- Prop schemas strictly enforced
- Generated code shape constrained to `renderGeneratedUI(React, components)`

Core files:

- `backend/src/core/componentRegistry.js`
- `backend/src/core/propSchemas.js`
- `backend/src/core/astTypes.js`
- `backend/src/validation/propValidator.js`
- `backend/src/validation/codeValidator.js`
- `backend/src/validation/componentSchemaValidator.js`

## Iteration, Versioning, and Rollback

- Every successful generation stores a version snapshot with:
  - intent
  - mode
  - plan
  - UI AST/tree
  - generated code
  - explanation
- Modify mode applies incremental updates to current version.
- Regenerate mode starts from baseline and re-composes deterministically.
- Rollback moves active pointer to a previous version.
- Compare intent returns version metadata for inspection.

Version store:

- `backend/src/store/versionStore.js`

## Safety & Validation

- Prompt injection filtering:
  - `backend/src/validation/sanitize.js`
- Plan validation:
  - `backend/src/validation/planValidator.js`
- Prop validation:
  - `backend/src/validation/propValidator.js`
- Code validation:
  - `backend/src/validation/codeValidator.js`
- User-friendly validation feedback:
  - `backend/src/validation/validationFeedback.js`

## LLM Configuration (Gemini Only)

Environment options:

- `GEMINI_API_KEY=<key>`
- `LLM_MODEL=<model-name>`
- `LLM_ONLY=true|false`

Behavior:

- If `LLM_ONLY=true`, generation fails when Gemini key/model is invalid.
- If `LLM_ONLY=false`, heuristic fallback is available.

## Setup

## 1) Install dependencies

Recommended Node: LTS (Node 22).

```bash
npm install
```

## 2) Local development

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8787`

### Local Gemini example (`backend/.dev.vars`)

```env
GEMINI_API_KEY=your_key
LLM_MODEL=gemini-2.5-flash
LLM_ONLY=true
```

## 3) Deploy Backend (Cloudflare Workers)

```bash
cd backend
npm run deploy
```

Set secrets:

```bash
npx wrangler secret put GEMINI_API_KEY
```

## 4) Deploy Frontend

Deploy on Cloudflare Pages / Vercel / Netlify.

Required frontend env:

- `VITE_API_BASE_URL=https://<worker-domain>`

## Evaluation Criteria Mapping

### Agent Design

- Multi-step agent pipeline is explicit and separated by module.
- Prompt templates are visible and versionable.

### Determinism

- Fixed component registry
- Strict prop schemas
- Deterministic plan normalization and operation ordering

### Iteration

- `modify` mode applies incremental targeted updates
- `regenerate` mode resets to baseline then recomposes
- rollback/version history supported

### Explainability

- Explainer step returns plain-language rationale
- Edit-awareness explainer path for incremental changes

### Engineering Judgment

- Tradeoff: strict safety + deterministic constraints over free-form rendering
- Provider abstraction added while preserving deterministic guards

## Known Limitations

- In-memory store (non-durable across worker restarts)
- No visual diff UI yet (compare is metadata-based)
- LLM output quality varies by provider/model quotas
- Deterministic component set is intentionally narrow
- Table/chart data synthesis is heuristic when LLM omits details

## What I’d Improve With More Time

- Durable persistence (D1/KV) and replayable generation logs
- Structured patch-diff UI for version-to-version edits
- Stronger AST-level planner contract and repair loop
- Better telemetry and per-step observability dashboards
- Streaming responses for planner/generator/explainer stages

## Explicitly Not Required (Per Assignment)

Not implemented intentionally:

- Authentication
- Multi-user support
- Pixel-perfect design system polish
- Full accessibility audit

## Demo Video (Optional but Recommended)

Record 5–7 minutes showing:

1. Initial generation from plain-English intent
2. Modify existing UI (incremental, no full rewrite)
3. Regenerate behavior
4. Explanation output
5. Rollback/version change
