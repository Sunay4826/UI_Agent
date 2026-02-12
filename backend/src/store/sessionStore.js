const sessions = new Map();

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createSession() {
  const id = createId("sess");
  const now = new Date().toISOString();
  sessions.set(id, {
    id,
    createdAt: now,
    updatedAt: now,
    versions: [],
    currentVersionId: null
  });
  return sessions.get(id);
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function ensureSession(id) {
  const session = getSession(id);
  if (session) return session;
  return createSession();
}

export function addVersion(sessionId, version) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.versions.push(version);
  session.currentVersionId = version.id;
  session.updatedAt = new Date().toISOString();
  return version;
}

export function getCurrentVersion(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.currentVersionId) return null;
  return session.versions.find((v) => v.id === session.currentVersionId) || null;
}

export function rollbackToVersion(sessionId, versionId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  const target = session.versions.find((v) => v.id === versionId);
  if (!target) return { ok: false, error: "Version not found." };
  session.currentVersionId = versionId;
  session.updatedAt = new Date().toISOString();
  return { ok: true, version: target };
}

export function listVersions(sessionId) {
  const session = getSession(sessionId);
  if (!session) return [];
  return [...session.versions].reverse();
}

export function createVersion(data) {
  return {
    id: createId("ver"),
    createdAt: new Date().toISOString(),
    ...data
  };
}
