'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSION_TTL_MS, parseCookies, tokenHash, createSession, sessionUserId, sessionUserIdFromToken, revokeSession, sessionCookie } = require('../lib/auth');

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
