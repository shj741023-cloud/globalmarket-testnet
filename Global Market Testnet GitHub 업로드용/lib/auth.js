'use strict';

const crypto = require('node:crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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

function sessionUserId(state, cookieHeader, now = new Date()) {
  const token = parseCookies(cookieHeader).gm_testnet_session;
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

module.exports = { SESSION_TTL_MS, parseCookies, tokenHash, createSession, sessionUserId, revokeSession, sessionCookie, clearSessionCookie };
