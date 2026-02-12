import React, { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { componentRegistry } from "./lib/componentRegistry";
import { createSession, generateUI, rollback, updateCode, validateCode } from "./lib/api";
import { defaultCode } from "./lib/defaultCode";
import { renderPreviewElement } from "./lib/previewRuntime";

function AppFrame({ sessionId, loading, status, children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Ryze UI Agent Studio</h1>
          <p>Deterministic components. Multi-step agent. Reproducible UI code.</p>
        </div>
        <div className="topbar-meta">
          <span>{loading ? "Running..." : "Idle"}</span>
          <strong>{sessionId ? `Session ${sessionId.slice(0, 14)}` : "Session booting"}</strong>
        </div>
      </header>

      <nav className="route-nav">
        <NavLink to="/chat">Chat</NavLink>
        <NavLink to="/code">Code</NavLink>
        <NavLink to="/preview">Preview</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/agent">Agent</NavLink>
      </nav>

      <main className="route-content">{children}</main>
      <footer className="statusbar">{status}</footer>
    </div>
  );
}

function ChatRoute({ intent, setIntent, runGeneration, loading, messages }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Intent Chat</h2>
        <span>Describe target UI and iterative edits.</span>
      </div>

      <textarea
        className="intent-input"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="Example: Build a compact analytics dashboard with a settings modal and a recent activity table."
        rows={7}
      />

      <div className="button-row">
        <button disabled={loading} onClick={() => runGeneration("generate")}>Generate UI</button>
        <button disabled={loading} onClick={() => runGeneration("modify")}>Modify Existing</button>
        <button disabled={loading} onClick={() => runGeneration("regenerate")}>Regenerate</button>
      </div>

      <div className="chat-feed">
        {messages.length === 0 ? <p className="muted">No turns yet.</p> : null}
        {messages.map((msg, i) => (
          <article className={`bubble ${msg.role}`} key={`${msg.role}-${i}`}>
            <strong>{msg.role === "user" ? "You" : "Agent"}</strong>
            <p>{msg.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CodeRoute({ code, setCode, saveCodeEdit, loading }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Generated Code</h2>
        <span>Editable function: renderGeneratedUI(React, components)</span>
      </div>

      <textarea className="code-editor" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />

      <div className="button-row">
        <button disabled={loading} onClick={saveCodeEdit}>Validate + Save Code Edit</button>
      </div>
    </section>
  );
}

function PreviewRoute({ code }) {
  const preview = useMemo(() => {
    try {
      return { error: "", content: renderPreviewElement(code, componentRegistry) };
    } catch (e) {
      return { error: e.message || "Preview failed.", content: null };
    }
  }, [code]);

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Live Preview</h2>
        <span>Components are fixed, deterministic, and interactive.</span>
      </div>

      {preview.error ? (
        <div className="preview-error">{preview.error}</div>
      ) : (
        <div className="preview-surface">{preview.content}</div>
      )}
    </section>
  );
}

function HistoryRoute({ history, currentVersionId, rollbackVersion, loading }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Version History</h2>
        <span>Rollback to any previous deterministic generation.</span>
      </div>

      <div className="history-list">
        {history.length === 0 ? <p className="muted">No versions yet.</p> : null}
        {history.map((version) => (
          <button
            key={version.id}
            disabled={loading}
            className={version.id === currentVersionId ? "history-item active" : "history-item"}
            onClick={() => rollbackVersion(version.id)}
          >
            <span>{version.id}</span>
            <small>{new Date(version.createdAt).toLocaleString()}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function AgentRoute({ explanation, currentVersionId, history }) {
  const current = history.find((item) => item.id === currentVersionId);

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Agent Explainability</h2>
        <span>Planner, Generator, and Explainer outputs from latest run.</span>
      </div>

      <div className="agent-grid">
        <article>
          <h3>Planner Source</h3>
          <p>{current?.plannerSource || "n/a"}</p>
        </article>
        <article>
          <h3>Plan Summary</h3>
          <pre>{JSON.stringify(current?.plan || {}, null, 2)}</pre>
        </article>
        <article>
          <h3>Explanation</h3>
          <pre>{explanation}</pre>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const [intent, setIntent] = useState("");
  const [code, setCode] = useState(defaultCode);
  const [history, setHistory] = useState([]);
  const [currentVersionId, setCurrentVersionId] = useState("");
  const [explanation, setExplanation] = useState("Explainability output will appear here.");
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    createSession()
      .then((data) => {
        setSessionId(data.sessionId);
      })
      .catch((error) => {
        setStatus(`Failed to create session: ${error.message}`);
      });
  }, []);

  async function runGeneration(mode) {
    if (!intent.trim()) {
      setStatus("Add an instruction first.");
      return;
    }

    if (!sessionId) {
      setStatus("Session is not ready yet.");
      return;
    }

    setLoading(true);
    setStatus(`${mode} in progress...`);

    try {
      const response = await generateUI({ sessionId, intent: intent.trim(), mode });
      setCode(response.version.code);
      setHistory(response.history);
      setCurrentVersionId(response.currentVersionId);
      setExplanation(response.version.explanation || "No explanation returned.");
      setMessages((prev) => [
        ...prev,
        { role: "user", text: intent.trim() },
        { role: "assistant", text: response.version.explanation || "Generated successfully." }
      ]);
      setStatus(`Done (${response.version.plannerSource} planner)`);
    } catch (error) {
      setStatus(`Generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveCodeEdit() {
    if (!sessionId) return;

    setLoading(true);
    setStatus("Validating manual edit...");

    try {
      await validateCode({ code });
      const response = await updateCode({ sessionId, code, intent: "Manual edit from code panel" });
      setHistory(response.history);
      setCurrentVersionId(response.currentVersionId);
      setExplanation(response.version.explanation || "Manual update applied.");
      setStatus("Manual code edit saved.");
    } catch (error) {
      setStatus(`Manual save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function rollbackVersion(versionId) {
    if (!sessionId || !versionId) return;

    setLoading(true);
    setStatus("Rolling back...");

    try {
      const response = await rollback({ sessionId, versionId });
      setCode(response.version.code);
      setHistory(response.history);
      setCurrentVersionId(response.currentVersionId);
      setExplanation(`Rolled back to version ${response.version.id}.`);
      setStatus("Rollback complete.");
    } catch (error) {
      setStatus(`Rollback failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame sessionId={sessionId} loading={loading} status={status}>
      <Routes>
        <Route
          path="/chat"
          element={
            <ChatRoute
              intent={intent}
              setIntent={setIntent}
              runGeneration={runGeneration}
              loading={loading}
              messages={messages}
            />
          }
        />
        <Route
          path="/code"
          element={<CodeRoute code={code} setCode={setCode} saveCodeEdit={saveCodeEdit} loading={loading} />}
        />
        <Route path="/preview" element={<PreviewRoute code={code} />} />
        <Route
          path="/history"
          element={
            <HistoryRoute
              history={history}
              currentVersionId={currentVersionId}
              rollbackVersion={rollbackVersion}
              loading={loading}
            />
          }
        />
        <Route
          path="/agent"
          element={<AgentRoute explanation={explanation} currentVersionId={currentVersionId} history={history} />}
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AppFrame>
  );
}
