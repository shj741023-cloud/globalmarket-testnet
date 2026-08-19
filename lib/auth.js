'use strict';

const crypto = require('node:crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(state, userId, now = new Date()) {
  const token = crypto.randomBytes(32).toString('base64url');
  const session = {
    id: crypto.randomUUID(),
    tokenHash: tokenHash(token),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    revokedAt: null
  };
  state.sessions.push(session);
  return { token, session };
}

function pruneSessions(state, now = new Date(), retentionMs = SESSION_RETENTION_MS) {
  const cutoff = now.getTime() - retentionMs;
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((session) => {
    const terminalAt = session.revokedAt ? new Date(session.revokedAt).getTime() : new Date(session.expiresAt).getTime();
    return !Number.isFinite(terminalAt) || terminalAt > cutoff;
  });
  return before - state.sessions.length;
}

function enforceSessionLimit(state, userId, maxActive = 5, now = new Date()) {
  const active = state.sessions
    .filter((session) => session.userId === userId && !session.revokedAt && new Date(session.expiresAt).getTime() > now.getTime())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let revoked = 0;
  for (const session of active.slice(maxActive)) {
    session.revokedAt = now.toISOString();
    revoked += 1;
  }
  return revoked;
}

function sessionUserId(state, cookieHeader, now = new Date()) {
  const token = parseCookies(cookieHeader).gm_testnet_session;
  return sessionUserIdFromToken(state, token, now);
}

function sessionUserIdFromToken(state, token, now = new Date()) {
  if (!token) return null;
  const hash = tokenHash(token);
  const session = state.sessions.find((item) => item.tokenHash === hash);
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= now.getTime()) return null;
  return session.userId;
}

function revokeSession(state, cookieHeader, now = new Date()) {
  const token = parseCookies(cookieHeader).gm_testnet_session;
  if (!token) return false;
  const session = state.sessions.find((item) => item.tokenHash === tokenHash(token));
  if (!session || session.revokedAt) return false;
  session.revokedAt = now.toISOString();
  return true;
}

function sessionCookie(token, secure = false) {
  return `gm_testnet_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure = false) {
  return `gm_testnet_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

module.exports = { SESSION_TTL_MS, SESSION_RETENTION_MS, parseCookies, tokenHash, createSession, pruneSessions, enforceSessionLimit, sessionUserId, sessionUserIdFromToken, revokeSession, sessionCookie, clearSessionCookie };
