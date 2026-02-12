import {
  addVersion,
  createSession,
  createVersion,
  ensureSession,
  getCurrentVersion,
  getSession,
  listVersions,
  rollbackToVersion
} from "./sessionStore.js";
import { createUITreeFromLegacy } from "../core/astTypes.js";
import { DEFAULT_TREE } from "../constants/componentRegistry.js";

export function getOrCreateSession(sessionId) {
  if (sessionId) {
    return ensureSession(sessionId);
  }
  return createSession();
}

export function getVersionList(sessionId) {
  return listVersions(sessionId);
}

export function getCurrentVersionRecord(sessionId) {
  return getCurrentVersion(sessionId);
}

export function getLatestTree(sessionId) {
  const current = getCurrentVersion(sessionId);
  if (!current) {
    return createUITreeFromLegacy(DEFAULT_TREE, 1);
  }

  if (current.uiAst?.root) {
    return current.uiAst;
  }

  if (current.uiTree) {
    return createUITreeFromLegacy(current.uiTree, Number(current.uiAst?.version || 1));
  }

  return createUITreeFromLegacy(DEFAULT_TREE, 1);
}

export function saveVersion({ sessionId, payload }) {
  const current = getCurrentVersion(sessionId);
  const version = createVersion({
    ...payload,
    parentVersionId: current?.id || null
  });

  addVersion(sessionId, version);
  return version;
}

export function rollbackVersion(sessionId, versionId) {
  return rollbackToVersion(sessionId, versionId);
}

export function getVersionById(sessionId, versionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  return session.versions.find((item) => item.id === versionId) || null;
}
