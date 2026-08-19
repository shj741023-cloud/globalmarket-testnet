'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSION_TTL_MS, parseCookies, tokenHash, createSession, pruneSessions, enforceSessionLimit, sessionUserId, sessionUserIdFromToken, revokeSession, sessionCookie } = require('../lib/auth');

test('쿠키 문자열을 안전하게 분리한다', () => {
  assert.deepEqual(parseCookies('a=1; gm_testnet_session=hello%20world'), { a: '1', gm_testnet_session: 'hello world' });
});

test('세션 원문 대신 해시만 저장한다', () => {
  const state = { sessions: [] };
  const result = createSession(state, 'u1', new Date('2026-08-14T00:00:00Z'));
  assert.notEqual(result.session.tokenHash, result.token);
  assert.equal(result.session.tokenHash, tokenHash(result.token));
  assert.equal(new Date(result.session.expiresAt).getTime() - new Date(result.session.createdAt).getTime(), SESSION_TTL_MS);
});

test('정상 쿠키 세션에서 사용자 ID를 찾는다', () => {
  const state = { sessions: [] };
  const { token } = createSession(state, 'u1');
  assert.equal(sessionUserId(state, `gm_testnet_session=${token}`), 'u1');
});

test('PiNet 프록시에서는 메모리 세션 토큰으로 사용자를 확인한다', () => {
  const state = { sessions: [] };
  const { token } = createSession(state, 'user-pinet');
  assert.equal(sessionUserIdFromToken(state, token), 'user-pinet');
  assert.equal(sessionUserIdFromToken(state, 'wrong-token'), null);
});

test('만료되거나 폐기된 세션을 거부한다', () => {
  const state = { sessions: [] };
  const now = new Date('2026-08-14T00:00:00Z');
  const { token } = createSession(state, 'u1', now);
  const cookie = `gm_testnet_session=${token}`;
  assert.equal(sessionUserId(state, cookie, new Date(now.getTime() + SESSION_TTL_MS)), null);
  assert.equal(revokeSession(state, cookie, now), true);
  assert.equal(sessionUserId(state, cookie, now), null);
});

test('세션 쿠키는 HttpOnly와 SameSite를 사용한다', () => {
  const cookie = sessionCookie('token', true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
});

test('만료 또는 폐기 후 7일이 지난 세션을 정리한다', () => {
  const state = { sessions: [
    { id: 'old', expiresAt: '2026-01-01T00:00:00.000Z', revokedAt: null },
    { id: 'recent', expiresAt: '2026-01-09T00:00:00.000Z', revokedAt: null },
    { id: 'revoked-old', expiresAt: '2026-02-01T00:00:00.000Z', revokedAt: '2026-01-01T00:00:00.000Z' }
  ] };
  assert.equal(pruneSessions(state, new Date('2026-01-10T00:00:00.000Z')), 2);
  assert.deepEqual(state.sessions.map((item) => item.id), ['recent']);
});

test('사용자별 활성 세션은 최신 5개까지만 유지한다', () => {
  const state = { sessions: Array.from({ length: 6 }, (_, index) => ({ id: `s${index}`, userId: 'u1', createdAt: `2026-01-0${index + 1}T00:00:00.000Z`, expiresAt: '2026-02-01T00:00:00.000Z', revokedAt: null })) };
  assert.equal(enforceSessionLimit(state, 'u1', 5, new Date('2026-01-07T00:00:00.000Z')), 1);
  assert.equal(state.sessions.find((item) => item.id === 's0').revokedAt, '2026-01-07T00:00:00.000Z');
});
