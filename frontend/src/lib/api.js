const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.detail || "Request failed");
  }
  return data;
}

export function createSession() {
  return request("/api/session", { method: "POST" });
}

export function generateUI(payload) {
  return request("/api/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function validateCode(payload) {
  return request("/api/validate-code", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateCode(payload) {
  return request("/api/update-code", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function rollback(payload) {
  return request("/api/rollback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
