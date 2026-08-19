'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminKeyMatches, requestIdentity } = require('../lib/admin-auth');

test('관리자 키는 안전한 동일성 비교를 사용한다', () => {
  assert.equal(adminKeyMatches('correct-key', 'correct-key'), true);
  assert.equal(adminKeyMatches('wrong-key', 'correct-key'), false);
  assert.equal(adminKeyMatches('', 'correct-key'), false);
  assert.equal(adminKeyMatches(undefined, 'correct-key'), false);
});

test('관리자 실패 제한은 접속자별 식별값을 사용한다', () => {
  assert.equal(requestIdentity({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, socket: {} }), '203.0.113.1');
  assert.equal(requestIdentity({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});
