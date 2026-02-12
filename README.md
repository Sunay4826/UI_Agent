# Deterministic AI UI Generator (React + Hono on Cloudflare Workers)

This project implements a Claude-Code-style UI generator with deterministic rendering constraints.

## What It Does

- Accepts natural-language UI intent.
- Runs a full orchestration pipeline:
  1. Injection Guard
  2. Intent Classifier (`modify | rollback | compare`)
  3. Planner (AST modification plan)
  4. Deterministic Normalizer
  5. Generator (React code)
  6. Prop Validator
  7. Code Validator
  8. Explainer
- Produces editable generated React code.
- Shows live preview using a fixed component library.
- Supports iterative modify/regenerate flows.
- Stores version history and supports rollback.

## Deterministic Component System

Whitelisted components only:

- `Button`
- `Card`
- `Input`
- `Table`
- `Modal`
- `Sidebar`
- `Navbar`
- `Chart`

Rules enforced:

- No AI-generated CSS.
- No inline style generation by the AI.
- No dynamic external component creation.
- Code validator blocks unknown components and dangerous tokens.

## Architecture

### Frontend (`/frontend`)

- React + Vite.
- Route-based UI:
  - `/chat`
  - `/code`
  - `/preview`
  - `/history`
  - `/agent`
- Preview runtime compiles constrained JS function:
  - `renderGeneratedUI(React, components)`

### Backend (`/backend`)

- Hono API running on Cloudflare Workers.
- In-memory session/version store.
- Agent orchestration via single `runAgent(...)` flow.
- Input sanitization + code validation + component whitelist enforcement.

## Backend Structure

```text
/backend/src
  /agent
    injectionGuard.js
    intentClassifier.js
    planner.js
    normalizer.js
    generator.js
    explainer.js
    runAgent.js

  /validation
    propValidator.js
    codeValidator.js

  /core
    componentRegistry.js
    propSchemas.js
    astTypes.js

  /store
    versionStore.js
```

## Orchestration Flow

```text
User Intent
  -> [1] Injection Guard
  -> [2] Intent Classifier
  -> [3] Planner
  -> [4] Deterministic Normalizer
  -> [5] Generator
  -> [6] Prop Validator
  -> [7] Code Validator
  -> [8] Explainer
  -> Render + Store Version
```

## Agent Design & Prompt Separation

Prompt templates are separated in:

- `/backend/src/agent/prompts.js`

Pipeline steps are separated in:

- `/backend/src/agent/injectionGuard.js`
- `/backend/src/agent/intentClassifier.js`
- `/backend/src/agent/planner.js`
- `/backend/src/agent/normalizer.js`
- `/backend/src/agent/generator.js`
- `/backend/src/agent/explainer.js`
- `/backend/src/agent/runAgent.js`

## AST Design

All iterative editing operates on a canonical UI AST:

```ts
type UITree = {
  version: number
  root: UINode
}

type UINode = {
  id: string
  component: string
  props: Record<string, any>
  children: UINode[]
}
```

AST adapters are implemented in `/backend/src/core/astTypes.js` for conversion between canonical `UITree` and render-oriented legacy layout nodes.

## Prop Schema Design

Strict deterministic prop schemas are defined in:

- `/backend/src/core/propSchemas.js`

Validation is enforced by:

- `/backend/src/validation/propValidator.js`

Validation rejects:

- missing required props
- unknown props
- invalid prop types
- nested component misuse

## Versioning

Version snapshots are stored per session and include both code and AST:

- `uiAst` (`UITree`)
- `uiTree` (render-oriented tree)
- `code`
- `plan`
- `explanation`

Rollback switches active pointer to a previous snapshot version, and compare returns metadata for active/target snapshots.

### LLM behavior

- If `OPENAI_API_KEY` is provided, planner/explainer can use OpenAI.
- If not, deterministic heuristic fallback is used.

## Safety & Validation

- Prompt injection filter in `/backend/src/validation/sanitize.js`.
- Plan validation in `/backend/src/validation/planValidator.js`.
- Code validation in `/backend/src/validation/codeValidator.js`.
- Component prop schema validation in `/backend/src/validation/componentSchemaValidator.js`.
- Frontend preview also validates before evaluation.

Additional API:
- `POST /api/validate-ast` with `{ "generatedAst": { ... } }` returns:
  - `{ "valid": boolean, "errors": [{ "component": "", "prop": "", "issue": "" }] }`
- `POST /api/security-check` with `{ "user_intent": "..." }` returns:
  - `{ "is_safe": boolean, "violation_reason": "", "safe_intent_summary": "" }`
- `POST /api/validate-code` with `{ "code": "..." }` returns:
  - `{ "valid": boolean, "errors": ["..."] }`
  - Invalid responses also include:
    - `feedback`: `{ what_went_wrong, rule_violated, how_to_fix, details }`
    - `feedback_prompt`: validation feedback prompt text

Generation requests are rollback-aware:
- A pre-planner classifies intent as `modify | rollback | compare` using version history + current AST.
- `/api/generate` returns `version_intent` in all responses.
- For compare intent, response includes `comparison` metadata.

Deterministic enforcement stage:
- Planner output is normalized before tree application:
  - random-like fields removed
  - operation order normalized
  - prop keys sorted recursively
  - stable canonical plan shape enforced
- `/api/generate` includes `deterministic_prompt` for traceability.

## Setup

## 1) Install

Use Node LTS first (recommended: Node 22):

```bash
nvm use || nvm install
```

```bash
npm install
```

## 2) Run locally

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend (Workers local): `http://127.0.0.1:8787`

Optional backend env vars (for real LLM):

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `ALLOWED_ORIGIN` (default `*`)

## Deployment

### Backend (Cloudflare Workers + Hono)

```bash
cd backend
npm run deploy
```

### Frontend (Vercel/Netlify/Cloudflare Pages)

Set env var during frontend deploy:

- `VITE_API_BASE_URL=https://<your-worker-domain>`

## Known Limitations

- Storage is in-memory (sessions reset on worker restart).
- Generated code is constrained JS (`React.createElement`) rather than JSX.
- Compare currently returns metadata; no visual side-by-side diff UI yet.
- Schema depth is fixed to current component system.

## What I Would Improve With More Time

- Durable storage (D1/KV) and replayable generations.
- Token streaming + planner/generator/explainer step streaming UI.
- AST-level code patching for stronger incremental edit guarantees.
- Side-by-side diff view and operation timeline.
- Stronger static analysis and schema-level component prop validation.
