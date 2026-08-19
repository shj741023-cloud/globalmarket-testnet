'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isMutationOriginAllowed, assertActiveUser } = require('../lib/request-security');

test('Render와 PiNet 앱 출처의 변경 요청을 허용한다', () => {
  assert.equal(isMutationOriginAllowed({ method: 'POST', origin: 'https://globalmarket-testnet.onrender.com' }), true);
  assert.equal(isMutationOriginAllowed({ method: 'PATCH', origin: 'https://globalmarket2678.pinet.com' }), true);
});

test('외부 사이트의 쿠키 기반 변경 요청을 차단한다', () => {
  assert.equal(isMutationOriginAllowed({ method: 'DELETE', origin: 'https://malicious.example' }), false);
});

test('앱의 Bearer 토큰 요청과 읽기 요청은 출처와 관계없이 허용한다', () => {
  assert.equal(isMutationOriginAllowed({ method: 'POST', origin: 'https://other.example', authorization: 'Bearer token' }), true);
  assert.equal(isMutationOriginAllowed({ method: 'GET', origin: 'https://other.example' }), true);
});

test('활성 계정만 인증 후 기능을 사용할 수 있다', () => {
  assert.equal(assertActiveUser({ id: 'u1', status: 'active' }).id, 'u1');
  assert.throws(() => assertActiveUser({ id: 'u2', status: 'suspended' }), /사용할 수 없는 계정/);
});
